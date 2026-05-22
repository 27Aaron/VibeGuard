import fs from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"

import type { VibeGuardClient } from "./client"
import { tools } from "./tools"

function readPackageVersion(): string {
  try {
    const here = dirname(fileURLToPath(import.meta.url))
    const raw = fs.readFileSync(join(here, "..", "package.json"), "utf8")
    return JSON.parse(raw).version ?? "0.0.0"
  } catch {
    return "0.0.0"
  }
}

const version = readPackageVersion()

export function createMcpServer(client: VibeGuardClient) {
  const server = new McpServer({
    name: "vibeguard",
    version,
  })

  for (const tool of tools) {
    server.tool(
      tool.name,
      tool.description,
      tool.inputSchema,
      async (args: Record<string, unknown>) => {
        try {
          const result = await tool.handler(client, args)
          return { content: [{ type: "text" as const, text: result }] }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)

          return {
            content: [{ type: "text" as const, text: `错误: ${message}` }],
            isError: true,
          }
        }
      },
    )
  }

  return server
}
