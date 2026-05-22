import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"

import { VibeGuardClient } from "./client"
import { createMcpServer } from "./server"

const client = new VibeGuardClient()
const server = createMcpServer(client)
const transport = new StdioServerTransport()
await server.connect(transport)
