# VibeGuard

[![Next.js](https://img.shields.io/badge/Next.js-16-000000.svg?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB.svg?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6.svg?logo=typescript)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-18-4169E1.svg?logo=postgresql)](https://www.postgresql.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4.svg?logo=tailwindcss)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-WTFPL-FF4136.svg)](http://www.wtfpl.net/)

**本地优先的开源供应链安全情报平台 — RSS 聚合 · LLM 双语处理 · 漏洞追踪 · MCP 集成**

[English](README.md) | 中文

VibeGuard 是一个面向中文用户的供应链安全内容平台。从 RSS/Atom 订阅源自动拉取安全情报，通过 LLM 提取正文、翻译、生成摘要，提供公开前端和管理后台，同时内置 MCP Server 供 AI 编程工具直接查询漏洞信息。

## 功能特性

- **RSS 情报聚合** — 自动拉取 RSS/Atom 订阅源，提取正文内容
- **LLM 双语处理** — 通过 OpenAI 兼容 API 自动翻译标题/正文，生成中英文摘要和安全标签
- **漏洞数据库** — 自动同步 OSV / NVD / CISA KEV / EPSS，支持按包名批量查询
- **MCP Server** — 内置 Model Context Protocol 服务端，AI 编程工具可直接查询漏洞和文章
- **管理后台** — Feed 管理、文章审核、任务队列监控、LLM 配置、安全数据同步
- **i18n** — 中文（默认）和英文双语界面
- **暗色模式** — Light/dark 主题切换
- **Docker 部署** — 多阶段构建，支持 `linux/amd64` + `linux/arm64`

## 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | Next.js 16 (App Router) + React 19 + TypeScript 6 |
| 样式 | Tailwind CSS v4 + shadcn/ui |
| 数据库 | PostgreSQL 18 + Drizzle ORM |
| Monorepo | pnpm workspaces (apps/web + apps/worker + packages/*) |
| LLM | OpenAI 兼容 API（翻译、摘要、分类） |
| 内容处理 | RSS Parser + defuddle（正文提取）+ Linkedom（DOM） |
| 校验 | Zod |
| MCP | @modelcontextprotocol/sdk |
| 容器 | Docker 多阶段构建 + Docker Compose |

## 快速开始

### 环境要求

- Node.js >= 22
- pnpm >= 10
- PostgreSQL >= 16

### 安装

```bash
# 克隆仓库
git clone https://github.com/27Aaron/VibeGuard.git
cd VibeGuard

# 安装依赖
pnpm install

# 复制环境变量模板
cp .env.example .env
```

### 配置环境变量

编辑 `.env`：

```env
# PostgreSQL
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/vibeguard

# 公开 URL（MCP 客户端和服务端辅助工具使用）
VIBEGUARD_API_URL=http://127.0.0.1:3000

# 必需密钥 — 生成方式：openssl rand -hex 32
VIBEGUARD_SECRET=replace-with-a-random-secret
ADMIN_PASSWORD=replace-with-a-strong-admin-password

# 服务绑定
HOSTNAME=127.0.0.1
PORT=3000
```

> **重要**：`VIBEGUARD_SECRET` 用于加密 LLM API Key 等敏感配置，设置后请勿更改，否则已有加密数据将无法解密。

### 启动

```bash
# 完整开发环境（自动启动 PostgreSQL + web + worker）
pnpm dev:stack

# 或单独启动
pnpm dev:web     # 仅前端
pnpm dev:worker  # 仅后台 worker
```

访问 `http://localhost:3000`，使用 `.env` 中配置的 `admin` / `ADMIN_PASSWORD` 登录管理后台。

### 常用命令

```bash
pnpm dev:stack       # 完整开发环境（PostgreSQL + web + worker）
pnpm dev:web         # 仅前端
pnpm dev:worker      # 仅后台 worker
pnpm build:web       # 生产构建
pnpm db:migrate      # 数据库迁移
pnpm db:generate     # 生成迁移文件
pnpm lint            # ESLint 检查
pnpm test            # 运行测试
pnpm typecheck       # 类型检查
```

## 使用流程

1. **管理员登录** — 使用初始管理员账号登录后台
2. **配置 LLM** — 在管理后台添加 OpenAI 兼容的 LLM 服务商（API Key 加密存储）
3. **添加 Feed** — 在 Feed 管理页面添加安全情报 RSS 源
4. **Worker 处理** — 后台自动拉取文章，执行提取 → 翻译 → 摘要 → 分类流水线
5. **查看文章** — 前端浏览双语安全文章，支持搜索、过滤、RSS 输出
6. **漏洞查询** — 安全数据自动从 OSV/NVD/CISA KEV/EPSS 同步，支持按包名查询
7. **MCP 集成** — 在 Claude Code / Cursor 等 AI 工具中连接 MCP Server，直接查询漏洞信息

## 项目结构

```
apps/
  web/                    # Next.js 前端应用
    app/[lang]/
      (public)/           # 公开页面（首页、文章、RSS）
      admin/              # 管理后台（Feed、文章、任务、LLM 配置）
      api/                # API 路由
      mcp/                # MCP SSE 端点
    components/
      ui/                 # 基础 UI 组件
      admin/              # 管理后台组件
      security/           # 安全相关组件
    lib/                  # 工具函数和 Server Actions
    proxy.ts              # 路由中间件（鉴权、i18n）

  worker/                 # 后台处理 Worker
    src/
      index.ts            # Worker 入口
      poll-feeds.ts       # Feed 拉取
      process-article.ts  # 文章处理流水线
      sync-osv.ts         # 安全数据同步
      jobs.ts             # 任务队列管理

packages/
  db/                     # 数据库层（schema + 迁移）
  llm/                    # LLM 集成（翻译、摘要、重试策略）
  content/                # 内容处理（正文提取、Feed 解析、OSV 同步）
  mcp-server/             # MCP Server（漏洞查询、文章搜索）
  shared/                 # 共享类型和常量
```

## 数据库

PostgreSQL + Drizzle ORM，10 张表：

```
feeds ──1:N── articles ──1:N── processing_jobs
                  │
                  └──1:N── llm_usage_logs

llm_settings (单例配置)

security_advisories ──1:N── security_affected_packages
security_cve_enrichments (CVE 增强数据)
security_sync_state (同步状态追踪)
```

- **feeds** — RSS/Atom 订阅源配置
- **articles** — 处理后的文章（双语标题/正文/摘要）
- **processing_jobs** — 后台处理任务队列
- **llm_settings** — LLM 服务商配置（API Key 加密存储）
- **llm_usage_logs** — LLM Token 用量和性能日志
- **security_advisories** — 漏洞公告（来自 OSV）
- **security_affected_packages** — 受影响的包和版本范围
- **security_cve_enrichments** — CVE 增强数据（CVSS、EPSS、CISA KEV）
- **security_sync_state** — 安全数据同步状态追踪

修改 schema 后运行 `pnpm db:generate` 生成迁移，`pnpm db:migrate` 应用。

## 部署

### Docker Compose（推荐）

```bash
# 克隆并配置
git clone https://github.com/27Aaron/VibeGuard.git
cd VibeGuard
cp .env.example .env

# 编辑 .env：设置 VIBEGUARD_SECRET 和 ADMIN_PASSWORD

# 使用预构建镜像
docker compose up -d

# 或本地构建
docker compose -f compose.yaml -f compose.build.yaml up --build -d
```

Compose 包含：
- **app** — Next.js + Worker（单容器）
- **postgres** — PostgreSQL 18

数据卷：`./data/postgres`（数据库）、`./data/osv-cache` / `./data/osv-bootstrap` / `./data/enrichment-cache`（安全数据）。

### 手动部署

```bash
pnpm build:web

# 启动前端
NODE_ENV=production node apps/web/.next/standalone/apps/web/server.js

# 启动 Worker
node -e "require('./apps/worker/src/index.ts')"
```

建议使用 PM2 或 systemd 管理进程。

## 安全

- LLM API Key 使用 AES-256-GCM 加密存储，密钥不存入数据库
- 管理员密码 bcrypt 哈希存储
- Session-based 鉴权，管理 API 强制校验管理员身份
- MCP 端点支持 Token 认证，可配置最大会话数和 TTL
- 输入验证：UUID 格式校验、Feed URL 校验、包名格式验证
- 图片代理：限制最大尺寸、超时、重定向次数、DNS 缓存
- Security headers：X-Frame-Options, X-Content-Type-Options, Referrer-Policy
- Docker 容器以非 root 用户运行

## 许可证

[WTFPL](http://www.wtfpl.net/) — Do What The Fuck You Want To Public License.
