#!/usr/bin/env python3
"""Inject analysis JSON into the HTML template -> a standalone security report.

Usage:
    build_report.py <analysis.json> [output.html]

The analysis JSON is produced by the agent after interpreting scan.py output.
Schema (all sections optional except project):

{
  "generated_at": "2026-06-02 12:00:00",
  "scan_seconds": 3.2,
  "project": {
    "path": "/path/to/project",
    "name": "my-project",
    "ecosystems": ["npm"],
    "lockfiles": ["package-lock.json"],
    "git_repo": true,
    "git_branch": "main",
    "total_packages": 142,
    "total_vulnerabilities": 5
  },
  "risk_summary": { "critical": 0, "high": 2, "medium": 3, "low": 1, "info": 0 },
  "hygiene": {
    "gitignore_exists": true,
    "gitignore_missing": [".env", "*.pem"],
    "tracked_secrets": [{ "file": "src/config.ts", "line": 12, "type": "generic_api_key", "preview": "api_key=***" }],
    "sensitive_tracked": [{ "file": ".env", "type": "env_file", "size": 128 }]
  },
  "outdated": [{ "package": "react", "current": "18.2.0", "latest": "19.1.0", "ecosystem": "npm" }],
  "top_issues": [{ "rank": 1, "tier": "red|yellow|green", "severity": "critical|high|medium|low|info",
                   "package": "name", "version": "1.0.0", "advisory_id": "GHSA-xxx",
                   "summary": "一句普通用户能看懂的风险说明，不要堆 CVE/GHSA 编号" }],
  "green": [{
    "name": "升级 next 到 15.5.2",
    "type": "dependency_upgrade",          // dependency_upgrade | gitignore_fix | git_rm_cached
    "severity": "high",
    "summary": "...",
    "fix_commands": [{ "label": "升级 next", "cmd": "npm install next@>=15.5.2" }],
    "fix_config": {                        // 供 agent 在用户确认后执行；网页不直接执行
      "type": "upgrade",                   // upgrade | gitignore | git_rm_cached
      "ecosystem": "npm", "manager": "npm",
      "package": "next", "version": "15.5.2"
    }
  }],
  "yellow": [{
    "name": "硬编码 API Key",
    "type": "secret_exposure",
    "severity": "high",
    "path": "src/config.ts",               // 用于定位源文件
    "file": "src/config.ts",
    "content_profile": "文件描述",
    "why_manual": "为什么需要人工判断",
    "disposal": "处置路径",
    "risk": "风险提示",
    "fix_commands": [{ "label": "...", "cmd": "..." }]
  }],
  "red": [{
    "name": "密钥已入 git 历史",
    "type": "secret_in_history",
    "severity": "critical",
    "path": ".env.production",
    "why_keep": "为什么需要专业处理",
    "indirect_release": "具体处理步骤",
    "risk": "风险说明"
  }],
  "summary": {                              // 必填；网页也会兜底生成，但 agent 应主动写
    "tldr": "一句话摘要，给产品经理快速判断是否影响发布；不要写 critical/medium/CVE/GHSA 列表",
    "detail": "更完整的报告总结，用普通人能看懂的语言解释风险范围、是否需要马上安排、谁来确认；证据编号留给漏洞表。",
    "tier_stats": { "green": "3 项可由 agent 处理", "yellow": "2 项需人工判断", "red": "1 项高危" },
    "priority": ["1. ...", "2. ..."]
  }
}
"""

import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
TEMPLATE = os.path.join(HERE, "..", "assets", "report_template.html")


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


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    src = sys.argv[1]
    out = (
        sys.argv[2]
        if len(sys.argv) > 2
        else os.path.expanduser("~/Desktop/security-report.html")
    )

    with open(src, "r", encoding="utf-8") as f:
        data = json.load(f)
    with open(TEMPLATE, "r", encoding="utf-8") as f:
        tpl = f.read()

    blob = json_for_script(data)
    html = tpl.replace("__REPORT_DATA__", blob)

    with open(out, "w", encoding="utf-8") as f:
        f.write(html)
    print(f"报告已生成: {out}")
    print(f"只读 HTML 已生成，可按需打开: open '{out}'")


if __name__ == "__main__":
    main()
