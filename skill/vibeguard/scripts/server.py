#!/usr/bin/env python3
"""Serve the security report with a guarded one-click fix API.

Starts on 127.0.0.1 + a random port + a random per-session token, serves the
interactive report, and exposes POST /action to execute pre-approved fix
commands. Stop with Ctrl+C.

Usage:
    server.py <analysis.json>
    server.py --no-open <analysis.json>

SAFETY MODEL — read before changing:
- Per-item fixes: only fix_config from green items are accepted. Every request
  is validated against the allowlist built at load time.
- Batch dependency update: exposed as a separate update_all action after an
  explicit browser confirmation. It runs package-manager update commands for
  detected ecosystems and returns per-ecosystem results.
- Bound to 127.0.0.1 only; every POST requires the session token; Host header
  must be 127.0.0.1 (blocks DNS-rebinding).
- Green items: pre-approved safe fixes (dependency upgrade, gitignore fix,
  git rm --cached). Confirmed via browser dialog before execution.
- Yellow items: only "open file" (non-destructive).
- Red items: no actions available.
"""

import argparse
import hashlib
import json
import os
import re
import secrets
import shlex
import subprocess
import sys
import tempfile
import time
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HERE = os.path.dirname(os.path.abspath(__file__))
TEMPLATE = os.path.join(HERE, "..", "assets", "report_template.html")
TOKEN = secrets.token_urlsafe(24)
MAX_POST_BYTES = 64 * 1024
AUTO_OPEN_COOLDOWN_SECONDS = 60

SAFE_PACKAGE_RE = re.compile(r"^[A-Za-z0-9@._+/\-]+$")
SAFE_VERSION_RE = re.compile(r"^[A-Za-z0-9<>=!~^.*][A-Za-z0-9<>=!~^.,:_+\-*]*$")
SAFE_GITIGNORE_RE = re.compile(r"^[^\r\n\0]{1,200}$")
SAFE_REL_PATH_RE = re.compile(r"^[^\0\r\n]{1,500}$")

DATA = {}
TPL = ""
FIX_ALLOW = {}  # action id -> normalized fix_config dict
OPEN_ALLOW = set()  # set of realpath-resolved file paths


def json_for_script(value):
    """Serialize JSON for embedding inside a <script> block."""
    blob = json.dumps(value, ensure_ascii=False, separators=(",", ":"))
    return (
        blob.replace("&", "\\u0026")
        .replace("<", "\\u003c")
        .replace(">", "\\u003e")
        .replace("\u2028", "\\u2028")
        .replace("\u2029", "\\u2029")
    )


def parse_args(argv):
    parser = argparse.ArgumentParser(description="Serve a VibeGuard security report")
    parser.add_argument("analysis_json", help="path to vibeguard analysis JSON")
    parser.add_argument(
        "--no-open",
        action="store_true",
        help="print the report URL without opening a browser tab",
    )
    return parser.parse_args(argv)


def open_browser_once(url, analysis_path):
    """Avoid duplicate browser tabs when the same report path is regenerated."""
    marker_key = os.path.realpath(analysis_path)
    digest = hashlib.sha256(marker_key.encode("utf-8")).hexdigest()[:24]
    marker = os.path.join(tempfile.gettempdir(), f"vibeguard-open-{digest}.stamp")
    now = time.time()

    try:
        fd = os.open(marker, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    except FileExistsError:
        try:
            age = now - os.path.getmtime(marker)
        except OSError:
            age = 0
        if age < AUTO_OPEN_COOLDOWN_SECONDS:
            return False
        try:
            os.unlink(marker)
        except OSError:
            return False
        try:
            fd = os.open(marker, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
        except FileExistsError:
            return False

    with os.fdopen(fd, "w", encoding="utf-8") as f:
        f.write(url)
    webbrowser.open_new_tab(url)
    return True


def project_root(data):
    root = data.get("project", {}).get("path") or os.getcwd()
    return os.path.realpath(root)


def is_under(base, path):
    base = os.path.realpath(base)
    path = os.path.realpath(path)
    return path == base or path.startswith(base + os.sep)


def resolve_project_path(base, path):
    if not isinstance(path, str) or not SAFE_REL_PATH_RE.match(path):
        raise ValueError("路径格式不安全")
    full = path if os.path.isabs(path) else os.path.join(base, path)
    rp = os.path.realpath(full)
    if not is_under(base, rp):
        raise ValueError("路径不在项目目录内")
    return rp


def shell_join(parts):
    return " ".join(shlex.quote(p) for p in parts)


def gitignore_ignores(content, pattern):
    norm = pattern.strip().lower().rstrip("/")
    state = False
    for line in content.splitlines():
        line = line.strip().lower().rstrip("/")
        if not line or line.startswith("#"):
            continue
        if line == norm:
            state = True
        elif line == "!" + norm:
            state = False
    return state


def normalize_package(value):
    value = (value or "").strip()
    if (
        not value
        or value.startswith(("-", ".", "/"))
        or ".." in value
        or not SAFE_PACKAGE_RE.match(value)
    ):
        raise ValueError("包名格式不安全")
    return value


def normalize_version(value, *, exact=False):
    value = str(value or "").strip()
    if not value or not SAFE_VERSION_RE.match(value):
        raise ValueError("版本号格式不安全")
    if exact and value[0] in "<>=!~^*":
        raise ValueError("该生态的一键修复需要明确版本号")
    return value


def infer_js_manager(data):
    lockfiles = set(data.get("project", {}).get("lockfiles") or [])
    if "pnpm-lock.yaml" in lockfiles:
        return "pnpm"
    if "yarn.lock" in lockfiles:
        return "yarn"
    return "npm"


def infer_ecosystem(cfg, item, data):
    eco = cfg.get("ecosystem") or item.get("ecosystem")
    if eco:
        return eco
    ecosystems = data.get("project", {}).get("ecosystems") or []
    if len(ecosystems) == 1:
        eco = ecosystems[0]
        return "npm" if eco in ("npm", "pnpm", "yarn") else eco
    return "npm"


def build_upgrade_command(cfg, item, data):
    package = normalize_package(cfg.get("package") or item.get("package"))
    ecosystem = infer_ecosystem(cfg, item, data)

    if ecosystem in ("npm", "pnpm", "yarn"):
        manager = cfg.get("manager") or infer_js_manager(data)
        if manager not in ("npm", "pnpm", "yarn"):
            raise ValueError("不支持的 JS 包管理器")
        version = normalize_version(cfg.get("version") or item.get("version"))
        spec = f"{package}@{version}"
        cmd = {"npm": ["npm", "install", spec], "pnpm": ["pnpm", "add", spec], "yarn": ["yarn", "add", spec]}[manager]
        return cmd, {
            "type": "upgrade",
            "ecosystem": "npm",
            "manager": manager,
            "package": package,
            "version": version,
        }

    if ecosystem == "pypi":
        raise ValueError("Python 依赖需确认虚拟环境和锁文件，暂不启用网页一键修复")

    if ecosystem == "go":
        version = normalize_version(cfg.get("version") or item.get("version"), exact=True)
        return ["go", "get", f"{package}@{version}"], {
            "type": "upgrade",
            "ecosystem": "go",
            "package": package,
            "version": version,
        }

    if ecosystem == "crates-io":
        version = normalize_version(cfg.get("version") or item.get("version"), exact=True)
        return ["cargo", "update", "-p", package, "--precise", version], {
            "type": "upgrade",
            "ecosystem": "crates-io",
            "package": package,
            "version": version,
        }

    raise ValueError(f"不支持的一键升级生态: {ecosystem}")


def normalize_fix_config(cfg, item, data, index):
    if not isinstance(cfg, dict):
        raise ValueError("fix_config 必须是对象")
    fix_type = cfg.get("type")
    action_id = f"fix-{index}-{secrets.token_urlsafe(8)}"

    if fix_type == "upgrade":
        cmd, clean = build_upgrade_command(cfg, item, data)
        clean["argv"] = cmd
        clean["command"] = shell_join(cmd)
    elif fix_type == "gitignore":
        raw_patterns = cfg.get("patterns") or []
        if isinstance(raw_patterns, str):
            raw_patterns = [raw_patterns]
        patterns = []
        for p in raw_patterns:
            p = str(p).strip()
            if p.startswith("!") or not SAFE_GITIGNORE_RE.match(p):
                raise ValueError("gitignore 规则格式不安全")
            if p not in patterns:
                patterns.append(p)
        if not patterns:
            raise ValueError("缺少 gitignore 规则")
        clean = {"type": "gitignore", "patterns": patterns}
        clean["command"] = "printf '%s\\n' " + " ".join(shlex.quote(p) for p in patterns) + " >> .gitignore"
    elif fix_type == "git_rm_cached":
        raw_paths = cfg.get("paths") or cfg.get("path") or []
        if isinstance(raw_paths, str):
            raw_paths = [raw_paths]
        root = project_root(data)
        paths = []
        for p in raw_paths:
            rp = resolve_project_path(root, p)
            rel = os.path.relpath(rp, root)
            if rel == "." or rel.startswith(".."):
                raise ValueError("git rm 路径不安全")
            if rel not in paths:
                paths.append(rel)
        if not paths:
            raise ValueError("缺少 git rm 路径")
        clean = {"type": "git_rm_cached", "paths": paths}
        clean["command"] = "git rm --cached -- " + " ".join(shlex.quote(p) for p in paths)
    else:
        raise ValueError(f"未知修复类型: {fix_type}")

    clean["id"] = action_id
    return clean


def load(src):
    with open(src, encoding="utf-8") as f:
        data = json.load(f)
    with open(TEMPLATE, encoding="utf-8") as f:
        tpl = f.read()

    data.setdefault("project", {})
    data["project"]["path"] = project_root(data)

    # Calculate total pipeline time (scan + analysis + report setup)
    gen_at = data.get("generated_at")
    scan_secs = data.get("scan_seconds", 0)
    if gen_at:
        try:
            gen_ts = time.mktime(time.strptime(gen_at, "%Y-%m-%d %H:%M:%S"))
            elapsed = time.time() - gen_ts
            if elapsed > 0:
                data["total_seconds"] = round(scan_secs + elapsed, 1)
        except (ValueError, OverflowError):
            pass

    fix_allow = {}
    open_allow = set()
    root = project_root(data)

    # Green: allow fix execution
    for idx, it in enumerate(data.get("green", []), 1):
        cfg = it.get("fix_config")
        if cfg:
            try:
                clean = normalize_fix_config(cfg, it, data, idx)
                it["fix_config"] = clean
                fix_allow[clean["id"]] = clean
            except ValueError as e:
                it.pop("fix_config", None)
                it.setdefault("fix_error", str(e))
        # Also allow opening associated files
        path = it.get("path") or it.get("file")
        if path:
            try:
                rp = resolve_project_path(root, path)
            except ValueError:
                continue
            if os.path.isfile(rp):
                open_allow.add(rp)

    # Yellow: allow opening files for review (non-destructive)
    for it in data.get("yellow", []):
        path = it.get("path") or it.get("file")
        if path:
            try:
                rp = resolve_project_path(root, path)
            except ValueError:
                continue
            if os.path.isfile(rp):
                open_allow.add(rp)

    return data, tpl, fix_allow, open_allow


def execute_fix(config, cwd):
    """Execute a pre-approved fix command."""
    fix_type = config.get("type")

    if fix_type == "upgrade":
        cmd = config.get("argv", [])
        if not cmd:
            raise ValueError("缺少修复命令")
        result = subprocess.run(
            cmd, capture_output=True, text=True, timeout=120, cwd=cwd
        )
        if result.returncode != 0:
            raise OSError((result.stderr or "修复命令执行失败").strip())
        return True

    elif fix_type == "gitignore":
        patterns = config.get("patterns", [])
        gitignore_path = os.path.join(cwd, ".gitignore")
        existing = ""
        if os.path.isfile(gitignore_path):
            with open(gitignore_path, "r", encoding="utf-8") as f:
                existing = f.read()
        add = []
        for p in patterns:
            if not gitignore_ignores(existing, p):
                add.append(p)
        if add:
            with open(gitignore_path, "a", encoding="utf-8") as f:
                if existing and not existing.endswith("\n"):
                    f.write("\n")
                f.write("\n".join(add) + "\n")
        return True

    elif fix_type == "git_rm_cached":
        paths = config.get("paths", [])
        for p in paths:
            resolve_project_path(cwd, p)
            result = subprocess.run(
                ["git", "rm", "--cached", "--", p],
                capture_output=True,
                text=True,
                timeout=30,
                cwd=cwd,
            )
            if result.returncode != 0:
                raise OSError(
                    f"git rm --cached {p} 失败: {(result.stderr or '').strip()}"
                )
        return True

    else:
        raise ValueError(f"未知修复类型: {fix_type}")


def run_update_command(ecosystem, cmd, cwd, timeout=300):
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout, cwd=cwd)
    command = shell_join(cmd)
    if result.returncode != 0:
        return {
            "ecosystem": ecosystem,
            "ok": False,
            "command": command,
            "error": (result.stderr or result.stdout or "依赖升级失败").strip()[:800],
        }
    return {
        "ecosystem": ecosystem,
        "ok": True,
        "command": command,
        "output": (result.stdout or "").strip()[:800],
    }


def is_registry_dependency_spec(spec):
    value = str(spec or "").strip().lower()
    return not value.startswith(
        (
            "workspace:",
            "file:",
            "link:",
            "portal:",
            "git:",
            "git+",
            "http://",
            "https://",
            "github:",
            "npm:",
        )
    )


def npm_latest_commands(cwd):
    path = os.path.join(cwd, "package.json")
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except (OSError, json.JSONDecodeError):
        return []

    sections = [
        ("dependencies", ["npm", "install"]),
        ("devDependencies", ["npm", "install", "--save-dev"]),
        ("optionalDependencies", ["npm", "install", "--save-optional"]),
        ("peerDependencies", ["npm", "install", "--save-peer"]),
    ]
    commands = []
    for section, prefix in sections:
        deps = data.get(section) or {}
        specs = [
            f"{name}@latest"
            for name, version in deps.items()
            if normalize_package(name) and is_registry_dependency_spec(version)
        ]
        for i in range(0, len(specs), 40):
            commands.append(prefix + specs[i : i + 40])
    return commands


def execute_update_all(data, cwd):
    """Run broad dependency update commands after explicit browser confirmation."""
    ecosystems = set(data.get("project", {}).get("ecosystems") or [])
    results = []

    if ecosystems & {"npm", "pnpm", "yarn"}:
        manager = infer_js_manager(data)
        if manager == "npm":
            commands = npm_latest_commands(cwd) or [["npm", "update", "--save"]]
            for cmd in commands:
                results.append(run_update_command(manager, cmd, cwd))
        else:
            cmd = {
                "pnpm": ["pnpm", "update", "--latest"],
                "yarn": ["yarn", "upgrade", "--latest"],
            }.get(manager, ["npm", "update", "--save"])
            results.append(run_update_command(manager, cmd, cwd))

    if "pypi" in ecosystems:
        if os.path.isfile(os.path.join(cwd, "requirements.txt")):
            results.append(
                run_update_command(
                    "pypi",
                    [
                        sys.executable,
                        "-m",
                        "pip",
                        "install",
                        "--upgrade",
                        "-r",
                        "requirements.txt",
                    ],
                    cwd,
                )
            )
        else:
            results.append(
                {
                    "ecosystem": "pypi",
                    "ok": False,
                    "error": "未找到 requirements.txt，Python 依赖需手动确认虚拟环境和锁文件",
                }
            )

    if "go" in ecosystems:
        results.append(run_update_command("go", ["go", "get", "-u", "./..."], cwd))

    if "crates-io" in ecosystems:
        results.append(run_update_command("crates-io", ["cargo", "update"], cwd))

    if not results:
        raise ValueError("未检测到支持的一键依赖升级生态")
    return results


def open_in_editor(path):
    """Open file in default editor (non-destructive)."""
    if not os.path.exists(path):
        raise OSError(f"文件不存在: {path}")
    if sys.platform == "darwin":
        subprocess.run(["open", path], capture_output=True, text=True)
    elif sys.platform.startswith("win"):
        subprocess.run(["start", "", path], shell=True, capture_output=True, text=True)
    else:
        subprocess.run(["xdg-open", path], capture_output=True, text=True)


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def _send(self, code, body, ctype="application/json"):
        b = body.encode("utf-8") if isinstance(body, str) else body
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(b)))
        self.end_headers()
        self.wfile.write(b)

    def do_GET(self):
        if self.path in ("/", "/index.html"):
            blob = json_for_script(DATA)
            cfg = json_for_script({"token": TOKEN, "endpoint": "/action"})
            html = TPL.replace("__REPORT_DATA__", blob).replace("__FIX_CONFIG__", cfg)
            self._send(200, html, "text/html; charset=utf-8")
        else:
            self._send(404, "not found", "text/plain")

    def do_POST(self):
        if self.path != "/action":
            self._send(404, json.dumps({"ok": False, "error": "not found"}))
            return
        # DNS-rebinding guard
        host = (self.headers.get("Host") or "").split(":")[0]
        if host not in ("127.0.0.1", "localhost"):
            self._send(403, json.dumps({"ok": False, "error": "host 不被允许"}))
            return
        try:
            n = int(self.headers.get("Content-Length", 0))
        except ValueError:
            self._send(400, json.dumps({"ok": False, "error": "Content-Length 错误"}))
            return
        if n > MAX_POST_BYTES:
            self._send(413, json.dumps({"ok": False, "error": "请求体过大"}))
            return
        try:
            req = json.loads(self.rfile.read(n) or b"{}")
        except Exception:
            self._send(400, json.dumps({"ok": False, "error": "请求格式错误"}))
            return
        if req.get("token") != TOKEN:
            self._send(403, json.dumps({"ok": False, "error": "token 校验失败"}))
            return

        mode = req.get("mode")
        params = req.get("params", {})
        if not isinstance(params, dict):
            self._send(400, json.dumps({"ok": False, "error": "params 格式错误"}))
            return
        project_path = project_root(DATA)

        if mode == "fix":
            # Validate against allowlist
            matched = FIX_ALLOW.get(params.get("id"))
            if not matched:
                self._send(
                    403, json.dumps({"ok": False, "error": "修复操作不在白名单"})
                )
                return
            try:
                execute_fix(matched, project_path)
                self._send(200, json.dumps({"ok": True}))
            except Exception as e:
                self._send(500, json.dumps({"ok": False, "error": str(e)}))

        elif mode == "update_all":
            try:
                results = execute_update_all(DATA, project_path)
                self._send(
                    200,
                    json.dumps(
                        {
                            "ok": all(r.get("ok") for r in results),
                            "results": results,
                        }
                    ),
                )
            except Exception as e:
                self._send(500, json.dumps({"ok": False, "error": str(e)}))

        elif mode == "open":
            paths = params.get("paths", [])
            if isinstance(paths, str):
                paths = [paths]
            if not isinstance(paths, list):
                self._send(400, json.dumps({"ok": False, "error": "paths 格式错误"}))
                return
            for p in paths:
                # Resolve to project-relative or absolute
                try:
                    rp = resolve_project_path(project_path, p)
                except ValueError:
                    rp = ""
                if rp not in OPEN_ALLOW:
                    self._send(
                        403,
                        json.dumps({"ok": False, "error": "路径不在白名单：%s" % p}),
                    )
                    return
                try:
                    open_in_editor(rp)
                except Exception as e:
                    self._send(500, json.dumps({"ok": False, "error": str(e)}))
                    return
            self._send(200, json.dumps({"ok": True}))

        else:
            self._send(400, json.dumps({"ok": False, "error": "未知操作: %s" % mode}))


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    args = parse_args(sys.argv[1:])
    global DATA, TPL, FIX_ALLOW, OPEN_ALLOW
    DATA, TPL, FIX_ALLOW, OPEN_ALLOW = load(args.analysis_json)
    srv = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    port = srv.server_address[1]
    url = "http://127.0.0.1:%d/" % port
    print("安全报告服务已启动：" + url)
    print(
        "可修复 %d 项 | 可打开 %d 个文件 | 页面上点" % (len(FIX_ALLOW), len(OPEN_ALLOW))
    )
    print("用完按 Ctrl+C 停止服务（服务关掉后按钮即失效）")
    if args.no_open:
        print("已按 --no-open 跳过自动打开浏览器")
    elif not open_browser_once(url, args.analysis_json):
        print("同一报告刚刚已自动打开，本次只打印 URL，避免重复打开标签页")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print("\n已停止服务。")


if __name__ == "__main__":
    main()
