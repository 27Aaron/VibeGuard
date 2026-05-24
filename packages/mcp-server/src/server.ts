import fs from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { VibeGuardClient } from "./client";
import { tools } from "./tools";

async function readPackageVersion(): Promise<string> {
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    const raw = await fs.readFile(join(here, "..", "package.json"), "utf8");
    return JSON.parse(raw).version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

const version = await readPackageVersion();

export function createMcpServer(client: VibeGuardClient) {
  const server = new McpServer({
    name: "vibeguard",
    version,
  });

  for (const tool of tools) {
    server.tool(
      tool.name,
      tool.description,
      tool.inputSchema,
      async (args: Record<string, unknown>) => {
        try {
          const schema = z.object(tool.inputSchema);
          const parsed = schema.safeParse(args);
          if (!parsed.success) {
            return {
              content: [
                { type: "text", text: `参数错误: ${parsed.error.message}` },
              ],
              isError: true,
            };
          }
          const result = await tool.handler(client, parsed.data);
          return { content: [{ type: "text", text: result }] };
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          console.error("[MCP tool error]", tool.name, message);

          return {
            content: [{ type: "text", text: "内部错误，请稍后重试" }],
            isError: true,
          };
        }
      },
    );
  }

  return server;
}
