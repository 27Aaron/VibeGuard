# syntax=docker/dockerfile:1.7

FROM node:24-alpine AS base

ENV NEXT_TELEMETRY_DISABLED=1 \
    PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.0.0 --activate

FROM base AS deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages/content/package.json packages/content/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/llm/package.json packages/llm/package.json
COPY packages/mcp-server/package.json packages/mcp-server/package.json
COPY packages/mcp-server/bin packages/mcp-server/bin
COPY packages/shared/package.json packages/shared/package.json

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile

FROM deps AS web-builder

COPY . .

RUN --mount=type=cache,id=next-cache,target=/app/.next/cache \
    pnpm build:web

FROM base AS worker-prod-deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/worker/package.json apps/worker/package.json
COPY packages/content/package.json packages/content/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/llm/package.json packages/llm/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --prod --frozen-lockfile --filter worker...

FROM node:24-alpine AS runner

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    VIBEGUARD_BIND_HOST=0.0.0.0 \
    WORKER_MAX_ITERATIONS=0

WORKDIR /app

RUN apk add --no-cache su-exec \
  && addgroup -S -g 1001 nodejs \
  && adduser -S -u 1001 vibeguard -G nodejs

COPY --from=web-builder --chown=vibeguard:nodejs /app/apps/web/.next/standalone ./
COPY --from=web-builder --chown=vibeguard:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=web-builder --chown=vibeguard:nodejs /app/apps/web/public ./apps/web/public

COPY --from=worker-prod-deps --chown=vibeguard:nodejs /app/node_modules ./node_modules
COPY --from=worker-prod-deps --chown=vibeguard:nodejs /app/apps/worker/node_modules ./apps/worker/node_modules
COPY --from=worker-prod-deps --chown=vibeguard:nodejs /app/packages ./packages

COPY --from=web-builder --chown=vibeguard:nodejs /app/apps/worker/package.json ./apps/worker/package.json
COPY --from=web-builder --chown=vibeguard:nodejs /app/apps/worker/src ./apps/worker/src
COPY --from=web-builder --chown=vibeguard:nodejs /app/packages/content/package.json ./packages/content/package.json
COPY --from=web-builder --chown=vibeguard:nodejs /app/packages/content/src ./packages/content/src
COPY --from=web-builder --chown=vibeguard:nodejs /app/packages/db/package.json ./packages/db/package.json
COPY --from=web-builder --chown=vibeguard:nodejs /app/packages/db/scripts ./packages/db/scripts
COPY --from=web-builder --chown=vibeguard:nodejs /app/packages/db/src ./packages/db/src
COPY --from=web-builder --chown=vibeguard:nodejs /app/packages/llm/package.json ./packages/llm/package.json
COPY --from=web-builder --chown=vibeguard:nodejs /app/packages/llm/src ./packages/llm/src
COPY --from=web-builder --chown=vibeguard:nodejs /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=web-builder --chown=vibeguard:nodejs /app/packages/shared/src ./packages/shared/src
COPY --from=web-builder --chown=root:root /app/scripts/docker-entrypoint.sh ./scripts/docker-entrypoint.sh
COPY --from=web-builder --chown=vibeguard:nodejs /app/scripts/load-env.mjs ./scripts/load-env.mjs
COPY --from=web-builder --chown=vibeguard:nodejs /app/scripts/start-stack.mjs ./scripts/start-stack.mjs

RUN mkdir -p data/osv-cache data/osv-bootstrap data/enrichment-cache \
  && chown -R vibeguard:nodejs data

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=5 \
  CMD node -e "const port=process.env.PORT||3000;fetch('http://127.0.0.1:'+port+'/api/overview').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["sh", "/app/scripts/docker-entrypoint.sh"]
CMD ["node", "scripts/start-stack.mjs"]
