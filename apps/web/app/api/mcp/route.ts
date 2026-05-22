import crypto from "node:crypto"

import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js"
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js"
import { VibeGuardClient } from "@vibeguard/mcp-server/client"
import { createMcpServer } from "@vibeguard/mcp-server/server"

export const dynamic = "force-dynamic"

type SessionContext = {
  server: ReturnType<typeof createMcpServer>
  transport: WebStandardStreamableHTTPServerTransport
}

const transports = new Map<string, SessionContext>()

function jsonRpcError(status: number, code: number, message: string) {
  return Response.json(
    {
      jsonrpc: "2.0",
      error: {
        code,
        message,
      },
      id: null,
    },
    {
      status,
      headers: {
        "Allow": "POST, DELETE",
      },
    },
  )
}

function getRequestBaseUrl(request: Request) {
  return (
    process.env.VIBEGUARD_API_URL ||
    new URL(request.url).origin
  ).replace(/\/$/, "")
}

function isInitializePayload(body: unknown) {
  if (Array.isArray(body)) {
    return body.some((entry) => isInitializeRequest(entry))
  }

  return isInitializeRequest(body)
}

async function createSessionContext(baseUrl: string) {
  const client = new VibeGuardClient(baseUrl)
  const server = createMcpServer(client)
  let transport!: WebStandardStreamableHTTPServerTransport

  transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: () => crypto.randomUUID(),
    enableJsonResponse: true,
    onsessioninitialized: (sessionId) => {
      transports.set(sessionId, {
        server,
        transport,
      })
    },
    onsessionclosed: async (sessionId) => {
      const session = transports.get(sessionId)

      if (!session) {
        return
      }

      transports.delete(sessionId)
      await session.server.close()
    },
  })

  await server.connect(transport)

  return {
    server,
    transport,
  }
}

async function parseBody(request: Request) {
  try {
    return await request.json()
  } catch {
    return null
  }
}

export async function POST(request: Request) {
  const body = await parseBody(request)

  if (body == null) {
    return jsonRpcError(400, -32700, "Parse error: Invalid JSON")
  }

  const sessionId = request.headers.get("mcp-session-id")

  if (sessionId) {
    const existing = transports.get(sessionId)

    if (!existing) {
      return jsonRpcError(404, -32001, "Session not found")
    }

    return existing.transport.handleRequest(request, { parsedBody: body })
  }

  if (!isInitializePayload(body)) {
    return jsonRpcError(400, -32000, "Bad Request: No valid session ID provided")
  }

  const session = await createSessionContext(getRequestBaseUrl(request))

  return session.transport.handleRequest(request, { parsedBody: body })
}

export async function GET() {
  return jsonRpcError(405, -32000, "Method not allowed.")
}

export async function DELETE(request: Request) {
  const sessionId = request.headers.get("mcp-session-id")

  if (!sessionId) {
    return jsonRpcError(400, -32000, "Bad Request: Mcp-Session-Id header is required")
  }

  const existing = transports.get(sessionId)

  if (!existing) {
    return jsonRpcError(404, -32001, "Session not found")
  }

  return existing.transport.handleRequest(request)
}
