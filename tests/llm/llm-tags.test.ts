import { describe, expect, it } from "vitest"

import {
  buildTagExtractionPrompt,
  extractGeneratedTags,
  normalizeGeneratedTags,
  resolveTagPrompt,
} from "../../packages/llm/src/tags"

describe("LLM short tags", () => {
  it("separates system prompt from article body", () => {
    const { systemPrompt, userContent } = buildTagExtractionPrompt({
      systemPrompt: "Extract tags from this body only.",
      sourceText: "Original English body",
    })

    expect(systemPrompt).toBe("Extract tags from this body only.")
    expect(userContent).toBe("Original English body")
    expect(userContent).not.toContain("title")
    expect(userContent).not.toContain("summary")
  })

  it("normalizes model tags into short display tags", () => {
    expect(
      normalizeGeneratedTags([
        "NPM",
        "PyPI",
        "GitHub Actions",
        "credential-theft",
        "supply-chain",
        "this-tag-is-way-too-long",
      ]),
    ).toEqual(["npm", "pypi", "actions", "creds"])
  })

  it("parses fenced strict JSON output from the model", () => {
    expect(
      extractGeneratedTags(
        '```json\n{ "tags": ["GitHub Actions", "runner-security", "runtime"] }\n```',
      ),
    ).toEqual(["actions", "runner", "runtime"])
  })

  it("upgrades the migration placeholder prompt to the full default prompt", () => {
    expect(resolveTagPrompt("Extract short supply-chain security tags as strict JSON.")).toContain(
      "supply-chain security",
    )
  })
})
