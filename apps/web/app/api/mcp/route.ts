import crypto from "node:crypto"
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js"
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js"
import { VibeGuardClient } from "@vibeguard/mcp-server/client"
import { createMcpServer } from "@vibeguard/mcp-server/server"

export const dynamic = "force-dynamic"

type SessionContext = {
  server: ReturnType<typeof createMcpServer>
  transport: WebStandardStreamableHTTPServerTransport
  createdAt: number
  lastActivityAt: number
}

const MCP_MAX_SESSIONS = normalizeInt(process.env.VIBEGUARD_MCP_MAX_SESSIONS, 100)
const MCP_SESSION_TTL_MS = normalizeInt(
  process.env.VIBEGUARD_MCP_SESSION_TTL_MS,
  60 * 1000,
)
const MCP_API_TOKEN = process.env.VIBEGUARD_MCP_API_TOKEN?.trim()

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

function nowMs() {
  return Date.now()
}

function normalizeInt(value: string | undefined, fallback: number, minimum = 1) {
  const parsed = Number.parseInt(value ?? "", 10)

  if (!Number.isFinite(parsed) || parsed < minimum) {
    return fallback
  }

  return parsed
}

function extractBearerToken(headers: Headers) {
  const authorization = headers.get("authorization")

  if (!authorization) {
    return headers.get("x-mcp-api-key")?.trim() ?? ""
  }

  const [scheme, token] = authorization.split(/\s+/, 2)

  if (scheme.toLowerCase() === "bearer" && token) {
    return token.trim()
  }

  return authorization.trim()
}

function constantTimeEquals(left: string, right: string) {
  if (left.length !== right.length) {
    return false
  }

  return crypto.timingSafeEqual(Buffer.from(left), Buffer.from(right))
}

function isAuthorizedRequest(request: Request) {
  if (!MCP_API_TOKEN) {
    return true
  }

  return constantTimeEquals(extractBearerToken(request.headers), MCP_API_TOKEN)
}

function touchSession(sessionId: string) {
  const session = transports.get(sessionId)

  if (!session) {
    return false
  }

  session.lastActivityAt = nowMs()
  return true
}

async function closeSession(sessionId: string) {
  const session = transports.get(sessionId)

  if (!session) {
    return
  }

  transports.delete(sessionId)

  try {
    await session.server.close()
  } catch {
    // Ignore close errors in best-effort cleanup.
  }
}

function isSessionExpired(session: SessionContext, now = nowMs()) {
  return now - session.lastActivityAt >= MCP_SESSION_TTL_MS
}

async function cleanupSessions() {
  const now = nowMs()
  const expiredSessionIds = [...transports].flatMap(([sessionId, session]) =>
    isSessionExpired(session, now) ? [sessionId] : [],
  )

  await Promise.all(expiredSessionIds.map(closeSession))
}

function leastRecentlyUsedSessionIds(limit: number) {
  const entries = [...transports.entries()]
  entries.sort((left, right) => left[1].lastActivityAt - right[1].lastActivityAt)

  return entries.slice(0, limit).map(([sessionId]) => sessionId)
}

async function enforceSessionLimits() {
  const maxSessions = normalizeInt(
    process.env.VIBEGUARD_MCP_MAX_SESSIONS,
    MCP_MAX_SESSIONS,
  )
  if (transports.size < maxSessions) {
    return
  }

  const targetSize = Math.max(0, maxSessions - 1)
  const idsToRetain = leastRecentlyUsedSessionIds(targetSize)
  const idsToEvict = [...transports.keys()].filter(
    (sessionId) => !idsToRetain.includes(sessionId),
  )

  await Promise.all(idsToEvict.map(closeSession))
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
        createdAt: nowMs(),
        lastActivityAt: nowMs(),
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
  if (!isAuthorizedRequest(request)) {
    return jsonRpcError(401, -32002, "Unauthorized")
  }

  await cleanupSessions()

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

    touchSession(sessionId)

    return existing.transport.handleRequest(request, { parsedBody: body })
  }

  if (!isInitializePayload(body)) {
    return jsonRpcError(400, -32000, "Bad Request: No valid session ID provided")
  }

  await enforceSessionLimits()

  const session = await createSessionContext(getRequestBaseUrl(request))

  return session.transport.handleRequest(request, { parsedBody: body })
}

export async function GET() {
  return jsonRpcError(405, -32000, "Method not allowed.")
}

export async function DELETE(request: Request) {
  if (!isAuthorizedRequest(request)) {
    return jsonRpcError(401, -32002, "Unauthorized")
  }

  await cleanupSessions()

  const sessionId = request.headers.get("mcp-session-id")

  if (!sessionId) {
    return jsonRpcError(400, -32000, "Bad Request: Mcp-Session-Id header is required")
  }

  const existing = transports.get(sessionId)

  if (!existing) {
    return jsonRpcError(404, -32001, "Session not found")
  }

  touchSession(sessionId)

  return existing.transport.handleRequest(request)
}
