import { describe, expect, it } from "vitest"

import {
  buildTagExtractionPrompt,
  extractGeneratedTags,
  normalizeGeneratedTags,
  resolveTagPrompt,
} from "../packages/llm/src/tags"

describe("LLM short tags", () => {
  it("injects only the original article body into the configured tag prompt", () => {
    const prompt = buildTagExtractionPrompt({
      systemPrompt: "Extract tags from this original body only: {{content}}",
      sourceText: "Original English body",
    })

    expect(prompt).toContain("Original English body")
    expect(prompt).not.toContain("title")
    expect(prompt).not.toContain("summary")
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
      "{{content}}",
    )
  })
})
