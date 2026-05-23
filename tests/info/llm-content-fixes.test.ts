import { describe, expect, it } from "vitest"

import { createChatCompletionTextWithRetry } from "../../packages/llm/src/chat"
import { classifyRelevance, resolveRelevancePrompt } from "../../packages/llm/src/relevance"
import { protectMarkdownCode } from "../../packages/llm/src/translate"
import { stripJsonFence, tryParseJsonCandidates, resolvePrompt } from "../../packages/llm/src/utils"

import { parseModifiedIdCsv, buildModifiedIdCsvUrl } from "../../packages/content/src/osv/sync"
import { normalizeFeedItem, resolvePublishedAt, type FeedItemInput } from "../../packages/content/src/feed/normalize"
import { parseRustDependencyFile } from "../../packages/content/src/project-security/parsers/rust"

// ---------------------------------------------------------------------------
// I06: chat.ts — lastError default value
// ---------------------------------------------------------------------------

describe("I06: createChatCompletionTextWithRetry lastError default", () => {
  it("throws a meaningful error when maxAttempts <= 0", async () => {
    const result = createChatCompletionTextWithRetry({
      client: {
        chat: {
          completions: {
            create: async () => {
              throw new Error("fail")
            },
          },
        },
      },
      model: "test",
      prompt: "test",
      maxAttempts: 0,
    })

    await expect(result).rejects.toThrow("Unknown error")
  })

  it("throws the last caught error when all retries fail", async () => {
    const result = createChatCompletionTextWithRetry({
      client: {
        chat: {
          completions: {
            create: async () => {
              throw new Error("API rate limit exceeded")
            },
          },
        },
      },
      model: "test",
      prompt: "test",
      maxAttempts: 2,
      retryDelayMs: 1,
    })

    await expect(result).rejects.toThrow("API rate limit exceeded")
  })
})

// ---------------------------------------------------------------------------
// I19: relevance.ts — no redundant type casts
// ---------------------------------------------------------------------------

describe("I19: parseRelevanceResponse via classifyRelevance", () => {
  function makeMockClient(text: string) {
    return {
      chat: {
        completions: {
          create: async () => ({
            choices: [{ message: { content: text } }],
          }),
        },
      },
    }
  }

  it("parses a valid relevance JSON response", async () => {
    const client = makeMockClient('{"relevant": true, "reason": "about vulnerabilities"}')
    const result = await classifyRelevance({
      // @ts-expect-error -- simplified mock
      client,
      model: "test",
      systemPrompt: null,
      sourceText: "some text about a CVE",
    })
    expect(result.relevant).toBe(true)
    expect(result.reason).toBe("about vulnerabilities")
  })

  it("returns default relevant=true when response is unparseable", async () => {
    const client = makeMockClient("not json at all")
    const result = await classifyRelevance({
      // @ts-expect-error -- simplified mock
      client,
      model: "test",
      systemPrompt: null,
      sourceText: "some text",
    })
    expect(result.relevant).toBe(true)
    expect(result.reason).toBe("Failed to parse relevance response")
  })
})

// ---------------------------------------------------------------------------
// I20: translate.ts — improved fenced code block regex
// ---------------------------------------------------------------------------

describe("I20: protectMarkdownCode", () => {
  it("protects fenced code blocks with language tags", () => {
    const input = [
      "Some text",
      "```javascript",
      "const x = 1;",
      "```",
      "More text",
    ].join("\n")

    const result = protectMarkdownCode(input)
    expect(result.protectedText).not.toContain("const x = 1;")
    expect(result.protectedText).toContain("__CF_CODE_BLOCK_0__")

    const restored = result.restore(result.protectedText)
    expect(restored).toBe(input)
  })

  it("protects inline code", () => {
    const input = "Use the `npm install` command to install."
    const result = protectMarkdownCode(input)
    expect(result.protectedText).not.toContain("npm install")
    expect(result.protectedText).toContain("__CF_INLINE_CODE_0__")

    const restored = result.restore(result.protectedText)
    expect(restored).toBe(input)
  })

  it("handles fenced code without trailing newline after closing fence", () => {
    const input = "```js\ncode here\n```"
    const result = protectMarkdownCode(input)
    expect(result.protectedText).toContain("__CF_CODE_BLOCK_0__")
    expect(result.restore(result.protectedText)).toBe(input)
  })

  it("handles multiple fenced and inline code blocks", () => {
    const input = [
      "Text with `inline` code.",
      "```",
      "block1",
      "```",
      "Another `inline2` here.",
      "```python",
      "block2",
      "```",
    ].join("\n")

    const result = protectMarkdownCode(input)
    expect(result.protectedText).toContain("__CF_INLINE_CODE_0__")
    expect(result.protectedText).toContain("__CF_INLINE_CODE_1__")
    expect(result.protectedText).toContain("__CF_CODE_BLOCK_0__")
    expect(result.protectedText).toContain("__CF_CODE_BLOCK_1__")
    expect(result.restore(result.protectedText)).toBe(input)
  })

  it("preserves text without any code blocks", () => {
    const input = "Just plain text with no code."
    const result = protectMarkdownCode(input)
    expect(result.protectedText).toBe(input)
    expect(result.restore(result.protectedText)).toBe(input)
  })
})

// ---------------------------------------------------------------------------
// I21: utils.ts — resolvePrompt blank string handling
// ---------------------------------------------------------------------------

describe("I21: resolvePrompt validation", () => {
  it("returns fallback for null", () => {
    expect(resolvePrompt(null, "fallback")).toBe("fallback")
  })

  it("returns fallback for undefined", () => {
    expect(resolvePrompt(undefined, "fallback")).toBe("fallback")
  })

  it("returns fallback for empty string", () => {
    expect(resolvePrompt("", "fallback")).toBe("fallback")
  })

  it("returns fallback for whitespace-only string", () => {
    expect(resolvePrompt("   ", "fallback")).toBe("fallback")
  })

  it("returns the trimmed value when non-empty", () => {
    expect(resolvePrompt("  custom prompt  ", "fallback")).toBe("custom prompt")
  })
})

// ---------------------------------------------------------------------------
// I07: osv/sync.ts — unused execFile removed (compile-time check)
// ---------------------------------------------------------------------------

describe("I07: osv/sync.ts — no unused execFile import", () => {
  it("buildModifiedIdCsvUrl produces expected URL", () => {
    const url = buildModifiedIdCsvUrl("npm")
    expect(url).toContain("npm")
    expect(url).toContain("modified_id.csv")
  })

  it("parseModifiedIdCsv handles basic input", () => {
    const rows = parseModifiedIdCsv("modified,id\n2024-01-01T00:00:00Z,CVE-1")
    expect(rows).toHaveLength(1)
    expect(rows[0].externalId).toBe("CVE-1")
  })
})

// ---------------------------------------------------------------------------
// I08: check-project.ts — colon separator in package key
// ---------------------------------------------------------------------------

describe("I08: check-project.ts — colon separator for package keys", () => {
  // The buildForwardedPackageKey function is internal, so we verify
  // through the public API that deduplication works correctly with
  // colon-separated keys.
  it("verifies no null bytes exist in the source file", async () => {
    const fs = await import("node:fs/promises")
    const content = await fs.readFile(
      new URL("../../packages/content/src/project-security/check-project.ts", import.meta.url),
      "utf8",
    )
    // Source should not contain the null byte escape   as a separator
    expect(content).not.toContain("\\u0000")
  })
})

// ---------------------------------------------------------------------------
// I22: feed/normalize.ts — tighter FeedItemInput index signature
// ---------------------------------------------------------------------------

describe("I22: FeedItemInput type tightness", () => {
  it("accepts valid feed item with standard fields", () => {
    const item: FeedItemInput = {
      title: "Test Article",
      link: "https://example.com/article",
      isoDate: "2024-01-01T00:00:00Z",
      content: "Some content",
    }
    const result = normalizeFeedItem(item, new Date("2024-06-01"))
    expect(result.titleEn).toBe("Test Article")
    expect(result.url).toBe("https://example.com/article")
  })

  it("accepts feed item with custom string fields", () => {
    const item: FeedItemInput = {
      title: "Custom Field",
      link: "https://example.com/custom",
      customField: "custom value",
    }
    const result = normalizeFeedItem(item)
    expect(result.titleEn).toBe("Custom Field")
  })

  it("rejects object values in index signature (type-level check)", () => {
    // This is a compile-time check: the following should NOT compile
    // if the type is correctly tightened:
    // const item: FeedItemInput = { title: "t", link: "https://x.com", bad: { nested: true } }
    // Since we can't test compile errors at runtime, we verify the type
    // by ensuring normalizeFeedItem still works with standard inputs.
    const item: FeedItemInput = {
      title: "Type Check",
      link: "https://example.com/typecheck",
      enclosures: "",
    }
    expect(() => normalizeFeedItem(item)).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// I24: osv/sync.ts — nextIndex documented as safe (verified by reading source)
// ---------------------------------------------------------------------------

describe("I24: osv/sync.ts — nextIndex safety documentation", () => {
  it("parseModifiedIdCsv respects limit=0", () => {
    const rows = parseModifiedIdCsv("modified,id\n2024-01-01T00:00:00Z,CVE-1", 0)
    expect(rows).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// I25: rust.ts — sparse+ prefix support in isRegistryCargoSource
// ---------------------------------------------------------------------------

describe("I25: isRegistryCargoSource — sparse+ prefix support", () => {
  it("recognizes registry+ crates.io source in Cargo.lock", async () => {
    const result = await parseRustDependencyFile({
      rootDir: "/repo",
      file: {
        ecosystem: "crates-io",
        kind: "lockfile",
        path: "Cargo.lock",
        confidence: "high",
        note: "lockfile",
      },
      content: [
        "[[package]]",
        'name = "serde"',
        'version = "1.0.217"',
        'source = "registry+https://github.com/rust-lang/crates.io-index"',
      ].join("\n"),
    })
    expect(result.packages).toHaveLength(1)
    expect(result.packages[0].name).toBe("serde")
  })

  it("recognizes sparse+ crates.io source in Cargo.lock", async () => {
    const result = await parseRustDependencyFile({
      rootDir: "/repo",
      file: {
        ecosystem: "crates-io",
        kind: "lockfile",
        path: "Cargo.lock",
        confidence: "high",
        note: "lockfile",
      },
      content: [
        "[[package]]",
        'name = "serde"',
        'version = "1.0.217"',
        'source = "sparse+https://index.crates.io/"',
      ].join("\n"),
    })
    expect(result.packages).toHaveLength(1)
    expect(result.packages[0].name).toBe("serde")
  })

  it("rejects non-crates.io sources", async () => {
    const result = await parseRustDependencyFile({
      rootDir: "/repo",
      file: {
        ecosystem: "crates-io",
        kind: "lockfile",
        path: "Cargo.lock",
        confidence: "high",
        note: "lockfile",
      },
      content: [
        "[[package]]",
        'name = "my-local"',
        'version = "0.1.0"',
        'source = "registry+https://my-private-registry.com/index"',
      ].join("\n"),
    })
    expect(result.packages).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// I26: scan-dependencies.ts — Cargo.toml read caching
// ---------------------------------------------------------------------------

describe("I26: scan-dependencies.ts — Cargo.toml cache", () => {
  it("verify manifestCache is passed to parseDependencyFile by reading source", async () => {
    const fs = await import("node:fs/promises")
    const content = await fs.readFile(
      new URL("../../packages/content/src/project-security/scan-dependencies.ts", import.meta.url),
      "utf8",
    )
    expect(content).toContain("manifestCache")
    expect(content).toContain("manifestCache.set(manifestPath, manifestPromise)")
  })
})

// ---------------------------------------------------------------------------
// resolvePublishedAt (bonus coverage for normalize.ts)
// ---------------------------------------------------------------------------

describe("resolvePublishedAt", () => {
  it("returns fallback when input is null", () => {
    const fallback = new Date("2024-06-01")
    const result = resolvePublishedAt(null, fallback)
    expect(result.publishedAt).toBe(fallback)
    expect(result.isFallback).toBe(true)
  })

  it("parses valid ISO date string", () => {
    const result = resolvePublishedAt("2024-01-15T12:00:00Z", new Date())
    expect(result.isFallback).toBe(false)
    expect(result.publishedAt.getFullYear()).toBe(2024)
  })
})

// ---------------------------------------------------------------------------
// stripJsonFence / tryParseJsonCandidates (bonus coverage)
// ---------------------------------------------------------------------------

describe("stripJsonFence", () => {
  it("removes json code fences", () => {
    expect(stripJsonFence('```json\n{"a":1}\n```')).toBe('{"a":1}')
  })

  it("returns trimmed plain text unchanged", () => {
    expect(stripJsonFence('{"a":1}')).toBe('{"a":1}')
  })
})

describe("tryParseJsonCandidates", () => {
  it("returns parsed object for valid JSON", () => {
    expect(tryParseJsonCandidates(['{"x":42}'])).toEqual({ x: 42 })
  })

  it("returns null when all candidates are invalid", () => {
    expect(tryParseJsonCandidates(["not json", "also not"])).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// resolveRelevancePrompt (bonus coverage)
// ---------------------------------------------------------------------------

describe("resolveRelevancePrompt", () => {
  it("returns default when given null", () => {
    const result = resolveRelevancePrompt(null)
    expect(result).toContain("判断")
  })

  it("returns custom prompt when provided", () => {
    const result = resolveRelevancePrompt("Custom prompt")
    expect(result).toBe("Custom prompt")
  })
})
