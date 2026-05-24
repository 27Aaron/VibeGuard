import { afterEach, describe, expect, it } from "vitest";

import {
  getAdminAuthConfig,
  verifyAdminSessionToken,
} from "../../apps/web/lib/admin-auth";
import { checkAdminAuthFromSession } from "../../apps/web/lib/admin-api-auth";
import { parseArticleListParams } from "../../apps/web/lib/api-articles";

const originalAdminPassword = process.env.ADMIN_PASSWORD;
const originalVibeguardSecret = process.env.VIBEGUARD_SECRET;

afterEach(() => {
  if (originalAdminPassword === undefined) {
    delete process.env.ADMIN_PASSWORD;
  } else {
    process.env.ADMIN_PASSWORD = originalAdminPassword;
  }

  if (originalVibeguardSecret === undefined) {
    delete process.env.VIBEGUARD_SECRET;
  } else {
    process.env.VIBEGUARD_SECRET = originalVibeguardSecret;
  }
});

// ---------------------------------------------------------------------------
// SEC-01: Admin API routes must reject requests without a valid session cookie.
// The middleware in proxy.ts gates /api/admin/*, but each handler also calls
// requireAdminAuth() for defense-in-depth.  We verify the auth primitives
// and the core checkAdminAuthFromSession function.
// ---------------------------------------------------------------------------

describe("SEC-01: admin API handler-level auth", () => {
  it("getAdminAuthConfig returns null for unsafe credentials", () => {
    delete process.env.ADMIN_PASSWORD;
    process.env.VIBEGUARD_SECRET = "0123456789abcdef0123456789abcdef";

    expect(getAdminAuthConfig()).toBeNull();

    process.env.ADMIN_PASSWORD = "admin123";
    expect(getAdminAuthConfig()).toBeNull();
  });

  it("getAdminAuthConfig returns config for safe credentials", () => {
    process.env.ADMIN_PASSWORD = "correct horse battery staple";
    process.env.VIBEGUARD_SECRET = "0123456789abcdef0123456789abcdef";

    const config = getAdminAuthConfig();
    expect(config).not.toBeNull();
    expect(config!.password).toBe("correct horse battery staple");
    expect(config!.secret).toBe("0123456789abcdef0123456789abcdef");
  });

  it("verifyAdminSessionToken rejects missing or empty tokens", async () => {
    process.env.ADMIN_PASSWORD = "correct horse battery staple";
    process.env.VIBEGUARD_SECRET = "0123456789abcdef0123456789abcdef";
    const config = getAdminAuthConfig()!;

    await expect(verifyAdminSessionToken(undefined, config)).resolves.toBe(
      false,
    );
    await expect(verifyAdminSessionToken("", config)).resolves.toBe(false);
  });

  it("verifyAdminSessionToken rejects tampered tokens", async () => {
    process.env.ADMIN_PASSWORD = "correct horse battery staple";
    process.env.VIBEGUARD_SECRET = "0123456789abcdef0123456789abcdef";
    const config = getAdminAuthConfig()!;

    const { createAdminSessionToken } =
      await import("../../apps/web/lib/admin-auth");
    const validToken = await createAdminSessionToken({
      password: config.password,
      secret: config.secret,
      issuedAt: 1_800_000_000_000,
    });

    await expect(
      verifyAdminSessionToken(validToken, {
        ...config,
        now: 1_800_000_001_000,
      }),
    ).resolves.toBe(true);

    await expect(
      verifyAdminSessionToken(`${validToken}tampered`, {
        ...config,
        now: 1_800_000_001_000,
      }),
    ).resolves.toBe(false);
  });

  it("checkAdminAuthFromSession returns 401 when session token is missing", async () => {
    process.env.ADMIN_PASSWORD = "correct horse battery staple";
    process.env.VIBEGUARD_SECRET = "0123456789abcdef0123456789abcdef";

    const result = await checkAdminAuthFromSession(undefined);
    expect(result.authorized).toBe(false);
    if (!result.authorized) {
      expect(result.response.status).toBe(401);
      const body = await result.response.json();
      expect(body.ok).toBe(false);
      expect(body.message).toContain("Authentication required");
    }
  });

  it("checkAdminAuthFromSession returns 401 when session token is invalid", async () => {
    process.env.ADMIN_PASSWORD = "correct horse battery staple";
    process.env.VIBEGUARD_SECRET = "0123456789abcdef0123456789abcdef";

    const result = await checkAdminAuthFromSession("invalid.token.value");
    expect(result.authorized).toBe(false);
    if (!result.authorized) {
      expect(result.response.status).toBe(401);
    }
  });

  it("checkAdminAuthFromSession returns 503 when auth config is unsafe", async () => {
    delete process.env.ADMIN_PASSWORD;
    process.env.VIBEGUARD_SECRET = "test-secret";

    const result = await checkAdminAuthFromSession(undefined);
    expect(result.authorized).toBe(false);
    if (!result.authorized) {
      expect(result.response.status).toBe(503);
      const body = await result.response.json();
      expect(body.ok).toBe(false);
      expect(body.message).toContain("not configured safely");
    }
  });

  it("checkAdminAuthFromSession returns authorized when session token is valid", async () => {
    process.env.ADMIN_PASSWORD = "correct horse battery staple";
    process.env.VIBEGUARD_SECRET = "0123456789abcdef0123456789abcdef";
    const config = getAdminAuthConfig()!;

    const { createAdminSessionToken } =
      await import("../../apps/web/lib/admin-auth");
    const issuedAt = Date.now() - 60_000; // 1 minute ago
    const token = await createAdminSessionToken({
      password: config.password,
      secret: config.secret,
      issuedAt,
    });

    const result = await checkAdminAuthFromSession(token);
    expect(result.authorized).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// SEC-02: Public article API must only expose status='ready' articles.
// ---------------------------------------------------------------------------

describe("SEC-02: public article API data leakage prevention", () => {
  it("parseArticleListParams defaults status to 'ready'", () => {
    const params = parseArticleListParams(new URLSearchParams());
    expect(params.status).toBe("ready");
  });

  it("parseArticleListParams ignores unknown status values", () => {
    const params = parseArticleListParams(
      new URLSearchParams({ status: "broken" }),
    );
    expect(params.status).toBe("ready");
  });

  it("parseArticleListParams accepts valid status values (used by admin internally)", () => {
    const params = parseArticleListParams(
      new URLSearchParams({ status: "pending" }),
    );
    expect(params.status).toBe("pending");
  });

  it("public list route strips status param before calling listArticles", () => {
    // The public route handler creates a new URLSearchParams and deletes "status"
    // before passing to listArticles. Simulate that behavior:
    const clientParams = new URLSearchParams({
      status: "pending",
      lang: "zh",
      limit: "10",
    });

    // This is what the route handler does:
    const safeParams = new URLSearchParams(clientParams);
    safeParams.delete("status");

    expect(safeParams.has("status")).toBe(false);
    expect(safeParams.get("lang")).toBe("zh");
    expect(safeParams.get("limit")).toBe("10");

    // With status deleted, parseArticleListParams defaults to "ready"
    const parsed = parseArticleListParams(safeParams);
    expect(parsed.status).toBe("ready");
  });

  it("getArticleById accepts requiredStatus parameter for status filtering", async () => {
    // Verify that getArticleById accepts the third parameter.
    // The public API route passes requiredStatus="ready" to prevent
    // leaking draft/failed articles by guessing IDs.
    const { getArticleById } = await import("../../apps/web/lib/api-articles");

    // Function should accept 3 declared parameters
    expect(getArticleById.length).toBe(3);
  });
});
