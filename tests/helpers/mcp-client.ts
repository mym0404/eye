import { spawn } from "node:child_process"
import readline from "node:readline"
import type { Readable, Writable } from "node:stream"

import { LATEST_PROTOCOL_VERSION } from "@modelcontextprotocol/server"

import { resolvePackageBin } from "../../src/util/package-bin.js"

type JsonRpcMessage = {
  id?: number
  method?: string
  params?: unknown
  result?: unknown
  error?: {
    code: number
    message: string
  }
}

const repoRoot = process.cwd()
const serverEntryPath = `${repoRoot}/src/index.ts`
const tsxBin = resolvePackageBin({
  packageName: "tsx",
  binName: "tsx",
})

export class McpTestClient {
  readonly child: ReturnType<typeof spawn>
  readonly stdin: Writable
  readonly stdout: Readable
  readonly stderrStream: Readable

  private nextId = 1
  private readonly pending = new Map<
    number,
    {
      resolve: (value: unknown) => void
      reject: (error: Error) => void
    }
  >()
  private stderr = ""

  constructor({ cwd }: { cwd?: string } = {}) {
    this.child = spawn(process.execPath, [tsxBin, serverEntryPath], {
      cwd: cwd ?? repoRoot,
      env: process.env,
      stdio: ["pipe", "pipe", "pipe"],
    })

    const { stdin, stdout, stderr } = this.child

    if (!stdin || !stdout || !stderr) {
      throw new Error("MCP child process stdio pipes are unavailable.")
    }

    this.stdin = stdin
    this.stdout = stdout
    this.stderrStream = stderr

    this.stderrStream.setEncoding("utf8")
    this.stderrStream.on("data", (chunk) => {
      this.stderr += chunk
    })

    this.child.on("exit", (code, signal) => {
      if (this.pending.size === 0) {
        return
      }

      const reason =
        this.stderr.trim() ||
        `MCP server exited unexpectedly (code=${code ?? "null"}, signal=${signal ?? "null"}).`

      for (const pending of this.pending.values()) {
        pending.reject(new Error(reason))
      }

      this.pending.clear()
    })

    const lines = readline.createInterface({
      input: this.stdout,
    })

    lines.on("line", (line) => {
      const message = JSON.parse(line) as JsonRpcMessage

      if (typeof message.id !== "number") {
        return
      }

      const pending = this.pending.get(message.id)

      if (!pending) {
        return
      }

      this.pending.delete(message.id)

      if (message.error) {
        pending.reject(new Error(message.error.message))
        return
      }

      pending.resolve(message.result)
    })
  }

  private send = (message: JsonRpcMessage) => {
    this.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", ...message })}\n`)
  }

  request = (method: string, params?: unknown) =>
    new Promise<unknown>((resolve, reject) => {
      const id = this.nextId
      this.nextId += 1
      this.pending.set(id, {
        resolve,
        reject,
      })
      this.send({
        id,
        method,
        params,
      })
    })

  notify = (method: string, params?: unknown) => {
    this.send({
      method,
      params,
    })
  }

  initialize = async () => {
    const result = await this.request("initialize", {
      protocolVersion: LATEST_PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: {
        name: "eye-e2e",
        version: "0.1.0",
      },
    })

    this.notify("notifications/initialized", {})

    return result
  }

  listTools = async () => {
    const result = (await this.request("tools/list")) as {
      tools: Array<{ name: string }>
    }

    return result.tools
  }

  callToolRaw = async ({
    name,
    args,
  }: {
    name: string
    args?: Record<string, unknown>
  }) => {
    const result = (await this.request("tools/call", {
      name,
      arguments: args,
    })) as {
      content: Array<{
        type: string
        text?: string
      }>
      structuredContent?: Record<string, unknown>
      isError?: boolean
    }

    return result
  }

  callTool = async ({
    name,
    args,
  }: {
    name: string
    args?: Record<string, unknown>
  }) => {
    const result = await this.callToolRaw({
      name,
      args,
    })

    if (result.isError) {
      const errorText = result.content
        .map((item) => item.text ?? "")
        .filter(Boolean)
        .join("\n")

      throw new Error(errorText || `tool call failed: ${name}`)
    }

    return result
  }

  close = async () => {
    if (this.child.exitCode !== null) {
      return
    }

    this.child.kill()

    await new Promise<void>((resolve) => {
      this.child.once("exit", () => {
        resolve()
      })
    })
  }
}
