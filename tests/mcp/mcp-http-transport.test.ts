import fs from "node:fs";

import { describe, expect, it } from "vitest";

describe("MCP HTTP transport", () => {
  it("keeps the public MCP route on a session-managed POST transport", () => {
    const route = fs.readFileSync("apps/web/app/api/mcp/route.ts", "utf8");

    expect(route).toContain("const transports = new Map");
    expect(route).toContain(
      'const sessionId = request.headers.get("mcp-session-id")',
    );
    expect(route).toContain("enableJsonResponse: true");
    expect(route).toContain("sessionIdGenerator: () => crypto.randomUUID()");
    expect(route).toContain("transports.set(sessionId, {");
    expect(route).toContain("transports.get(sessionId)");
    expect(route).toContain("export async function POST");
    expect(route).toContain("export async function GET");
    expect(route).toContain("export async function DELETE");
    expect(route).not.toContain("handleMcpRequest as GET");
    expect(route).not.toContain("sessionIdGenerator: undefined");
  });

  it("documents the MCP API base URL for local and deployed clients", () => {
    const envExample = fs.readFileSync(".env.example", "utf8");
    const client = fs.readFileSync("packages/mcp-server/src/client.ts", "utf8");

    expect(envExample).toContain("VIBEGUARD_API_URL=http://127.0.0.1:3000");
    expect(client).toContain('const DEFAULT_API_URL = "http://127.0.0.1:3000"');
    expect(client).not.toContain("https://vibeguard.example.com");
  });

  it("uses an executable shim for the optional stdio entry instead of pointing bin at raw TypeScript", () => {
    const pkg = fs.readFileSync("packages/mcp-server/package.json", "utf8");

    expect(pkg).toContain('"vibeguard-mcp": "./bin/vibeguard-mcp.mjs"');
    expect(pkg).not.toContain('"vibeguard-mcp": "./src/index.ts"');
  });

  it("uses extensionless relative imports inside the MCP source package so Turbopack can resolve workspace code", () => {
    const server = fs.readFileSync("packages/mcp-server/src/server.ts", "utf8");
    const index = fs.readFileSync("packages/mcp-server/src/index.ts", "utf8");
    const tools = fs.readFileSync("packages/mcp-server/src/tools.ts", "utf8");

    expect(server).toContain('from "./tools"');
    expect(server).toContain('from "./client"');
    expect(index).toContain('from "./client"');
    expect(index).toContain('from "./server"');
    expect(tools).toContain('from "./client"');
    expect(server).not.toContain('from "./tools.js"');
    expect(server).not.toContain('from "./client.js"');
    expect(index).not.toContain('from "./client.js"');
    expect(index).not.toContain('from "./server.js"');
    expect(tools).not.toContain('from "./client.js"');
  });
});
