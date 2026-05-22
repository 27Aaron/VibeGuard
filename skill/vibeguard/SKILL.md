---
name: vibeguard
description: 面向普通开发者和 Vibe Coding 用户的项目安全体检 Skill。用于"帮我看看项目有没有安全问题"、"安全扫描/扫一下项目"、"依赖有没有漏洞"、"有没有木马包/恶意包"、"有没有硬编码密钥/API Key/token"、"env 是否误提交"、"gitignore 是否合理"、"依赖是否太旧"、"nginx/CVE/某个包有没有风险"、"security audit/dependency check/secrets scan" 等项目安全、依赖安全、供应链安全或漏洞情报查询。上下文是代码仓库、依赖、服务器或软件包时应触发。Skill 本地只读检查，只向 VibeGuard API 发送包坐标，不上传源码、lockfile、env 或密钥。
---

# VibeGuard 项目安全检查

这个 Skill 用来帮助普通开发者和刚接触 Vibe Coding 的用户判断：自己的项目有没有明显安全风险，当前依赖有没有已知漏洞，最近的安全事件和自己的项目有没有关系。

最终输出要像一份可执行的安全体检结论，而不是命令日志堆砌。默认用中文解释，保留必要的 API 字段名、包生态名、命令和版本号。

## 核心边界

- 只在本地读取用户项目文件；不要上传源码、完整 lockfile、`.env`、私钥、证书、数据库、日志或任意项目文件。
- 调用 VibeGuard 时，只发送最小必要信息：`ecosystem`、`name`、`version`。
- 不要把“依赖过旧”直接说成“存在漏洞”；只有命中漏洞数据时才说有漏洞。
- 不要自动执行升级、删除、轮换密钥、清理 git 历史等破坏性操作；先给出建议，让用户确认。
- 命令失败或工具缺失时，说明没有完成哪一步，以及这会怎样影响结论可信度。

## VibeGuard API

线上服务地址：

```text
https://vibeguard.ou.al
```

可用接口：

- `POST https://vibeguard.ou.al/api/security/check/packages`：批量检查软件包是否命中已知漏洞或恶意包记录。
- `GET https://vibeguard.ou.al/api/security/check/overview`：查看 VibeGuard 当前漏洞数据概览。
- `GET https://vibeguard.ou.al/api/articles`：检索安全资讯、漏洞解读、供应链攻击事件。
- `GET https://vibeguard.ou.al/api/articles/{articleId}`：读取单篇安全文章详情。

包检查请求格式：

```json
{
  "packages": [
    {
      "ecosystem": "npm",
      "name": "next",
      "version": "15.5.1"
    }
  ]
}
```

支持的 `ecosystem`：

- `npm`
- `pypi`
- `go`
- `crates-io`

命令示例：

```bash
curl -sS 'https://vibeguard.ou.al/api/security/check/packages' \
  -X POST \
  -H 'Content-Type: application/json' \
  --data-raw '{
    "packages": [
      { "ecosystem": "npm", "name": "next", "version": "15.5.1" },
      { "ecosystem": "pypi", "name": "requests", "version": "2.32.3" }
    ]
  }'
```

安全情报检索示例：

```bash
curl -sS 'https://vibeguard.ou.al/api/articles?q=nginx&lang=zh&limit=10'
```

## 检查流程

用户说“帮我看看这个项目有没有安全问题”“检查依赖有没有漏洞”“看看有没有木马包”时，按下面流程执行。用户指定范围时，只执行对应部分。

### 1. 仓库卫生检查

先做本地只读检查：

- 查看 `.gitignore` 是否忽略了 `.env`、证书、私钥、数据库、日志、构建产物、缓存目录。
- 检查是否有 `.env`、`.env.*`、`*.pem`、`*.key`、`*.p12`、`*.pfx`、`*.sqlite`、`*.db`、`*.dump`、`*.log` 已经被 git 跟踪。
- 搜索疑似硬编码密钥、token、密码、API Key。
- 排除 `.git`、`node_modules`、`.next`、`dist`、`build`、`coverage` 等目录，避免误报噪音。

常用命令：

```bash
git status --short
git ls-files | rg '(^|/)(\.env(\..*)?|.*\.(pem|key|p12|pfx|sqlite|sqlite3|db|dump|log)$)'
rg -n --hidden --glob '!.git' --glob '!node_modules' --glob '!.next' --glob '!dist' --glob '!build' --glob '!coverage' '(AKIA[0-9A-Z]{16}|-----BEGIN (RSA |EC |OPENSSH |)PRIVATE KEY-----|xox[baprs]-[A-Za-z0-9-]+|gh[pousr]_[A-Za-z0-9_]{36,}|sk-[A-Za-z0-9_-]{20,}|password\s*=\s*["'\''][^"'\'']+["'\'']|api[_-]?key\s*=\s*["'\''][^"'\'']+["'\''])'
```

如果发现密钥或私钥被提交，不要只说“删掉文件”。要提醒用户：立刻撤销或轮换凭证，检查使用范围，再处理仓库历史。

### 2. 识别项目生态

根据依赖文件判断项目类型，并提取软件包坐标。

优先使用 lockfile，因为 lockfile 通常包含实际安装版本；只有 manifest 时，结论要更保守。

- Node/npm：优先 `package-lock.json`、`pnpm-lock.yaml`、`yarn.lock`，其次 `package.json`。
- Python/PyPI：优先 `poetry.lock`、`uv.lock`，其次 `requirements.txt`、`pyproject.toml`。
- Go：优先 `go.sum`，结合 `go.mod` 判断直接依赖。
- Rust/crates.io：优先 `Cargo.lock`，结合 `Cargo.toml` 判断直接依赖。

提取时尽量保留：

- `ecosystem`：包生态，例如 `npm`、`pypi`、`go`、`crates-io`。
- `name`：包名。
- `version`：实际解析出的版本；如果只有版本范围或无法确认，填 `null` 或暂不传版本，并在结果里说明证据不完整。

### 3. 调用 VibeGuard 检查漏洞

把本地提取出的包坐标按最多 100 个一批发送到：

```text
POST https://vibeguard.ou.al/api/security/check/packages
```

只发送类似下面的数据：

```json
{
  "packages": [
    { "ecosystem": "npm", "name": "next", "version": "15.5.1" },
    { "ecosystem": "go", "name": "golang.org/x/crypto", "version": "0.31.0" }
  ]
}
```

解释返回结果时：

- `affected: true` 表示当前包版本确认受影响。
- `matchReason` 说明为什么命中，例如版本范围命中、明确受影响版本、只有包名匹配但缺少版本。
- `confidence` 表示匹配置信度；置信度低时不要下绝对结论。
- `affectedPackage.fixedVersions` 如果有值，优先作为升级建议。
- `advisory.summary`、`advisory.details`、`advisory.references` 用来解释风险背景和来源。
- 如果返回数据提示本地漏洞库过期，要把它写进结论，提醒用户重新查询或等待数据刷新。

### 4. 检查依赖是否过旧

依赖过旧属于维护风险，不一定是安全漏洞。根据项目工具链选择命令：

- Node：`pnpm outdated`、`npm outdated` 或 `yarn outdated`
- Python：`pip list --outdated`，或项目包管理器提供的等价命令
- Go：`go list -u -m all`
- Rust：`cargo outdated`，如果未安装就说明跳过

解释升级建议时要提醒：大版本升级可能导致 API、配置、构建产物、运行行为或插件兼容性变化。建议分批升级，每次升级后运行测试和构建。

### 5. 查询单个软件或漏洞情报

用户问“nginx 最近有没有漏洞”“某个包是不是木马”“某个 CVE 是什么影响”时，不需要扫描整个项目，直接检索 VibeGuard 文章：

```bash
curl -sS 'https://vibeguard.ou.al/api/articles?q=nginx&lang=zh&limit=10'
```

能判断范围时，加入筛选参数：

- `q`：关键词，例如 `nginx`、`next`、`CVE-2026-xxxx`
- `lang`：默认 `zh`
- `limit`：返回数量
- `ecosystem`：生态，例如 `npm`、`pypi`、`go`、`crates-io`
- `riskCategory`：风险类型，例如 `vulnerability`、`malicious-package`、`supply-chain-attack`
- `tag`：标签，例如 `cve`、`nginx`

对于 Nginx、Linux 发行版包、系统软件，不要只根据版本号判断是否受影响。实际风险通常取决于发行版补丁、编译参数、启用模块和配置。只能拿到公开 banner 时，要说“这是风险信号，不是最终确认”。

## 输出要求

最终回复使用下面结构。没有内容的部分可以省略。

```markdown
**结论**
一句话说明当前风险等级，以及最优先处理的动作。

**高风险问题**

- 写密钥泄露、env 误提交、私钥提交、恶意包、确认受影响漏洞、漏洞库过期等。

**依赖漏洞**

- 写包名、版本、公告编号、命中原因、修复版本、建议升级或替换方案。

**过期依赖**

- 区分“只是旧”和“已知有漏洞”。不要把所有旧依赖都说成安全漏洞。

**建议动作**

- 按优先级列出：轮换密钥、修补依赖、替换依赖、运行测试、重新部署。

**补充学习**

- 如果 VibeGuard 有相关文章，简短说明它和当前项目的关系。
```

## 表达方式

- 面向新手解释，不假设用户知道供应链攻击、恶意包、lockfile、CVE、语义化版本。
- 每个风险都要落到行动上：马上做什么、之后做什么、什么情况下需要更多证据。
- 不要制造恐慌。没有证据时说“不确定”，不要说“肯定安全”或“肯定中招”。
- 给升级建议时，同时提醒兼容性风险。

## 修复建议规则

- 密钥泄露：立刻撤销或轮换密钥，删除代码中的明文，检查调用记录；如果进入 git 历史，继续处理历史暴露问题。
- 确认受影响的依赖：升级到修复版本或更高兼容版本，然后运行测试和构建。
- 没有修复版本的依赖：考虑临时缓解、配置绕过、降级、替换依赖或等待上游修复。
- 恶意包：立即移除，检查安装脚本、构建产物、CI 环境和运行环境能访问到的凭证，并轮换相关凭证。
- 版本不明确：说明只命中包名或公告，需要 lockfile 或实际安装版本才能确认。
- 依赖过旧：建议纳入升级计划，但不要在没有漏洞证据时当作安全事故处理。
