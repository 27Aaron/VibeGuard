import fs from "node:fs";

import { describe, expect, it } from "vitest";

import { resolveWorkerMaxIterations } from "../../apps/worker/src/index";

describe("Docker production runtime", () => {
  it("builds a slim runtime from Next standalone output and worker production deps", () => {
    const dockerfile = fs.readFileSync("Dockerfile", "utf8");
    const nextConfig = fs.readFileSync("apps/web/next.config.ts", "utf8");

    expect(nextConfig).toContain('output: "standalone"');
    expect(dockerfile).toContain(
      "pnpm install --prod --frozen-lockfile --filter worker...",
    );
    expect(dockerfile).toContain("/app/apps/web/.next/standalone");
    expect(dockerfile).toContain("/app/node_modules ./node_modules");
    expect(dockerfile).toContain("apk add --no-cache su-exec");
    expect(dockerfile).toContain(
      "COPY --from=web-builder --chown=root:root /app/scripts/docker-entrypoint.sh ./scripts/docker-entrypoint.sh",
    );
    expect(dockerfile).toContain(
      'ENTRYPOINT ["sh", "/app/scripts/docker-entrypoint.sh"]',
    );
    expect(dockerfile).toContain("HEALTHCHECK");
    expect(dockerfile.split("FROM node:24-alpine AS runner")[1]).not.toContain(
      "COPY . .",
    );
  });

  it("repairs writable data mount permissions before dropping privileges", () => {
    const entrypoint = fs.readFileSync("scripts/docker-entrypoint.sh", "utf8");

    expect(entrypoint).toContain('ensure_writable_dir "/app/data/osv-cache"');
    expect(entrypoint).toContain(
      'ensure_writable_dir "/app/data/osv-bootstrap"',
    );
    expect(entrypoint).toContain(
      'ensure_writable_dir "/app/data/enrichment-cache"',
    );
    expect(entrypoint).toContain("chown -R vibeguard:nodejs");
    expect(entrypoint).toContain("chmod -R u+rwX");
    expect(entrypoint).toContain('exec su-exec vibeguard:nodejs "$@"');
  });

  it("starts database migration, web, and worker from the production entrypoint", () => {
    const script = fs.readFileSync("scripts/start-stack.mjs", "utf8");

    expect(script).toContain("bootstrapDatabase");
    expect(script).toContain("packages/db");
    expect(script).toContain("scripts/migrate.mjs");
    expect(script).toContain('"server.js"');
    expect(script).toContain('"src/index.ts"');
    expect(script.indexOf("await bootstrapDatabase()")).toBeLessThan(
      script.indexOf('spawnService("web"'),
    );
  });

  it("lets production containers run the worker without an iteration cap", () => {
    expect(resolveWorkerMaxIterations("0")).toBe(Number.POSITIVE_INFINITY);
    expect(resolveWorkerMaxIterations("infinite")).toBe(
      Number.POSITIVE_INFINITY,
    );
    expect(resolveWorkerMaxIterations("25")).toBe(25);
    expect(resolveWorkerMaxIterations("bad")).toBe(1000);
  });

  it("wires compose to .env, the postgres service, and health checks", () => {
    const compose = fs.readFileSync("compose.yaml", "utf8");
    const buildCompose = fs.readFileSync("compose.build.yaml", "utf8");
    const postgresSection = compose.split("\n  postgres:")[1] ?? "";

    expect(compose).toContain("env_file:");
    expect(compose).toContain("- .env");
    expect(compose).toContain("image: ${VIBEGUARD_IMAGE:-ghcr.io/27aaron/vibeguard:latest}");
    expect(compose).not.toContain("build:");
    expect(buildCompose).toContain("build:");
    expect(buildCompose).toContain("dockerfile: Dockerfile");
    expect(compose).toContain(
      "DATABASE_URL: postgresql://${POSTGRES_USER:-postgres}:${POSTGRES_PASSWORD:-postgres}@vibeguard:5432/${POSTGRES_DB:-vibeguard}",
    );
    expect(compose).toContain('"127.0.0.1:${PORT:-3000}:3000"');
    expect(compose).toContain("./data/osv-cache:/app/data/osv-cache");
    expect(compose).toContain("./data/osv-bootstrap:/app/data/osv-bootstrap");
    expect(compose).toContain(
      "./data/enrichment-cache:/app/data/enrichment-cache",
    );
    expect(compose).toContain("./data/postgres:/var/lib/postgresql");
    expect(compose).toContain("container_name: vibeguard");
    expect(compose).toContain(
      'pg_isready -U "$$POSTGRES_USER" -d "$$POSTGRES_DB"',
    );
    expect(postgresSection).not.toContain("ports:");
    expect(compose).not.toContain("POSTGRES_PORT");
    expect(compose).toContain("condition: service_healthy");
    expect(compose.match(/healthcheck:/g)).toHaveLength(2);
    expect(fs.readFileSync(".gitignore", "utf8")).toContain("data/postgres/");
  });

  it("publishes multi-architecture GHCR images only when manually dispatched", () => {
    const workflow = fs.readFileSync(
      ".github/workflows/docker-image.yml",
      "utf8",
    );

    expect(workflow).toContain("on:\n  push:\n");
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).not.toContain("\n  pull_request:\n");
    expect(workflow).toContain("REGISTRY: ghcr.io");
    expect(workflow).toContain("docker/setup-qemu-action@v4");
    expect(workflow).toContain("docker/setup-buildx-action@v4");
    expect(workflow).toContain("docker/metadata-action@v6");
    expect(workflow).toContain("docker/build-push-action@v7");
    expect(workflow).toContain("platforms: linux/amd64,linux/arm64");
    expect(workflow).toContain("push: true");
    expect(workflow).toContain("cache-to: type=gha,mode=max");
  });
});
