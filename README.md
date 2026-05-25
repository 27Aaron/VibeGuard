# VibeGuard

[![Next.js](https://img.shields.io/badge/Next.js-16-000000.svg?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB.svg?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6.svg?logo=typescript)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-18-4169E1.svg?logo=postgresql)](https://www.postgresql.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4.svg?logo=tailwindcss)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-WTFPL-FF4136.svg)](http://www.wtfpl.net/)

**Local-first open-source supply-chain security intelligence platform — RSS aggregation · LLM bilingual processing · Vulnerability tracking · MCP integration**

English | [中文](README_CN.md)

VibeGuard is a security content platform built for Chinese-speaking users. It automatically pulls security intelligence from RSS/Atom feeds, extracts article content, translates and summarizes via LLMs, and provides both a public-facing frontend and administrative backend. A built-in MCP Server lets AI coding tools query vulnerability data directly.

## Features

- **RSS Intelligence Aggregation** — Auto-fetch RSS/Atom feeds and extract article content
- **LLM Bilingual Processing** — Translate titles/content, generate bilingual summaries and security tags via OpenAI-compatible API
- **Vulnerability Database** — Auto-sync OSV / NVD / CISA KEV / EPSS, batch query by package name
- **MCP Server** — Built-in Model Context Protocol server for AI coding tools to query vulnerabilities and articles
- **Admin Dashboard** — Feed management, article review, job queue monitoring, LLM configuration, security data sync
- **i18n** — Chinese (default) and English interface
- **Dark Mode** — Light/dark theme toggle
- **Docker Deployment** — Multi-stage build, supports `linux/amd64` + `linux/arm64`

## Tech Stack

| Category | Technology |
|----------|-----------|
| Framework | Next.js 16 (App Router) + React 19 + TypeScript 6 |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Database | PostgreSQL 18 + Drizzle ORM |
| Monorepo | pnpm workspaces (apps/web + apps/worker + packages/*) |
| LLM | OpenAI-compatible API (translation, summarization, classification) |
| Content | RSS Parser + defuddle (content extraction) + Linkedom (DOM) |
| Validation | Zod |
| MCP | @modelcontextprotocol/sdk |
| Container | Docker multi-stage build + Docker Compose |

## Getting Started

### Prerequisites

- Node.js >= 22
- pnpm >= 10
- PostgreSQL >= 16

### Installation

```bash
git clone https://github.com/27Aaron/VibeGuard.git
cd VibeGuard
pnpm install
cp .env.example .env
```

### Configure Environment Variables

Edit `.env`:

```env
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/vibeguard
VIBEGUARD_API_URL=http://127.0.0.1:3000
VIBEGUARD_SECRET=replace-with-a-random-secret   # openssl rand -hex 32
ADMIN_PASSWORD=replace-with-a-strong-admin-password
HOSTNAME=127.0.0.1
PORT=3000
```

> **Important**: `VIBEGUARD_SECRET` encrypts LLM API keys and other sensitive config. Do not change it after initial setup, or existing encrypted data becomes unreadable.

### Start

```bash
# Full dev environment (PostgreSQL + web + worker)
pnpm dev:stack

# Or run individually
pnpm dev:web     # Frontend only
pnpm dev:worker  # Background worker only
```

Visit `http://localhost:3000`. Log in to the admin panel with `admin` / `ADMIN_PASSWORD` from `.env`.

### Common Commands

```bash
pnpm dev:stack       # Full dev environment
pnpm dev:web         # Frontend only
pnpm dev:worker      # Worker only
pnpm build:web       # Production build
pnpm db:migrate      # Run migrations
pnpm db:generate     # Generate migration files
pnpm lint            # ESLint
pnpm test            # Run tests
pnpm typecheck       # Type checking
```

## Usage

1. **Admin Login** — Sign in with the initial admin account
2. **Configure LLM** — Add an OpenAI-compatible LLM provider in the admin dashboard (API keys are encrypted at rest)
3. **Add Feeds** — Add security intelligence RSS sources in the Feed management page
4. **Worker Processing** — The worker automatically fetches articles and runs the extract → translate → summarize → classify pipeline
5. **Browse Articles** — View bilingual security articles on the frontend with search, filtering, and RSS output
6. **Vulnerability Queries** — Security data syncs automatically from OSV/NVD/CISA KEV/EPSS; query by package name
7. **MCP Integration** — Connect the MCP Server in Claude Code / Cursor or other AI tools to query vulnerabilities directly

## Project Structure

```
apps/
  web/                    # Next.js frontend
    app/[lang]/
      (public)/           # Public pages (home, articles, RSS)
      admin/              # Admin dashboard (feeds, articles, jobs, LLM config)
      api/                # API routes
      mcp/                # MCP SSE endpoint
    components/
      ui/                 # Base UI components
      admin/              # Admin components
      security/           # Security-related components
    lib/                  # Utilities and Server Actions
    proxy.ts              # Routing middleware (auth, i18n)

  worker/                 # Background processing worker
    src/
      index.ts            # Worker entry
      poll-feeds.ts       # Feed polling
      process-article.ts  # Article processing pipeline
      sync-osv.ts         # Security data sync
      jobs.ts             # Job queue management

packages/
  db/                     # Database layer (schema + migrations)
  llm/                    # LLM integration (translation, summarization, retry policy)
  content/                # Content processing (extraction, feed parsing, OSV sync)
  mcp-server/             # MCP Server (vulnerability queries, article search)
  shared/                 # Shared types and constants
```

## Database

PostgreSQL + Drizzle ORM, 10 tables:

```
feeds ──1:N── articles ──1:N── processing_jobs
                  │
                  └──1:N── llm_usage_logs

llm_settings (singleton config)

security_advisories ──1:N── security_affected_packages
security_cve_enrichments (CVE enrichment data)
security_sync_state (sync state tracking)
```

- **feeds** — RSS/Atom source configuration
- **articles** — Processed articles (bilingual title/content/summary)
- **processing_jobs** — Background job queue
- **llm_settings** — LLM provider config (encrypted API keys)
- **llm_usage_logs** — Token usage and performance logs
- **security_advisories** — Vulnerability advisories (from OSV)
- **security_affected_packages** — Affected packages and version ranges
- **security_cve_enrichments** — CVE enrichment (CVSS, EPSS, CISA KEV)
- **security_sync_state** — Security data sync state tracking

After modifying schema, run `pnpm db:generate` then `pnpm db:migrate`.

## Deployment

### Docker Compose (recommended)

```bash
git clone https://github.com/27Aaron/VibeGuard.git
cd VibeGuard
cp .env.example .env

# Edit .env: set VIBEGUARD_SECRET and ADMIN_PASSWORD

# Using prebuilt image
docker compose up -d

# Or build locally
docker compose -f compose.yaml -f compose.build.yaml up --build -d
```

The compose stack includes:
- **app** — Next.js + Worker (single container)
- **postgres** — PostgreSQL 18

Data volumes: `./data/postgres` (database), `./data/osv-cache` / `./data/osv-bootstrap` / `./data/enrichment-cache` (security data).

### Manual

```bash
pnpm build:web

# Start web
NODE_ENV=production node apps/web/.next/standalone/apps/web/server.js

# Start worker
node -e "require('./apps/worker/src/index.ts')"
```

Recommended: use PM2 or systemd for process management.

## Security

- LLM API keys encrypted with AES-256-GCM; encryption key never stored in database
- Admin passwords hashed with bcrypt
- Session-based auth with admin verification on management APIs
- MCP endpoint supports token auth with configurable max sessions and TTL
- Input validation: UUID format checks, feed URL validation, package name format verification
- Image proxy: bounded file size, timeout, redirect limits, DNS cache
- Security headers: X-Frame-Options, X-Content-Type-Options, Referrer-Policy
- Docker container runs as non-root user

## License

[WTFPL](http://www.wtfpl.net/) — Do What The Fuck You Want To Public License.
