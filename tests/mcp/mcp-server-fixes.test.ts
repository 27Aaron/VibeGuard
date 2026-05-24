import fs from "node:fs"

import { describe, expect, it } from "vitest"

describe("MCP server critical fixes", () => {
  // ---------------------------------------------------------------------------
  // CFG-02: All fetch calls must include a timeout signal
  // ---------------------------------------------------------------------------
  describe("CFG-02 — client fetch timeout", () => {
    const clientSource = fs.readFileSync(
      "packages/mcp-server/src/client.ts",
      "utf8",
    )

    it("all API fetch calls include AbortSignal.timeout(30_000)", () => {
      const timeoutMatches = clientSource.match(/AbortSignal\.timeout\(30_000\)/g)
      expect(timeoutMatches).toHaveLength(8)
    })

    it("searchArticles GET fetch passes timeout signal in options object", () => {
      expect(clientSource).toMatch(
        /fetch\(`\$\{this\.baseUrl\}\/api\/articles\?\$\{searchParams\}`, \{ signal: AbortSignal\.timeout\(30_000\) \}\)/,
      )
    })

    it("getArticle GET fetch passes timeout signal in options object", () => {
      expect(clientSource).toMatch(
        /fetch\(`\$\{this\.baseUrl\}\/api\/articles\/\$\{id\}\?\$\{searchParams\}`, \{ signal: AbortSignal\.timeout\(30_000\) \}\)/,
      )
    })

    it("checkPackages POST fetch includes signal alongside method/headers/body", () => {
      expect(clientSource).toMatch(
        /method: "POST"[\s\S]*?headers: \{ "Content-Type": "application\/json" \}[\s\S]*?signal: AbortSignal\.timeout\(30_000\)/,
      )
    })

    it("securityOverview GET fetch passes timeout signal in options object", () => {
      expect(clientSource).toMatch(
        /fetch\(`\$\{this\.baseUrl\}\/api\/security\/check\/overview`, \{ signal: AbortSignal\.timeout\(30_000\) \}\)/,
      )
    })
  })

  // ---------------------------------------------------------------------------
  // CFG-03: Zod schema validation in server wrapper
  // ---------------------------------------------------------------------------
  describe("CFG-03 — Zod input validation", () => {
    const serverSource = fs.readFileSync(
      "packages/mcp-server/src/server.ts",
      "utf8",
    )
    const toolsSource = fs.readFileSync(
      "packages/mcp-server/src/tools.ts",
      "utf8",
    )

    it("server.ts imports z from zod", () => {
      expect(serverSource).toMatch(/import \{ z \} from ["']zod["']/)
    })

    it("server wrapper builds a Zod schema from tool.inputSchema and calls safeParse", () => {
      expect(serverSource).toContain("z.object(tool.inputSchema)")
      expect(serverSource).toContain("schema.safeParse(args)")
    })

    it("server wrapper returns an error response when validation fails", () => {
      expect(serverSource).toContain("if (!parsed.success)")
      expect(serverSource).toContain("参数错误:")
      expect(serverSource).toContain("isError: true")
    })

    it("server wrapper passes parsed.data (not raw args) to the tool handler", () => {
      expect(serverSource).toContain("tool.handler(client, parsed.data)")
      expect(serverSource).not.toMatch(/tool\.handler\(client,\s*args\)/)
    })

    it("validation guard is placed BEFORE the handler invocation", () => {
      const parseIndex = serverSource.indexOf("schema.safeParse(args)")
      const handlerIndex = serverSource.indexOf("tool.handler(client, parsed.data)")
      expect(parseIndex).toBeGreaterThan(0)
      expect(handlerIndex).toBeGreaterThan(0)
      expect(handlerIndex).toBeGreaterThan(parseIndex)
    })

    it("tools define meaningful inputSchema with Zod validators", () => {
      // get_article requires a string id
      expect(toolsSource).toMatch(
        /name: "get_article"[\s\S]*?id: z\.string\(\)\.describe\("文章 UUID"\)/,
      )
      // check_packages uses min(1).max(100) array validation
      expect(toolsSource).toMatch(/z\.array\([\s\S]*?\)\.min\(1\)\.max\(100\)/)
      // search_articles uses z.enum for ecosystem (references variable name)
      expect(toolsSource).toMatch(/ecosystem: z\.enum\(MCP_ECOSYSTEMS\)/)
      // search_articles also has z.enum for lang
      expect(toolsSource).toMatch(/lang: z\.enum\(\["zh", "en"\]\)/)
    })

    it("empty inputSchema (security_overview) still works — z.object({}) accepts any object", () => {
      expect(toolsSource).toMatch(
        /name: "security_overview"[\s\S]*?inputSchema: \{\s*\}/,
      )
    })

    it("error response uses the same content shape as success responses", () => {
      const textTypePattern = /\{ type: "text", text:/g
      const matches = serverSource.match(textTypePattern)
      expect(matches?.length).toBeGreaterThanOrEqual(3)
    })
  })
})
