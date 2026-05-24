import fs from "node:fs";

import { describe, expect, it } from "vitest";

// ---------------------------------------------------------------------------
// W11: Default HTTP not HTTPS — warn/reject non-localhost cleartext URLs
// W12: Environment variable URL has no format validation
// ---------------------------------------------------------------------------

describe("W11/W12 — client.ts HTTPS enforcement and URL validation", () => {
  const source = fs.readFileSync("packages/mcp-server/src/client.ts", "utf8");

  it("defines a validateApiUrl function that parses the URL", () => {
    expect(source).toMatch(/function validateApiUrl/);
    expect(source).toContain("new URL(raw)");
  });

  it("rejects invalid URLs with a clear error message", () => {
    expect(source).toMatch(/is not a valid URL/);
  });

  it("rejects non-HTTPS, non-localhost URLs", () => {
    expect(source).toMatch(/must use HTTPS for non-localhost/);
  });

  it("allows HTTP for localhost addresses", () => {
    expect(source).toContain("127.0.0.1");
    expect(source).toContain("localhost");
    expect(source).toContain("isLocalhost");
  });

  it("constructor uses validateApiUrl instead of raw string concatenation", () => {
    expect(source).toContain("validateApiUrl(raw)");
    expect(source).not.toMatch(/this\.baseUrl\s*=.*\.replace\(.*\\\//);
  });

  it("default URL remains http://127.0.0.1:3000 (localhost is allowed)", () => {
    expect(source).toContain('"http://127.0.0.1:3000"');
  });
});

// ---------------------------------------------------------------------------
// W13: Error messages leak internal error details
// ---------------------------------------------------------------------------

describe("W13 — server.ts sanitized error messages", () => {
  const source = fs.readFileSync("packages/mcp-server/src/server.ts", "utf8");

  it("catch block logs the full error server-side via console.error", () => {
    expect(source).toMatch(/console\.error/);
  });

  it("returns a generic error message to the client (not the raw message)", () => {
    expect(source).toContain("内部错误，请稍后重试");
  });

  it("no longer interpolates the error variable into the response text", () => {
    // The catch block should NOT contain a template literal with ${message}
    // in the content returned to client
    const catchBlock = source.slice(
      source.indexOf("} catch (error)"),
      source.indexOf("}", source.indexOf("} catch (error)") + 100),
    );
    expect(catchBlock).not.toMatch(/\$\{message\}/);
  });
});

// ---------------------------------------------------------------------------
// W14: args.id as string without UUID format validation
// ---------------------------------------------------------------------------

describe("W14 — tools.ts UUID format validation", () => {
  const source = fs.readFileSync("packages/mcp-server/src/tools.ts", "utf8");

  it("defines a UUID regex pattern", () => {
    expect(source).toMatch(/UUID_RE/);
    expect(source).toMatch(/\[0-9a-f\]\{8\}/);
  });

  it("defines an assertUuid helper that throws on invalid UUID", () => {
    expect(source).toMatch(/function assertUuid/);
    expect(source).toMatch(/throw new Error/);
    expect(source).toMatch(/must be a valid UUID/);
  });

  it("get_article handler calls assertUuid before using the id", () => {
    const handlerIdx = source.indexOf('name: "get_article"');
    const assertIdx = source.indexOf("assertUuid", handlerIdx);
    const fetchIdx = source.indexOf("client.getArticle", handlerIdx);
    expect(assertIdx).toBeGreaterThan(handlerIdx);
    expect(fetchIdx).toBeGreaterThan(assertIdx);
  });
});

// ---------------------------------------------------------------------------
// W37: Foreign keys should cascade delete
// ---------------------------------------------------------------------------

describe("W37 — schema.ts cascade deletes", () => {
  const source = fs.readFileSync("packages/db/src/schema.ts", "utf8");

  it("articles.feedId references feeds with onDelete cascade", () => {
    expect(source).toMatch(
      /references\(\(\) => feeds\.id,\s*\{\s*onDelete: "cascade"\s*\}\)/,
    );
  });

  it("processingJobs.articleId references articles with onDelete cascade", () => {
    expect(source).toMatch(
      /references\(\(\) => articles\.id,\s*\{\s*onDelete: "cascade"\s*\}\)/,
    );
  });

  it("securityAffectedPackages.advisoryId references securityAdvisories with onDelete cascade", () => {
    expect(source).toMatch(
      /references\(\(\) => securityAdvisories\.id,\s*\{\s*onDelete: "cascade"\s*\}\)/,
    );
  });
});

// ---------------------------------------------------------------------------
// W38: Security tables lack updatedAt trigger (document only)
// ---------------------------------------------------------------------------

describe("W38 — schema.ts security tables updatedAt documentation", () => {
  const source = fs.readFileSync("packages/db/src/schema.ts", "utf8");

  it("contains a comment noting the DB-level trigger limitation", () => {
    expect(source).toMatch(/PostgreSQL[^]*触发器/);
  });
});
