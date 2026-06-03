---
name: vibeguard
description: VibeGuard 项目安全扫描助手，用于"帮我看看项目有没有安全问题"、"安全扫描"、"扫一下项目"、"依赖有没有漏洞"、"木马包"、"恶意包"、"硬编码密钥"、"API Key"、"token"、"env 是否误提交"、"gitignore 是否合理"、"依赖是否太旧"、漏洞检查、项目安全、供应链安全、安全报告、nginx/CVE/某个包有没有风险等场景；默认中文解释，保留 API 字段名、生态名、命令和版本号。
---

# VibeGuard 项目安全检查

对用户项目做一次只读安全扫描，产出安全报告和可交互的 HTML 报告。流程：扫描 → 分析分级 → 生成报告 → 打开。

## 核心边界

- 只在本地读取用户项目文件；不要上传源码、完整 lockfile、`.env`、私钥、证书、数据库、日志或任意项目文件。
- 调用 VibeGuard API 时，只发送最小必要信息：`ecosystem`、`name`、`version`。
- 不上传源码、lockfile、env 或密钥；报告里也不要泄露完整密钥，只能写文件、行号、类型和脱敏预览。
- 完整项目安全扫描必须先在当前工作目录的 `docs/` 下生成 Markdown 审计报告，例如 `docs/security-report-YYYY-MM-DD.md`。用户阅读报告后明确允许修复，才可以执行升级、删除缓存跟踪、修改 `.gitignore`、清理历史或轮换凭证相关操作。
- API 地址：`https://vibeguard.ou.al`。常用接口包括 `POST https://vibeguard.ou.al/api/security/check/packages`、`GET https://vibeguard.ou.al/api/security/advisories`、`GET https://vibeguard.ou.al/api/security/packages/{ecosystem}/{name}`、`GET https://vibeguard.ou.al/api/security/cves/{cveId}`、`GET https://vibeguard.ou.al/api/security/sync/status`。

## 铁律

- **全程只读。** scan.py 只读文件、调 API，不修改任何项目内容。
- **修复操作需确认。** 报告里的修复按钮由 server.py 执行，每次操作前浏览器会弹 confirm。即使用户在对话里说"帮我修"，也要先让用户阅读报告并明确允许。
- **不要把"依赖过旧"说成"存在漏洞"。** 只有命中漏洞数据时才说有漏洞。
- **不要制造恐慌。** 没有证据时说"不确定"，不要说"肯定安全"或"肯定中招"。

## 执行流程

### Step 1 扫描（Python 脚本，全自动）

```bash
# macOS / Linux
python3 scripts/scan.py [project_path] > /tmp/vibeguard_scan.json
# 严格只扫指定目录，不向上识别 git 根目录：
python3 scripts/scan.py --no-root-discovery [project_path] > /tmp/vibeguard_scan.json
# Windows
python scripts/scan.py [project_path] > %TEMP%\vibeguard_scan.json
```

`scan.py` 自动完成：仓库卫生检查（gitignore / 敏感文件 / 硬编码密钥）→ 生态识别与依赖提取（支持 npm/pnpm/yarn、pypi、go、crates-io 四大生态）→ 调用 VibeGuard API 查漏洞（100 个一批）→ 过旧依赖检查。扫描较慢（特别是过旧检查），耐心等。

### Step 2 分析与分级

读 scan 输出的 JSON，做三灯分级判断：

1. **所有漏洞按严重度排序**（critical > high > medium > low），全部放入 `top_issues`，不要只放前 5 个。`top_issues` 中每项**必须透传** scan.py 输出中的 `advisory_id`、`aliases`、`cve_id`、`package`、`version`、`severity`、`summary` 字段——这些是漏洞总览表格的显示数据，漏了列就是空的。
2. **三灯分级**：
   - 🟢 **可自动修复**：有明确修复方案且风险可控（有 fix version 的 JS/Go/Rust 依赖漏洞、.gitignore 缺失规则、git rm --cached）。每项给 `fix_config`（upgrade / gitignore / git_rm_cached 三种类型）。`upgrade` 只填结构化字段：`type`、`ecosystem`、`package`、`version`，JS 生态可加 `manager`（npm / pnpm / yarn）；不要依赖自由文本 `command` 执行。Python/PyPI 依赖升级必须先确认虚拟环境和锁文件，默认放 🟡 手动处理，不启用网页一键修复。
   - 🟡 **需人工判断**：含用户数据或需确认风险（硬编码密钥、可疑依赖、版本范围模糊）。给内容画像 + 处置路径 + 风险提示。所有黄灯项在服务模式下有「在编辑器打开」按钮。
   - 🔴 **高危/需专业处理**：不可自动修复（密钥已入 git 历史、恶意包）。给具体处理步骤，不给操作按钮。
3. **每一项（green / yellow / red）都必须设置 `severity` 字段**，值为 `critical`、`high`、`medium`、`low`、`info` 之一。这是进度条着色的数据来源，漏了整条进度条就是灰色。
   - 漏洞类：直接用 scan.py 返回的 severity。
   - 仓库卫生类（gitignore、敏感文件、硬编码密钥）：按风险判断赋值——密钥泄露用 `high`/`critical`，gitignore 规则缺失用 `medium`，过旧依赖用 `low`。
4. **构建 risk_summary**：`{ "critical": N, "high": N, "medium": N, "low": N, "info": N }`，严格使用这五个 key，统计各严重等级数量。

把分析结果写成 analysis JSON（schema 见 `scripts/build_report.py` 顶部注释）。**必须透传 scan.py 输出中的 `generated_at` 和 `scan_seconds` 字段**，它们是计算全流程耗时（扫描 + 分析 + 报告生成）的数据来源。

**🟢 项必须带 `fix_config`**——这是网页修复按钮的前提，漏了按钮就不出现。

### Step 3 生成报告

先把结论写到当前工作目录的 `docs/security-report-YYYY-MM-DD.md`，内容包括：扫描范围、隐私边界、最高风险、漏洞命中、硬编码密钥/敏感文件、过旧依赖、扫描错误、下一步建议。这个 Markdown 是可审计交付物。

然后生成可交互 HTML。默认用一键修复模式（`server.py`）打开报告，但真正执行修复仍需要用户在报告页二次确认。

**交互模式（`server.py`）**：

```bash
# macOS / Linux
python3 scripts/server.py /tmp/vibeguard_analysis.json
# 如果已经有报告页打开，只想打印 URL：
python3 scripts/server.py --no-open /tmp/vibeguard_analysis.json
# Windows
python scripts/server.py %TEMP%\vibeguard_analysis.json
# 自动开浏览器，Ctrl+C 停
```

`server.py` 起在 127.0.0.1 + 随机端口 + 随机 token。🟢 项给「执行修复」按钮（二次确认）；🟡 项给「在编辑器打开」按钮；🔴 项只给文字建议。修复白名单由服务端按 `fix_config` 生成随机 action id，并按结构化字段重新生成命令；不会执行 analysis JSON 里的自由文本命令，也不提供“更新所有依赖”这种宽泛操作。

仅当用户明确只想要一份可分享/留存的只读文件时，才用静态模式：
```bash
# macOS / Linux
python3 scripts/build_report.py /tmp/vibeguard_analysis.json ~/Desktop/security-report.html && open ~/Desktop/security-report.html
# Windows
python scripts/build_report.py %TEMP%\vibeguard_analysis.json %USERPROFILE%\Desktop\security-report.html && start security-report.html
```

**排障：网页上没有修复按钮** = 要么开的是静态报告（改用 `server.py`），要么 🟢 项漏了 `fix_config`（补上重启服务）。

报告阅读流：项目概览（项目名 + 生态 + 依赖数 + 漏洞数 + 风险分布条）→ 漏洞总览（全部漏洞，按严重度排序，不要只截取前 N 项）→ 执行建议 → 🟢🟡🔴 三级可折叠卡片（命令一键复制）→ 长期安全建议。

### Step 4 对话里给摘要

报告生成后，在对话里用一段话给结论先行的摘要：总风险等级、最该先处理的 2-3 项、风险最高的一项。细节让用户看网页。

## 单项查询

用户只问单个 CVE、单个包、Nginx 或某条安全情报时，不需要扫描整个项目，直接调 API 并解释。API 地址 `https://vibeguard.ou.al`，详细接口见 scan.py 顶部注释。对于 Nginx 等系统软件，不要只根据版本号判断是否受影响——实际风险取决于发行版补丁和配置。

## 依赖与运行前提

- 全部脚本是 **Python 3 标准库**，零第三方依赖（不用 pip install）。
- **macOS/Linux** 自带 python3，开箱即用。
- **Windows** 默认没装 Python——需先装 Python 3，命令改为 `python` 或 `py -3`。
- 依赖扫描支持 **4 种生态**：JavaScript/TypeScript（npm/pnpm/yarn）、Python（pypi）、Go、Rust（crates-io）。
- 本 skill 是 **agent 驱动**：扫描出数据后由 agent 做分级分析，不是双击即用的独立 App。

## 修复建议规则

- 密钥泄露：立刻撤销或轮换密钥，删除代码中的明文；如果进入 git 历史，用 BFG Repo Cleaner 清理。
- 确认受影响的依赖：升级到修复版本，然后运行测试和构建。给升级建议时同时提醒兼容性风险。
- 恶意包：立即移除，检查 CI 环境凭证并轮换。
- 版本不明确：说明只命中包名，需要 lockfile 才能确认。
- 依赖过旧：建议纳入升级计划，但不要在没有漏洞证据时当作安全事故处理。
