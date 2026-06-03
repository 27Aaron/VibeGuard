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
  "top_issues": [{ "rank": 1, "tier": "red|yellow|green", "severity": "critical|high|medium|low|info",
                   "package": "name", "version": "1.0.0", "advisory_id": "GHSA-xxx", "summary": "..." }],
  "green": [{
    "name": "升级 next 到 15.5.2",
    "type": "dependency_upgrade",          // dependency_upgrade | gitignore_fix | git_rm_cached
    "severity": "high",
    "summary": "...",
    "fix_commands": [{ "label": "升级 next", "cmd": "npm install next@>=15.5.2" }],
    "fix_config": {                        // 必须带，否则网页不出现修复按钮
      "type": "upgrade",                   // upgrade | gitignore | git_rm_cached
      "ecosystem": "npm", "manager": "npm",
      "package": "next", "version": "15.5.2"
    }
  }],
  "yellow": [{
    "name": "硬编码 API Key",
    "type": "secret_exposure",
    "severity": "high",
    "path": "src/config.ts",               // 用于"在编辑器打开"按钮
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
    "overview": "面向产品经理/项目负责人的一句话风险结论",
    "tier_stats": { "green": "3 项可自动修复", "yellow": "2 项需人工判断", "red": "1 项高危" },
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
    # 静态报告不带修复能力（FIX=null），修复按钮只在 server.py 服务时出现
    html = tpl.replace("__REPORT_DATA__", blob).replace("__FIX_CONFIG__", "null")

    with open(out, "w", encoding="utf-8") as f:
        f.write(html)
    print(f"报告已生成: {out}")
    print(f"只读 HTML 已生成，可按需打开: open '{out}'")


if __name__ == "__main__":
    main()
