#!/usr/bin/env python3
"""Serve the VibeGuard security report as a read-only local page.

Starts on 127.0.0.1 + a random port and opens the report after all report
artifacts are ready. The page does not execute fixes; after the user reviews
the report and confirms in chat, the agent should stop this server and perform
approved fixes from the terminal.

Usage:
    server.py <analysis.json>
    server.py --no-open <analysis.json>
"""

import argparse
import hashlib
import json
import os
import tempfile
import time
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HERE = os.path.dirname(os.path.abspath(__file__))
TEMPLATE = os.path.join(HERE, "..", "assets", "report_template.html")
AUTO_OPEN_COOLDOWN_SECONDS = 60

DATA = {}
TPL = ""


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
    parser = argparse.ArgumentParser(description="Serve a read-only VibeGuard report")
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


def load(src):
    with open(src, encoding="utf-8") as f:
        data = json.load(f)
    with open(TEMPLATE, encoding="utf-8") as f:
        tpl = f.read()

    data.setdefault("project", {})
    data["project"]["path"] = project_root(data)

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

    return data, tpl


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
            html = TPL.replace("__REPORT_DATA__", blob)
            self._send(200, html, "text/html; charset=utf-8")
        else:
            self._send(404, "not found", "text/plain")

    def do_POST(self):
        self._send(404, json.dumps({"ok": False, "error": "read-only report"}))


def main():
    args = parse_args(os.sys.argv[1:])
    global DATA, TPL
    DATA, TPL = load(args.analysis_json)
    srv = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    port = srv.server_address[1]
    url = "http://127.0.0.1:%d/" % port
    print("报告已生成：" + url)
    if args.no_open:
        print("已按 --no-open 跳过自动打开浏览器")
    elif open_browser_once(url, args.analysis_json):
        print("报告已自动打开，请先在网页查看内容。")
    else:
        print("同一报告刚刚已自动打开，本次只打印 URL，避免重复打开标签页")
    print("看完确认要修复后，在对话里回复：同意 / 修复 / OK / Yes。")
    print("确认后会先关闭本地报告服务，再按主要修复 → 次要修复处理。")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print("\n已停止服务。")


if __name__ == "__main__":
    main()
