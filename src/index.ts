#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/server"

import { createEyeServer } from "./mcp/server.js"

const main = async () => {
  const server = createEyeServer()
  const transport = new StdioServerTransport()

  await server.connect(transport)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
