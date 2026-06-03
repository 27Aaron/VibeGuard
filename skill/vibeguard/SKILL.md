---
name: vibeguard
description: VibeGuard 项目代码安全扫描助手，用于"帮我看看项目有没有安全问题"、"安全扫描"、"扫一下项目"、"依赖有没有漏洞"、"木马包"、"恶意包"、"硬编码密钥"、"API Key"、"token"、"env 是否误提交"、"gitignore 是否合理"、"依赖是否太旧"、漏洞检查、项目安全、供应链安全、安全报告等代码仓库检查场景；支持 JavaScript/TypeScript、Python、Go、Rust 项目；默认中文解释，保留 API 字段名、生态名、命令和版本号。
---

# VibeGuard 项目安全检查

对用户项目做一次本地只读安全扫描，产出 Markdown 审计报告和只读 HTML 报告。流程：扫描 -> 分析分级 -> 生成 Markdown -> 生成并打开 HTML。修复不在网页里执行，只在用户看完报告并在对话里明确同意后由 agent 执行。

## 核心边界

- 只在本地读取用户项目文件；不上传源码、lockfile、env 或密钥；不要上传完整 lockfile、`.env`、私钥、证书、数据库、日志或任意项目文件。
- 调用 VibeGuard API 时，只发送最小必要信息：`ecosystem`、`name`、`version`。
- 报告里不要泄露完整密钥，只能写文件、行号、类型和脱敏预览。
- 完整项目安全扫描必须先在当前工作目录的 `docs/` 下生成 Markdown 审计报告，例如 `docs/security-report-YYYY-MM-DD.md`。用户阅读报告后明确允许修复，才可以执行升级、删除缓存跟踪、修改 `.gitignore`、清理历史或轮换凭证相关操作。
- API 地址：`https://vibeguard.ou.al`。本 skill 只使用 `POST https://vibeguard.ou.al/api/security/check/packages` 做依赖漏洞检查，不处理系统软件版本判断或泛安全情报查询。

## 铁律

- **全程只读。** `scan.py` 只读文件、调 API，不修改任何项目内容。
- **先做生态预检。** 完整依赖漏洞扫描只支持 JavaScript/TypeScript、Python、Go、Rust；没有命中支持文件时，先提示用户暂不支持依赖漏洞扫描，只做仓库卫生扫描。
- **报告先完整生成，再打开。** 必须等 Markdown 报告和 analysis JSON 都写完后，再启动 `server.py`；不要同时打开静态 HTML 和本地服务，避免用户看到两次网页。
- **网页只读。** HTML 只用于阅读报告，不提供任何会触发本地操作的按钮。
- **修复操作需确认。** 用户看完报告后，在对话里回复 `同意` / `修复` / `OK` / `Yes` 等明确话术，agent 才能执行修复。
- **不要把"依赖过旧"说成"存在漏洞"。** 只有命中漏洞数据时才说有漏洞。
- **不要制造恐慌。** 没有证据时说"不确定"，不要说"肯定安全"或"肯定中招"。

## Step 0 生态预检

运行完整扫描前，先执行只读预检脚本：

```bash
# macOS / Linux
python3 scripts/preflight.py
# Windows
py -3 scripts/preflight.py
```

`scripts/preflight.py` 默认扫描当前目录并自动向上识别项目根目录；需要扫描其他目录时，把路径作为最后一个参数传入。它会把 JSON 打印到终端，并把同一份结果保存到临时目录；Windows 默认优先使用 `%TEMP%`。结果里的 `output_file` 是实际保存路径。先读 preflight JSON，再决定扫描模式。

如果 `language_support.supported` 为 `true`，继续执行完整流程：仓库卫生扫描 -> 依赖提取 -> 漏洞 API 检查 -> 过旧依赖检查。

如果 `language_support.supported` 为 `false`，先告诉用户：`当前项目没有发现 VibeGuard 支持的依赖文件，暂不支持依赖漏洞扫描；本次只做仓库卫生扫描，检查硬编码密钥、敏感文件跟踪和 .gitignore 风险。` 然后仍可运行 `scan.py --skip-outdated` 生成只包含仓库卫生扫描、硬编码密钥和敏感文件跟踪结论的报告；不要调用漏洞 API，也不要暗示已经检查过依赖漏洞。

预检脚本负责只读检测支持的依赖文件、操作系统、Linux 发行版、包管理器和系统更新工具；不要在预检阶段执行软件更新、系统更新或内核更新检查。

## Step 1 扫描

```bash
# macOS / Linux
python3 scripts/scan.py [project_path] > /tmp/vibeguard_scan.json
# 可按网络和工具链情况调并发；默认 API=8、outdated=4
python3 scripts/scan.py --api-concurrency 8 --outdated-concurrency 4 [project_path] > /tmp/vibeguard_scan.json
# 快速模式：跳过较慢的过旧依赖检查，只做仓库卫生 + 漏洞确认
python3 scripts/scan.py --skip-outdated [project_path] > /tmp/vibeguard_scan.json
# 调试模式：输出完整包清单；默认只输出包数量和来源摘要，避免大项目 JSON 过大
python3 scripts/scan.py --include-packages [project_path] > /tmp/vibeguard_scan.json
# 严格只扫指定目录，不向上识别 git 根目录
python3 scripts/scan.py --no-root-discovery [project_path] > /tmp/vibeguard_scan.json
# Windows
python scripts/scan.py [project_path] > %TEMP%\vibeguard_scan.json
```

`scan.py` 自动完成：仓库卫生检查（gitignore / 敏感文件 / 硬编码密钥）-> 生态识别与依赖提取（npm/pnpm/yarn、pypi、go、crates-io）-> 调用 VibeGuard API 查漏洞（100 个一批，默认 8 并发）-> 过旧依赖检查（默认按生态并发）。本地卫生检查、漏洞 API、过旧依赖检查会并行执行；输出里的 `step_seconds` 可用于判断慢点。扫描较慢时优先使用 `--skip-outdated`，或调整 `--api-concurrency`、`--outdated-concurrency`。

## Step 2 分析与分级

读 scan 输出的 JSON 后，构建 analysis JSON（schema 见 `scripts/build_report.py` 顶部注释）：

- **命中漏洞**：所有漏洞按严重度排序（critical > high > medium > low），全部放入 `top_issues`，不要只放前 5 个。必须透传 `advisory_id`、`aliases`、`cve_id`、`package`、`version`、`severity`、`summary`、`fixed_versions` 等字段，网页会完整展示 GHSA。漏洞表的说明列必须是一句普通人能看懂的话，不要写"事实/为什么/影响/动作"四段，也不要在说明里堆 CVE/GHSA 编号。
- **仓库卫生扫描**：透传 `hygiene.gitignore_missing`、`hygiene.tracked_secrets`、`hygiene.sensitive_tracked`。密钥内容必须脱敏，只写位置、类型、可信度和预览。
- **过期依赖**：透传 `outdated`。过期依赖是维护信号，不等同于漏洞；用低风险、排期处理的语言描述。
- **风险项分级**：`red` 放需优先处理或专业处理的事项；`yellow` 放需业务/部署确认的事项；`green` 可保留给 agent 的内部修复计划，但网页不再单独展示低风险维护区块。
- **每一项都必须设置 `severity`**：`critical`、`high`、`medium`、`low`、`info` 之一。
- **必须构建 `risk_summary`**：`{ "critical": N, "high": N, "medium": N, "low": N, "info": N }`。
- **必须构建 `summary`**：每份 analysis JSON 都要有 `summary.tldr`、`summary.detail`、`summary.priority`。报告面向偏产品经理、项目负责人和非安全背景读者，少用术语，讲清楚"是否影响发布"、"是否需要马上安排"、"需要研发/运维确认什么"。`TL;DR` 不要写 `12 个 critical + 14 个 medium` 这类机器口吻；改写成"发现多项已确认依赖漏洞，风险集中在 next，建议先固定升级"这类产品语言。`detail` 不要展开 CVE/GHSA 编号列表；需要提证据编号时只放在漏洞表 GHSA 列。`priority` 必须是字符串数组。
- 必须透传 scan.py 输出中的 `generated_at` 和 `scan_seconds`，它们用于计算全流程耗时。

## Step 3 Markdown 报告

先把结论写到当前工作目录的 `docs/security-report-YYYY-MM-DD.md`。Markdown 必须使用普通人能看懂的产品风险语言，并按以下顺序组织：

1. `# 安全扫描报告`
2. `## 报告总结`
   - `TL;DR`：一句话摘要。
   - 详细说明：更完整地解释风险范围、是否影响发布、建议谁来处理；不要堆 CVE/GHSA 编号。
3. `## 命中漏洞`：列出已确认漏洞，按修复优先级排序；每条说明用一句小白能看懂的话；没有命中也要写清楚。
4. `## 仓库卫生扫描`：说明硬编码密钥、敏感文件跟踪、`.gitignore` 规则缺失情况。
5. `## 过期依赖`：说明过期依赖数量和维护建议，每条用一句话，明确"过期不等于漏洞"。
6. `## 需要人工确认的事项`：如密钥、访问控制、部署配置、恶意包等；只写"为什么要关注 / 可能影响 / 建议动作"，不要再写"事实"字段。
7. `## 扫描错误`：列出失败的 API、包管理器或工具链检查。
8. `## 下一步建议`：只给用户阅读后的决策建议，不要求用户在网页点击按钮。

## Step 4 HTML 报告

默认用只读服务模式打开报告；不要在同一次完整扫描里同时打开静态 HTML 和本地服务。

```bash
# macOS / Linux
python3 scripts/server.py /tmp/vibeguard_analysis.json
# 如果已经有报告页打开，只想打印 URL
python3 scripts/server.py --no-open /tmp/vibeguard_analysis.json
# Windows
python scripts/server.py %TEMP%\vibeguard_analysis.json
```

`server.py` 起在 `127.0.0.1` 随机端口，只提供只读报告。它会避免同一份报告短时间内重复打开浏览器标签页。终端里告诉用户：

- `报告已生成: <url>`
- `看完确认要修复后，在对话里回复：同意 / 修复 / OK / Yes。`
- `确认后会先关闭本地报告服务，再按主要修复 -> 次要修复处理。`

HTML 阅读流：项目概览 -> 报告总结 -> 命中漏洞 -> 仓库卫生扫描 -> 过期依赖 -> 优先处理的高风险项 -> 需要业务或部署确认的事项 -> 扫描错误。

仅当用户明确只想要一份可分享/留存的只读文件时，才用静态模式：

```bash
# macOS / Linux
python3 scripts/build_report.py /tmp/vibeguard_analysis.json ~/Desktop/security-report.html
# Windows
python scripts/build_report.py %TEMP%\vibeguard_analysis.json %USERPROFILE%\Desktop\security-report.html
```

## Step 5 用户确认后的修复

如果用户在看完报告后回复 `同意` / `修复` / `OK` / `Yes` / `可以修` 等明确授权：

1. 先停止刚刚启动的 `server.py` 进程，释放本地端口。
2. 按"主要修复 -> 次要修复"执行：
   - 主要修复：已确认的严重/高危漏洞升级、有明确修复版本的依赖、用户明确同意处理的真实凭证风险。
   - 次要修复：`.gitignore` 补规则、低风险维护项、过期依赖升级计划。
3. 不要在没有额外确认时执行凭证轮换、git 历史清理、删除文件、批量跨大版本升级。
4. 修复后运行项目已有测试、构建或最小验证命令，并把结果告诉用户。

## 依赖与运行前提

- 全部脚本是 Python 3 标准库，零第三方依赖（不用 pip install）。
- macOS/Linux 自带 python3；Windows 需先装 Python 3，命令改为 `python` 或 `py -3`。
- 依赖扫描支持 JavaScript/TypeScript（npm/pnpm/yarn lockfile）、Python（pypi）、Go、Rust（crates-io）。
- 本 skill 是 agent 驱动：扫描出数据后由 agent 做分级分析，不是双击即用的独立 App。

## 修复建议规则

- 密钥泄露：先撤销或轮换密钥，再删除代码中的明文；如果进入 git 历史，需单独确认后再用 BFG Repo Cleaner 等工具清理。
- 确认受影响的依赖：升级到修复版本，然后运行测试和构建。提醒兼容性风险。
- 恶意包：立即移除，检查 CI 环境凭证并轮换。
- 版本不明确：说明只命中包名，需要 lockfile 才能确认。
- 依赖过旧：建议纳入升级计划，但不要在没有漏洞证据时当作安全事故处理。
