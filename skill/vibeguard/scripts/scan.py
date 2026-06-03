#!/usr/bin/env python3
"""VibeGuard 项目安全扫描器（只读）

采集安全相关数据，输出 JSON 供 agent 分析分级：
  1. 仓库卫生检查（gitignore、敏感文件追踪、硬编码密钥）
  2. 依赖生态识别和包坐标提取
  3. 调用 VibeGuard API 检查漏洞
  4. 过旧依赖检查

STRICTLY READ-ONLY: 只读文件、运行只读命令，不修改任何内容。

Usage:
    python3 scan.py [project_path]              # 默认向上识别项目根目录
    python3 scan.py --no-root-discovery <path>  # 严格扫描传入目录
    python3 scan.py                             # 等同于 python3 scan.py .

VibeGuard API (https://vibeguard.ou.al):
  POST /api/security/check/packages       批量检查漏洞（100个一批）
  GET  /api/security/check/overview        漏洞数据概览
  GET  /api/security/advisories            结构化漏洞公告（可按包/CVE/KEV/CVSS筛选）
  GET  /api/security/advisories/{id}       单条公告详情（GHSA/MAL/OSV）
  GET  /api/security/packages/{eco}/{name} 包风险画像和推荐修复版本
  GET  /api/security/cves/{cveId}          CVE 详情（CVSS/CWE/EPSS/CISA KEV）
  GET  /api/security/sync/status           数据源同步状态
  GET  /api/articles                       安全资讯、漏洞解读、供应链事件
  GET  /api/articles/{id}                  单篇文章详情

  包检查请求: {"packages": [{"ecosystem":"npm","name":"next","version":"15.5.1"}]}
  支持 4 种生态: npm (含 pnpm/yarn), pypi, go, crates-io
  查询参数: q=关键词, lang=zh, limit=N, ecosystem, riskCategory, tag
"""

import argparse
import json
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request

API_BASE = "https://vibeguard.ou.al"

# ---------------------------------------------------------------------------
# Secret detection patterns
# ---------------------------------------------------------------------------
SECRET_PATTERNS = [
    ("aws_access_key", r"AKIA[0-9A-Z]{16}"),
    ("private_key", r"-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----"),
    ("slack_token", r"xox[baprs]-[A-Za-z0-9-]+"),
    ("github_token", r"gh[pousr]_[A-Za-z0-9_]{36,}"),
    ("openai_key", r"sk-(?:proj-)?[A-Za-z0-9_-]{20,}"),
    ("generic_password", r"""(?:password|passwd|pwd)\s*[:=]\s*["'][^"']{4,}["']"""),
    (
        "generic_api_key",
        r"""(?:api[_-]?key|apikey|secret[_-]?key)\s*[:=]\s*["'][^"']{8,}["']""",
    ),
]

SENSITIVE_FILE_PATTERNS = [
    r"(^|/)\.env(\.[\w-]+)?$",
    r"\.(pem|key|p12|pfx|jks|keystore)$",
    r"\.(sqlite|sqlite3|db|dump)$",
    r"\.log$",
    r"(^|/)credentials\.json$",
    r"(^|/)service-account.*\.json$",
    r"(^|/)id_(rsa|ed25519|ecdsa)$",
]

ENV_TEMPLATE_SUFFIXES = (".example", ".sample", ".template", ".dist")

# 敏感文件类型 → 对应的 .gitignore 规则（只按实际发现的文件推荐，不一股脑全加）
SENSITIVE_TO_GITIGNORE = {
    "env_file":       [".env", ".env.*"],
    "private_key":    ["*.pem", "*.key", "*.p12", "*.pfx", "*.jks", "*.keystore"],
    "database":       ["*.sqlite", "*.sqlite3", "*.db", "*.dump"],
    "credentials":    ["credentials.json", "service-account*.json"],
    "ssh_key":        ["id_rsa", "id_ed25519", "id_ecdsa"],
    "log":            ["*.log"],
}

EXCLUDE_DIRS = {
    ".git",
    "node_modules",
    ".next",
    "dist",
    "build",
    "coverage",
    "__pycache__",
    ".venv",
    "venv",
    ".idea",
    ".vscode",
    "target",
    "vendor",
    "bower_components",
    ".cache",
    ".tox",
    ".eggs",
    ".cargo",
    ".npm",
    ".pnpm-store",
    ".yarn",
}

SCAN_EXTENSIONS = {
    ".py",
    ".js",
    ".ts",
    ".jsx",
    ".tsx",
    ".mjs",
    ".cjs",
    ".go",
    ".rs",
    ".rb",
    ".php",
    ".java",
    ".kt",
    ".swift",
    ".c",
    ".cpp",
    ".h",
    ".hpp",
    ".cs",
    ".yaml",
    ".yml",
    ".toml",
    ".ini",
    ".cfg",
    ".conf",
    ".sh",
    ".bash",
    ".zsh",
    ".fish",
    ".html",
    ".css",
    ".scss",
    ".less",
}

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def run_cmd(cmd, timeout=60, cwd=None):
    try:
        r = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout,
            cwd=cwd,
            stdin=subprocess.DEVNULL,
        )
        return r.stdout.strip()
    except Exception:
        return ""


def run_cmd_checked(cmd, timeout=60, cwd=None, errors=None, step="command"):
    try:
        r = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout,
            cwd=cwd,
            stdin=subprocess.DEVNULL,
        )
    except FileNotFoundError:
        if errors is not None:
            errors.append({"step": step, "message": f"命令不可用：{cmd[0]}"})
        return ""
    except subprocess.TimeoutExpired:
        if errors is not None:
            errors.append({"step": step, "message": f"命令超时：{' '.join(cmd)}"})
        return ""
    except OSError as e:
        if errors is not None:
            errors.append({"step": step, "message": f"命令执行失败：{' '.join(cmd)}: {e}"})
        return ""

    stdout = r.stdout.strip()
    if r.returncode != 0 and not stdout:
        if errors is not None:
            msg = (r.stderr or "无 stderr 输出").strip()
            errors.append({"step": step, "message": f"{' '.join(cmd)} 失败：{msg}"})
        return ""
    return stdout


def gitignore_rules(content):
    rules = set()
    for line in content.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        rules.add(line.lower().rstrip("/"))
    return rules


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


def find_project_root(start_path="."):
    """Walk up to find .git or a recognizable manifest."""
    path = os.path.abspath(start_path)
    for _ in range(20):
        if os.path.isdir(os.path.join(path, ".git")):
            return path
        parent = os.path.dirname(path)
        if parent == path:
            break
        path = parent
    path = os.path.abspath(start_path)
    for _ in range(20):
        if any(
            os.path.isfile(os.path.join(path, f))
            for f in [
                "package.json",
                "pyproject.toml",
                "go.mod",
                "Cargo.toml",
                "requirements.txt",
                "composer.json",
                "Gemfile",
            ]
        ):
            return path
        parent = os.path.dirname(path)
        if parent == path:
            break
        path = parent
    return os.path.abspath(start_path)


def is_env_template(path):
    name = os.path.basename(path).lower()
    return name.startswith(".env") and (
        name in {".env.example", ".env.sample", ".env.template", ".env.dist"}
        or name.endswith(ENV_TEMPLATE_SUFFIXES)
    )


def is_git_worktree(path):
    return run_cmd(["git", "rev-parse", "--is-inside-work-tree"], cwd=path) == "true"


# ---------------------------------------------------------------------------
# Step 1: Repository hygiene
# ---------------------------------------------------------------------------


def check_gitignore(project_path, sensitive_tracked):
    """Check .gitignore: only recommend rules for sensitive file types actually found."""
    gitignore_path = os.path.join(project_path, ".gitignore")
    gitignore_exists = os.path.isfile(gitignore_path)
    if not gitignore_exists:
        content = ""
    else:
        with open(gitignore_path, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read()

    # Collect types of sensitive files actually found in the project
    found_types = set()
    for item in sensitive_tracked:
        found_types.add(item.get("type", ""))
    # Also check if .env files exist (even if not tracked)
    for name in (".env", ".env.local", ".env.production", ".env.development"):
        if os.path.isfile(os.path.join(project_path, name)):
            found_types.add("env_file")

    missing = []
    for ftype, patterns in SENSITIVE_TO_GITIGNORE.items():
        if ftype not in found_types:
            continue
        for pat in patterns:
            if not gitignore_ignores(content, pat):
                missing.append(pat)
    return gitignore_exists, missing


def check_sensitive_tracked(project_path):
    output = run_cmd(["git", "ls-files"], cwd=project_path)
    if not output:
        return []
    findings = []
    for f in output.split("\n"):
        if not f.strip():
            continue
        if is_env_template(f):
            continue
        for pat in SENSITIVE_FILE_PATTERNS:
            if re.search(pat, f):
                full = os.path.join(project_path, f)
                size = 0
                try:
                    size = os.path.getsize(full)
                except OSError:
                    pass
                ftype = "sensitive_file"
                if re.search(r"(^|/)\.env(\.[\w-]+)?$", f):
                    ftype = "env_file"
                elif re.search(r"\.(pem|key|p12|pfx|jks|keystore)$", f):
                    ftype = "private_key"
                elif re.search(r"\.(sqlite|sqlite3|db|dump)$", f):
                    ftype = "database"
                elif re.search(r"\.log$", f):
                    ftype = "log"
                elif re.search(r"(^|/)credentials\.json$", f) or re.search(
                    r"(^|/)service-account.*\.json$", f
                ):
                    ftype = "credentials"
                elif re.search(r"(^|/)id_(rsa|ed25519|ecdsa)$", f):
                    ftype = "ssh_key"
                findings.append({"file": f, "type": ftype, "size": size})
                break
    return findings


def scan_secrets(project_path, max_files=500, max_bytes=1024 * 1024):
    findings = []
    count = 0
    for root, dirs, files in os.walk(project_path):
        dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS and not d.startswith(".")]
        for fname in files:
            if count >= max_files:
                return findings
            ext = os.path.splitext(fname)[1].lower()
            if ext not in SCAN_EXTENSIONS and fname not in {".env", ".envrc"}:
                continue
            fpath = os.path.join(root, fname)
            try:
                if os.path.getsize(fpath) > max_bytes:
                    continue
                with open(fpath, "r", encoding="utf-8", errors="ignore") as f:
                    for line_num, line in enumerate(f, 1):
                        stripped = line.strip()
                        if stripped.startswith("#") or stripped.startswith("//"):
                            continue
                        if any(
                            x in stripped.lower()
                            for x in [
                                "example",
                                "placeholder",
                                "your_",
                                "xxx",
                                "todo",
                                "sample",
                            ]
                        ):
                            continue
                        for secret_type, pattern in SECRET_PATTERNS:
                            m = re.search(pattern, line)
                            if m:
                                preview = m.group(0)
                                if len(preview) > 30:
                                    preview = preview[:15] + "..." + preview[-10:]
                                rel = os.path.relpath(fpath, project_path)
                                findings.append(
                                    {
                                        "file": rel,
                                        "line": line_num,
                                        "type": secret_type,
                                        "preview": preview,
                                        "confidence": "high"
                                        if secret_type
                                        in (
                                            "aws_access_key",
                                            "private_key",
                                            "slack_token",
                                            "github_token",
                                        )
                                        else "medium",
                                    }
                                )
            except (OSError, UnicodeDecodeError):
                continue
            count += 1
    return findings


def scan_hygiene(project_path):
    # Scan sensitive files first, then use findings to drive gitignore recommendations
    sensitive_tracked = check_sensitive_tracked(project_path)
    tracked_secrets = scan_secrets(project_path)
    gitignore_exists, gitignore_missing = check_gitignore(project_path, sensitive_tracked)
    return {
        "gitignore_exists": gitignore_exists,
        "gitignore_missing": gitignore_missing,
        "tracked_secrets": tracked_secrets,
        "sensitive_tracked": sensitive_tracked,
    }


# ---------------------------------------------------------------------------
# Step 2: Ecosystem detection & package extraction
# ---------------------------------------------------------------------------

LOCKFILE_MAP = {
    "npm": ["package-lock.json"],
    "pnpm": ["pnpm-lock.yaml"],
    "yarn": ["yarn.lock"],
    "pypi": ["poetry.lock", "uv.lock", "requirements.txt", "Pipfile.lock"],
    "go": ["go.sum"],
    "crates-io": ["Cargo.lock"],
}


def detect_ecosystems(project_path):
    ecosystems, lockfiles = [], {}
    for eco, names in LOCKFILE_MAP.items():
        for lf in names:
            if os.path.isfile(os.path.join(project_path, lf)):
                ecosystems.append(eco)
                lockfiles[eco] = lf
                break
    return ecosystems, lockfiles


def _tomllib():
    try:
        import tomllib

        return tomllib
    except ImportError:
        return None


# --- npm ---


def parse_npm_lock(project_path):
    path = os.path.join(project_path, "package-lock.json")
    if not os.path.isfile(path):
        return []
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except (json.JSONDecodeError, OSError):
        return []
    pkgs = []
    deps = data.get("dependencies") or data.get("packages") or {}
    if "dependencies" in data:
        for name, info in deps.items():
            pkgs.append(
                {
                    "ecosystem": "npm",
                    "name": name,
                    "version": info.get("version", ""),
                    "is_direct": False,
                    "source": "package-lock.json",
                }
            )
    else:
        for key, info in deps.items():
            if not key:
                continue
            name = key.removeprefix("node_modules/")
            if not name or name == key:
                continue
            pkgs.append(
                {
                    "ecosystem": "npm",
                    "name": name,
                    "version": info.get("version", ""),
                    "is_direct": not info.get("dev", True) and not info.get("resolved"),
                    "source": "package-lock.json",
                }
            )
    return pkgs


# --- pnpm ---


def parse_pnpm_lock(project_path):
    path = os.path.join(project_path, "pnpm-lock.yaml")
    if not os.path.isfile(path):
        return []
    try:
        with open(path, "r", encoding="utf-8") as f:
            content = f.read()
    except OSError:
        return []
    pkgs, seen = [], set()
    # pnpm v9: packages section uses "'@scope/name@version':" or "name@version:"
    in_packages = False
    for line in content.split("\n"):
        stripped = line.rstrip()
        if stripped == "packages:":
            in_packages = True
            continue
        if in_packages:
            # Lines starting with 2+ spaces are package entries
            m = re.match(r"^  (?:'([^']+)'|([^:\s]+)):", stripped)
            if m:
                entry = (m.group(1) or m.group(2)).lstrip("/")
                entry = entry.split("(", 1)[0]
                # Parse "name@version" from entry (may include @scope)
                pm = re.match(r"^(.+?)@(\d[^@]*)$", entry)
                if pm:
                    name, ver = pm.group(1).strip("'\""), pm.group(2)
                    if (name, ver) not in seen:
                        seen.add((name, ver))
                        pkgs.append(
                            {
                                "ecosystem": "npm",
                                "name": name,
                                "version": ver,
                                "is_direct": False,
                                "source": "pnpm-lock.yaml",
                            }
                        )
            elif stripped and not stripped.startswith("  "):
                in_packages = False
    # Fallback: older format with importers
    if not pkgs:
        for m in re.finditer(
            r"^\s+['\"/]([^@'\"/]+)@([^'\"/:]+)", content, re.MULTILINE
        ):
            name, ver = m.group(1), m.group(2)
            if (name, ver) not in seen:
                seen.add((name, ver))
                pkgs.append(
                    {
                        "ecosystem": "npm",
                        "name": name,
                        "version": ver,
                        "is_direct": False,
                        "source": "pnpm-lock.yaml",
                    }
                )
    return pkgs


# --- yarn ---


def parse_yarn_lock(project_path):
    path = os.path.join(project_path, "yarn.lock")
    if not os.path.isfile(path):
        return []
    try:
        with open(path, "r", encoding="utf-8") as f:
            content = f.read()
    except OSError:
        return []
    pkgs, seen = [], set()
    current_names = []
    for raw in content.splitlines():
        line = raw.rstrip()
        if not line or line.startswith("#"):
            continue
        if not line.startswith(" ") and line.endswith(":"):
            header = line[:-1].strip().strip('"')
            current_names = []
            for desc in re.split(r',\s*', header):
                desc = desc.strip().strip('"')
                name = yarn_descriptor_name(desc)
                if name and name not in current_names:
                    current_names.append(name)
            continue
        if current_names:
            m = re.match(r'\s+version\s+"([^"]+)"', line)
            if not m:
                continue
            ver = m.group(1)
            for name in current_names:
                if (name, ver) not in seen:
                    seen.add((name, ver))
                    pkgs.append(
                        {
                            "ecosystem": "npm",
                            "name": name,
                            "version": ver,
                            "is_direct": False,
                            "source": "yarn.lock",
                        }
                    )
            current_names = []
    return pkgs


def yarn_descriptor_name(desc):
    if not desc:
        return ""
    if desc.startswith("@"):
        parts = desc.split("@")
        if len(parts) >= 3:
            return "@" + parts[1]
        return desc
    return desc.split("@", 1)[0]


# --- Python ---


def parse_requirements_txt(project_path):
    path = os.path.join(project_path, "requirements.txt")
    if not os.path.isfile(path):
        return []
    pkgs = []
    try:
        with open(path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or line.startswith("-"):
                    continue
                line = line.split(";", 1)[0].strip()
                m = re.match(
                    r"^([A-Za-z0-9_.-]+)(?:\[[^\]]+\])?\s*([=~><!]{1,2})\s*([0-9][0-9A-Za-z.*+!_-]*)",
                    line,
                )
                if m:
                    pkgs.append(
                        {
                            "ecosystem": "pypi",
                            "name": m.group(1).lower(),
                            "version": m.group(3),
                            "specifier": m.group(2),
                            "is_direct": True,
                            "source": "requirements.txt",
                        }
                    )
    except OSError:
        pass
    return pkgs


def _parse_toml_lock(path, source_name):
    tl = _tomllib()
    if not tl:
        return _parse_toml_lock_fallback(path, source_name)
    try:
        with open(path, "rb") as f:
            data = tl.load(f)
    except Exception:
        return []
    pkgs = []
    for pkg in data.get("package", []):
        pkgs.append(
            {
                "ecosystem": "pypi",
                "name": pkg.get("name", "").lower(),
                "version": pkg.get("version", ""),
                "is_direct": False,
                "source": source_name,
            }
        )
    return pkgs


def _parse_toml_lock_fallback(path, source_name):
    pkgs = []
    try:
        with open(path, "r", encoding="utf-8") as f:
            content = f.read()
    except OSError:
        return []
    for m in re.finditer(
        r'\[\[package\]\]\s*\nname\s*=\s*"([^"]+)"\s*\nversion\s*=\s*"([^"]+)"', content
    ):
        pkgs.append(
            {
                "ecosystem": "pypi",
                "name": m.group(1).lower(),
                "version": m.group(2),
                "is_direct": False,
                "source": source_name,
            }
        )
    return pkgs


def parse_poetry_lock(project_path):
    path = os.path.join(project_path, "poetry.lock")
    return _parse_toml_lock(path, "poetry.lock") if os.path.isfile(path) else []


def parse_uv_lock(project_path):
    path = os.path.join(project_path, "uv.lock")
    return _parse_toml_lock(path, "uv.lock") if os.path.isfile(path) else []


def parse_pypi(project_path):
    pkgs = []
    for parser in (parse_poetry_lock, parse_uv_lock, parse_requirements_txt):
        pkgs.extend(parser(project_path))
    return pkgs


# --- Go ---


def parse_go_sum(project_path):
    path = os.path.join(project_path, "go.sum")
    if not os.path.isfile(path):
        return []
    pkgs, seen = [], set()
    try:
        with open(path, "r", encoding="utf-8") as f:
            for line in f:
                parts = line.strip().split()
                if len(parts) >= 2:
                    name, ver = parts[0], parts[1].split("/")[0]
                    if (name, ver) not in seen:
                        seen.add((name, ver))
                        pkgs.append(
                            {
                                "ecosystem": "go",
                                "name": name,
                                "version": ver,
                                "is_direct": False,
                                "source": "go.sum",
                            }
                        )
    except OSError:
        pass
    return pkgs


# --- Rust ---


def parse_cargo_lock(project_path):
    path = os.path.join(project_path, "Cargo.lock")
    if not os.path.isfile(path):
        return []
    tl = _tomllib()
    if not tl:
        return _parse_cargo_lock_fallback(path)
    try:
        with open(path, "rb") as f:
            data = tl.load(f)
    except Exception:
        return []
    pkgs = []
    for pkg in data.get("package", []):
        if pkg.get("source"):
            pkgs.append(
                {
                    "ecosystem": "crates-io",
                    "name": pkg.get("name", ""),
                    "version": pkg.get("version", ""),
                    "is_direct": False,
                    "source": "Cargo.lock",
                }
            )
    return pkgs


def _parse_cargo_lock_fallback(path):
    pkgs = []
    try:
        with open(path, "r", encoding="utf-8") as f:
            content = f.read()
    except OSError:
        return []
    for m in re.finditer(
        r'\[\[package\]\]\s*\nname\s*=\s*"([^"]+)"\s*\nversion\s*=\s*"([^"]+)"\s*\nsource\s*=\s*"([^"]+)"',
        content,
    ):
        pkgs.append(
            {
                "ecosystem": "crates-io",
                "name": m.group(1),
                "version": m.group(2),
                "is_direct": False,
                "source": "Cargo.lock",
            }
        )
    return pkgs


PARSERS = {
    "npm": parse_npm_lock,
    "pnpm": parse_pnpm_lock,
    "yarn": parse_yarn_lock,
    "pypi": parse_pypi,
    "go": parse_go_sum,
    "crates-io": parse_cargo_lock,
}


def extract_packages(project_path, ecosystems):
    all_pkgs, seen = [], set()
    for eco in ecosystems:
        parser = PARSERS.get(eco)
        if not parser:
            continue
        for pkg in parser(project_path):
            key = (pkg["ecosystem"], pkg["name"], pkg["version"])
            if key not in seen:
                seen.add(key)
                all_pkgs.append(pkg)
    return all_pkgs


# ---------------------------------------------------------------------------
# Step 3: Vulnerability check via VibeGuard API
# ---------------------------------------------------------------------------


def _cvss_to_severity(vector):
    """Parse CVSS vector string → severity level using impact metrics.

    Uses a simplified heuristic based on C/I/A impact values:
    - Any impact = H (High) → critical if AV:N (network), else high
    - All impacts = L (Low) → medium
    - No impact → low
    Falls back to None if vector can't be parsed.
    """
    if not vector or "CVSS:" not in vector:
        return None
    try:
        parts = {}
        for pair in vector.split("/"):
            if ":" in pair and not pair.startswith("CVSS:"):
                k, v = pair.split(":", 1)
                parts[k] = v
        c = parts.get("C", "N")
        i = parts.get("I", "N")
        a = parts.get("A", "N")
        av = parts.get("AV", "N")
        # Check for high impact (H) on any CIA
        cia = [c, i, a]
        if any(x == "H" for x in cia):
            return "critical" if av == "N" else "high"
        # Check for low impact (L) on any CIA
        if any(x == "L" for x in cia):
            return "medium"
        # No real impact
        return "low"
    except Exception:
        return None


def best_advisory_alias(aliases):
    aliases = [a for a in aliases if a]
    for alias in aliases:
        if str(alias).upper().startswith("CVE-"):
            return alias
    for alias in aliases:
        if not str(alias).upper().startswith("GHSA-"):
            return alias
    return aliases[0] if aliases else ""


def post_json(url, payload, timeout=120):
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        raw = resp.read().decode("utf-8")
    return json.loads(raw)


def check_vulnerabilities(packages, batch_size=100, errors=None):
    if not packages:
        return []
    if errors is None:
        errors = []
    vulns = []
    for i in range(0, len(packages), batch_size):
        batch = packages[i : i + batch_size]
        payload = {
            "packages": [
                {
                    "ecosystem": p["ecosystem"],
                    "name": p["name"],
                    "version": p["version"],
                }
                for p in batch
            ]
        }
        batch_no = i // batch_size + 1
        try:
            data = post_json(f"{API_BASE}/api/security/check/packages", payload)
        except urllib.error.HTTPError as e:
            errors.append(
                {
                    "step": "vulnerability_check",
                    "message": f"第 {batch_no} 批 API 返回 HTTP {e.code}",
                }
            )
            continue
        except urllib.error.URLError as e:
            errors.append(
                {
                    "step": "vulnerability_check",
                    "message": f"第 {batch_no} 批 API 连接失败：{e.reason}",
                }
            )
            continue
        except (json.JSONDecodeError, TimeoutError, OSError) as e:
            errors.append(
                {
                    "step": "vulnerability_check",
                    "message": f"第 {batch_no} 批 API 响应解析失败：{e}",
                }
            )
            continue
        # API returns { meta, findings: [...] }
        for item in data.get("findings", []):
            if not item.get("affected"):
                continue
            adv = item.get("advisory") or {}
            ap = item.get("affectedPackage") or {}
            pkg = item.get("package") or {}
            risk = item.get("risk") or {}
            aliases = adv.get("aliases") or []
            # Severity: prefer CVSS-based level, fallback to risk.level
            # Parse CVSS vector to estimate severity level from impact metrics
            cvss_vector = ""
            cvss = None
            for s in adv.get("severity") or []:
                if s.get("score"):
                    cvss = s["score"]
                    cvss_vector = s["score"]
                    break
            sev = _cvss_to_severity(cvss_vector) or risk.get("level", "unknown")
            # Extract fixed versions
            fixed = ap.get("fixedVersions") or []
            vulns.append(
                {
                    "package": pkg.get("name", ""),
                    "version": pkg.get("version", ""),
                    "ecosystem": pkg.get("ecosystem", ""),
                    "affected": True,
                    "match_reason": item.get("matchReason", ""),
                    "match_summary": item.get("matchSummary", ""),
                    "confidence": item.get("confidence", ""),
                    "advisory_id": adv.get("id", ""),
                    "aliases": aliases,
                    "cve_id": best_advisory_alias(aliases),
                    "severity": sev,
                    "cvss": cvss,
                    "fixed_versions": fixed,
                    "summary": adv.get("summary", ""),
                    "risk_signals": risk.get("signals", []),
                }
            )
    return vulns


# ---------------------------------------------------------------------------
# Step 4: Outdated check
# ---------------------------------------------------------------------------


def check_outdated(project_path, ecosystems, errors=None):
    outdated = []
    if "npm" in ecosystems:
        outdated.extend(
            _outdated_json("npm", ["npm", "outdated", "--json"], project_path, errors)
        )
    if "pnpm" in ecosystems:
        outdated.extend(
            _outdated_json("npm", ["pnpm", "outdated", "--json"], project_path, errors)
        )
    if "yarn" in ecosystems:
        outdated.extend(_yarn_outdated(project_path, errors))
    if "pypi" in ecosystems:
        outdated.extend(_pip_outdated(project_path, errors))
    if "go" in ecosystems:
        outdated.extend(_go_outdated(project_path, errors))
    if "crates-io" in ecosystems:
        outdated.extend(_cargo_outdated(project_path, errors))
    return outdated


def _outdated_json(eco, cmd, cwd, errors=None):
    output = run_cmd_checked(cmd, cwd=cwd, timeout=60, errors=errors, step="outdated_check")
    if not output:
        return []
    try:
        data = json.loads(output)
    except json.JSONDecodeError:
        if errors is not None:
            errors.append({"step": "outdated_check", "message": f"{cmd[0]} outdated 输出不是有效 JSON"})
        return []
    if isinstance(data, list):
        return [
            {
                "package": p.get("name") or p.get("packageName", ""),
                "current": p.get("current", ""),
                "latest": p.get("latest", ""),
                "ecosystem": eco,
            }
            for p in data
        ]
    return [
        {
            "package": n,
            "current": v.get("current", ""),
            "latest": v.get("latest", ""),
            "ecosystem": eco,
        }
        for n, v in data.items()
    ]


def _yarn_outdated(cwd, errors=None):
    output = run_cmd_checked(
        ["yarn", "outdated", "--json"],
        cwd=cwd,
        timeout=60,
        errors=errors,
        step="outdated_check",
    )
    if not output:
        return []
    result = []
    for line in output.split("\n"):
        try:
            d = json.loads(line)
            if d.get("type") == "table":
                for row in d.get("data", {}).get("body", []):
                    if len(row) >= 4:
                        result.append(
                            {
                                "package": row[0],
                                "current": row[1],
                                "latest": row[3],
                                "ecosystem": "npm",
                            }
                        )
        except json.JSONDecodeError:
            continue
    return result


def _pip_outdated(cwd, errors=None):
    output = run_cmd_checked(
        [sys.executable, "-m", "pip", "list", "--outdated", "--format=json"],
        cwd=cwd,
        timeout=60,
        errors=errors,
        step="outdated_check",
    )
    if not output:
        return []
    try:
        data = json.loads(output)
    except json.JSONDecodeError:
        if errors is not None:
            errors.append({"step": "outdated_check", "message": "pip list --outdated 输出不是有效 JSON"})
        return []
    return [
        {
            "package": p.get("name", ""),
            "current": p.get("version", ""),
            "latest": p.get("latest_version", ""),
            "ecosystem": "pypi",
        }
        for p in data
    ]


def _go_outdated(cwd, errors=None):
    output = run_cmd_checked(
        ["go", "list", "-u", "-m", "-json", "all"],
        cwd=cwd,
        timeout=120,
        errors=errors,
        step="outdated_check",
    )
    if not output:
        return []
    result = []
    for d in iter_json_objects(output):
        if d.get("Update"):
            result.append(
                {
                    "package": d.get("Path", ""),
                    "current": d.get("Version", ""),
                    "latest": d["Update"].get("Version", ""),
                    "ecosystem": "go",
                }
            )
    return result


def iter_json_objects(text):
    decoder = json.JSONDecoder()
    pos = 0
    length = len(text)
    while pos < length:
        while pos < length and text[pos].isspace():
            pos += 1
        if pos >= length:
            break
        try:
            obj, pos = decoder.raw_decode(text, pos)
        except json.JSONDecodeError:
            break
        if isinstance(obj, dict):
            yield obj


def _cargo_outdated(cwd, errors=None):
    output = run_cmd_checked(
        ["cargo", "outdated"],
        cwd=cwd,
        timeout=120,
        errors=errors,
        step="outdated_check",
    )
    if not output:
        return []
    result = []
    for line in output.split("\n"):
        parts = line.split()
        if len(parts) >= 3 and parts[0] != "Name":
            result.append(
                {
                    "package": parts[0],
                    "current": parts[1],
                    "latest": parts[-1],
                    "ecosystem": "crates-io",
                }
            )
    return result


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def parse_args(argv):
    parser = argparse.ArgumentParser(description="VibeGuard local project scanner")
    parser.add_argument("project_path", nargs="?", default=".")
    parser.add_argument(
        "--no-root-discovery",
        action="store_true",
        help="scan the provided path directly instead of walking up to a repo root",
    )
    return parser.parse_args(argv)


def main():
    started = time.time()
    args = parse_args(sys.argv[1:])
    start = args.project_path
    project_path = (
        os.path.abspath(start) if args.no_root_discovery else find_project_root(start)
    )
    errors = []

    # Step 1
    try:
        hygiene = scan_hygiene(project_path)
    except Exception as e:
        hygiene = {}
        errors.append({"step": "hygiene", "message": str(e)})

    # Step 2
    try:
        ecosystems, lockfiles = detect_ecosystems(project_path)
    except Exception as e:
        ecosystems, lockfiles = [], {}
        errors.append({"step": "ecosystem_detection", "message": str(e)})

    # Step 3
    try:
        packages = extract_packages(project_path, ecosystems)
    except Exception as e:
        packages = []
        errors.append({"step": "package_extraction", "message": str(e)})

    # Step 4
    try:
        vulnerabilities = check_vulnerabilities(packages, errors=errors)
    except Exception as e:
        vulnerabilities = []
        errors.append({"step": "vulnerability_check", "message": str(e)})

    # Step 5
    try:
        outdated = check_outdated(project_path, ecosystems, errors=errors)
    except Exception as e:
        outdated = []
        errors.append({"step": "outdated_check", "message": str(e)})

    git_repo = is_git_worktree(project_path)
    git_branch = (
        run_cmd(["git", "rev-parse", "--abbrev-ref", "HEAD"], cwd=project_path)
        if git_repo
        else ""
    )

    output = {
        "generated_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "scan_seconds": round(time.time() - started, 1),
        "project": {
            "path": project_path,
            "name": os.path.basename(project_path),
            "ecosystems": ecosystems,
            "lockfiles": list(lockfiles.values()),
            "git_repo": git_repo,
            "git_branch": git_branch or None,
            "total_packages": len(packages),
            "total_vulnerabilities": len(vulnerabilities),
        },
        "hygiene": hygiene,
        "packages": packages,
        "package_count": len(packages),
        "vulnerabilities": vulnerabilities,
        "vulnerability_count": len(vulnerabilities),
        "outdated": outdated,
        "outdated_count": len(outdated),
        "errors": errors,
    }
    print(json.dumps(output, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
