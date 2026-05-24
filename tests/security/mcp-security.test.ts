import fs from "node:fs";

import { describe, expect, it } from "vitest";

/**
 * Builds the URL validator by reading the allowed/localhost hostnames from
 * the route source and re-implementing the same logic.
 * Called inside individual tests so failures are reported as test failures.
 */
function buildValidatorFromSource(source: string) {
  const hostnamesMatch = source.match(
    /ALLOWED_PROVIDER_HOSTNAMES[^=]*=\s*new Set\(\[([\s\S]*?)\]\)/,
  );
  const localhostMatch = source.match(
    /LOCALHOST_HOSTNAMES[^=]*=\s*new Set\(\[([\s\S]*?)\]\)/,
  );

  if (!hostnamesMatch || !localhostMatch) {
    throw new Error("Could not parse hostname sets from source");
  }

  const allowed = new Set(
    hostnamesMatch[1]
      .split(",")
      .map((s: string) => s.trim().replace(/"/g, "").replace(/'/g, ""))
      .filter(Boolean),
  );
  const localhost = new Set(
    localhostMatch[1]
      .split(",")
      .map((s: string) => s.trim().replace(/"/g, "").replace(/'/g, ""))
      .filter(Boolean),
  );

  return (baseUrl: string) => {
    let parsed: URL;
    try {
      parsed = new URL(baseUrl);
    } catch {
      return false;
    }

    const hostname = parsed.hostname.toLowerCase();
    if (allowed.has(hostname)) return true;

    if (localhost.has(hostname) && process.env.NODE_ENV === "development") {
      return true;
    }

    return false;
  };
}

describe("SEC-03: MCP endpoint default-closed without token", () => {
  const routeSource = fs.readFileSync("apps/web/app/api/mcp/route.ts", "utf8");

  it("no longer returns true when MCP_API_TOKEN is not set", () => {
    const oldPattern =
      /if\s*\(\s*!MCP_API_TOKEN\s*\)\s*\{\s*\n?\s*return\s+true/;
    expect(
      oldPattern.test(routeSource),
      "Found insecure 'return true' when no token is configured",
    ).toBe(false);
  });

  it("requires NODE_ENV=development to allow unauthenticated access", () => {
    const noTokenBlock = routeSource.match(
      /if\s*\(\s*!MCP_API_TOKEN\s*\)\s*\{[^}]+\}/s,
    );
    expect(noTokenBlock).not.toBeNull();
    expect(noTokenBlock![0]).toContain("NODE_ENV");
    expect(noTokenBlock![0]).toContain("development");
  });

  it("still checks the bearer token against MCP_API_TOKEN when configured", () => {
    expect(routeSource).toContain("constantTimeEquals");
    expect(routeSource).toContain("extractBearerToken");
    expect(routeSource).toContain("MCP_API_TOKEN");
  });

  it("guards POST with isAuthorizedRequest", () => {
    expect(routeSource).toContain("if (!isAuthorizedRequest(request))");
  });

  it("guards DELETE with isAuthorizedRequest", () => {
    const matches = routeSource.match(/isAuthorizedRequest/g);
    expect(matches).not.toBeNull();
    // One in the function body (definition) + one in POST + one in DELETE = 3
    expect(matches!.length).toBeGreaterThanOrEqual(3);
  });
});

describe("SEC-04: provider-models SSRF protection", () => {
  const routeSource = fs.readFileSync(
    "apps/web/app/api/admin/provider-models/route.ts",
    "utf8",
  );

  it("accepts known provider URLs from PROVIDER_PRESETS", () => {
    const isAllowed = buildValidatorFromSource(routeSource);

    expect(isAllowed("https://api.openai.com/v1")).toBe(true);
    expect(isAllowed("https://api.deepseek.com/v1")).toBe(true);
    expect(isAllowed("https://open.bigmodel.cn/api/paas/v4")).toBe(true);
    expect(isAllowed("https://api.moonshot.cn/v1")).toBe(true);
    expect(isAllowed("https://openrouter.ai/api/v1")).toBe(true);
    expect(isAllowed("https://api.siliconflow.cn/v1")).toBe(true);
    expect(isAllowed("https://api.minimax.io/v1")).toBe(true);
    expect(isAllowed("https://api.minimaxi.com/v1")).toBe(true);
    expect(isAllowed("https://api.z.ai/api/paas/v4")).toBe(true);
  });

  it("rejects arbitrary external domains (SSRF prevention)", () => {
    const isAllowed = buildValidatorFromSource(routeSource);

    expect(isAllowed("https://evil.example.com/v1")).toBe(false);
    expect(isAllowed("https://attacker.com")).toBe(false);
    expect(isAllowed("http://169.254.169.254/latest/meta-data/")).toBe(false);
    expect(isAllowed("https://internal-service.local/api")).toBe(false);
  });

  it("rejects malformed URLs", () => {
    const isAllowed = buildValidatorFromSource(routeSource);

    expect(isAllowed("")).toBe(false);
    expect(isAllowed("not-a-url")).toBe(false);
    expect(isAllowed(":::///broken")).toBe(false);
  });

  it("allows localhost in development mode", () => {
    const isAllowed = buildValidatorFromSource(routeSource);
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";

    try {
      expect(isAllowed("http://localhost:3000/v1")).toBe(true);
      expect(isAllowed("http://127.0.0.1:3000/v1")).toBe(true);
      expect(isAllowed("http://[::1]:3000/v1")).toBe(true);
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  it("blocks localhost in production mode", () => {
    const isAllowed = buildValidatorFromSource(routeSource);
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";

    try {
      expect(isAllowed("http://localhost:3000/v1")).toBe(false);
      expect(isAllowed("http://127.0.0.1:3000/v1")).toBe(false);
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  it("the route source calls isAllowedProviderUrl before creating the client", () => {
    expect(routeSource).toContain("isAllowedProviderUrl(baseUrl)");
    expect(routeSource).toContain("Base URL is not allowed");
  });

  it("whitelist covers every hostname from PROVIDER_PRESETS", () => {
    const presetSource = fs.readFileSync(
      "apps/web/lib/provider-presets.ts",
      "utf8",
    );
    const urlMatches = presetSource.matchAll(
      /baseUrl:\s*"(https?:\/\/[^"]+)"/g,
    );
    const presetHosts = new Set(
      [...urlMatches].map((m) => {
        const url = new URL(m[1]);
        return url.hostname.toLowerCase();
      }),
    );

    const hostnamesMatch = routeSource.match(
      /ALLOWED_PROVIDER_HOSTNAMES[^=]*=\s*new Set\(\[([\s\S]*?)\]\)/,
    );
    expect(hostnamesMatch).not.toBeNull();

    const allowedHosts = new Set(
      hostnamesMatch![1]
        .split(",")
        .map((s: string) => s.trim().replace(/"/g, "").replace(/'/g, ""))
        .filter(Boolean),
    );

    for (const host of presetHosts) {
      expect(
        allowedHosts.has(host),
        `PROVIDER_PRESETS hostname "${host}" missing from allowed list`,
      ).toBe(true);
    }
  });
});
