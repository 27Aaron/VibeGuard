import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"

import type { VibeGuardClient } from "./client"
import { tools } from "./tools"

export function createMcpServer(client: VibeGuardClient) {
  const server = new McpServer({
    name: "vibeguard",
    version: "0.1.0",
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
