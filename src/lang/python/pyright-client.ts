import { spawn } from "node:child_process"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

import { resolvePackageBin } from "../../util/package-bin.js"
import { isWithinPath, toProjectRelativePath } from "../../util/path.js"

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

type OpenDocumentState = {
  version: number
  text: string
}

type CachedPyrightClient = {
  generation: number
  client: PyrightClient
}

const clientCache = new Map<string, CachedPyrightClient>()

const readHeaders = (buffer: Buffer) => {
  const delimiter = buffer.indexOf("\r\n\r\n")

  if (delimiter === -1) {
    return undefined
  }

  const rawHeader = buffer.slice(0, delimiter).toString("utf8")
  const lines = rawHeader.split("\r\n")
  const headerMap: Record<string, string> = {}

  for (const line of lines) {
    const separatorIndex = line.indexOf(":")

    if (separatorIndex === -1) {
      continue
    }

    const key = line.slice(0, separatorIndex).trim().toLowerCase()
    const value = line.slice(separatorIndex + 1).trim()
    headerMap[key] = value
  }

  const contentLength = Number(headerMap["content-length"])

  if (!Number.isFinite(contentLength)) {
    return undefined
  }

  return {
    contentLength,
    headerLength: delimiter + 4,
  }
}

class PyrightClient {
  readonly projectRoot: string
  readonly child = spawn(
    process.execPath,
    [
      resolvePackageBin({
        packageName: "pyright",
        binName: "pyright-langserver",
      }),
      "--stdio",
    ],
    {
      stdio: ["pipe", "pipe", "pipe"],
    },
  )

  private nextId = 1
  private readonly pendingRequests = new Map<
    number,
    {
      resolve: (value: unknown) => void
      reject: (error: Error) => void
    }
  >()
  private readonly openDocuments = new Map<string, OpenDocumentState>()
  private stdoutBuffer = Buffer.alloc(0)
  private initialized = false
  private initPromise: Promise<void> | undefined

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot
    this.child.stdout.on("data", (chunk: Buffer) => {
      this.stdoutBuffer = Buffer.concat([this.stdoutBuffer, chunk])
      this.processBuffer()
    })

    this.child.stderr.on("data", () => {
      // pyright emits logs and diagnostics here; keep them out of normal control flow.
    })

    this.child.on("exit", () => {
      for (const pending of this.pendingRequests.values()) {
        pending.reject(new Error("pyright-langserver exited unexpectedly"))
      }

      this.pendingRequests.clear()
    })
  }

  private processBuffer = () => {
    while (true) {
      const header = readHeaders(this.stdoutBuffer)

      if (!header) {
        return
      }

      const messageEnd = header.headerLength + header.contentLength

      if (this.stdoutBuffer.length < messageEnd) {
        return
      }

      const messageBuffer = this.stdoutBuffer.slice(
        header.headerLength,
        messageEnd,
      )
      this.stdoutBuffer = this.stdoutBuffer.slice(messageEnd)

      const message = JSON.parse(
        messageBuffer.toString("utf8"),
      ) as JsonRpcMessage

      if (typeof message.id === "number") {
        const pending = this.pendingRequests.get(message.id)

        if (!pending) {
          continue
        }

        this.pendingRequests.delete(message.id)

        if (message.error) {
          pending.reject(new Error(message.error.message))
          continue
        }

        pending.resolve(message.result)
      }
    }
  }

  private sendMessage = (message: JsonRpcMessage) => {
    const payload = JSON.stringify({
      jsonrpc: "2.0",
      ...message,
    })
    const content = Buffer.from(payload, "utf8")
    const header = Buffer.from(
      `Content-Length: ${content.byteLength}\r\nContent-Type: application/vscode-jsonrpc; charset=utf-8\r\n\r\n`,
      "utf8",
    )

    this.child.stdin.write(Buffer.concat([header, content]))
  }

  private request = (method: string, params: unknown) =>
    new Promise<unknown>((resolve, reject) => {
      const id = this.nextId
      this.nextId += 1
      this.pendingRequests.set(id, {
        resolve,
        reject,
      })
      this.sendMessage({
        id,
        method,
        params,
      })
    })

  private notify = (method: string, params: unknown) => {
    this.sendMessage({
      method,
      params,
    })
  }

  ensureInitialized = async () => {
    if (this.initialized) {
      return
    }

    if (!this.initPromise) {
      this.initPromise = (async () => {
        await this.request("initialize", {
          processId: process.pid,
          rootUri: pathToFileURL(this.projectRoot).toString(),
          capabilities: {},
          clientInfo: {
            name: "eye",
            version: "0.1.0",
          },
          workspaceFolders: [
            {
              uri: pathToFileURL(this.projectRoot).toString(),
              name: path.basename(this.projectRoot),
            },
          ],
        })
        this.notify("initialized", {})
        this.initialized = true
      })()
    }

    await this.initPromise
  }

  private ensureDocumentOpen = async ({
    relativePath,
  }: {
    relativePath: string
  }) => {
    await this.ensureInitialized()

    const absolutePath = path.join(this.projectRoot, relativePath)
    const text = await readFile(absolutePath, "utf8")
    const uri = pathToFileURL(absolutePath).toString()
    const existing = this.openDocuments.get(uri)

    if (!existing) {
      this.notify("textDocument/didOpen", {
        textDocument: {
          uri,
          languageId: "python",
          version: 1,
          text,
        },
      })
      this.openDocuments.set(uri, {
        version: 1,
        text,
      })
      return uri
    }

    if (existing.text !== text) {
      const nextVersion = existing.version + 1

      this.notify("textDocument/didChange", {
        textDocument: {
          uri,
          version: nextVersion,
        },
        contentChanges: [
          {
            text,
          },
        ],
      })
      this.openDocuments.set(uri, {
        version: nextVersion,
        text,
      })
    }

    return uri
  }

  definition = async ({
    relativePath,
    line,
    column,
  }: {
    relativePath: string
    line: number
    column: number
  }) => {
    const uri = await this.ensureDocumentOpen({ relativePath })
    const result = await this.request("textDocument/definition", {
      textDocument: {
        uri,
      },
      position: {
        line: line - 1,
        character: Math.max(0, column - 1),
      },
    })

    return normalizeLocations({
      projectRoot: this.projectRoot,
      result,
    })
  }

  references = async ({
    relativePath,
    line,
    column,
    includeDeclaration,
  }: {
    relativePath: string
    line: number
    column: number
    includeDeclaration: boolean
  }) => {
    const uri = await this.ensureDocumentOpen({ relativePath })
    const result = await this.request("textDocument/references", {
      textDocument: {
        uri,
      },
      position: {
        line: line - 1,
        character: Math.max(0, column - 1),
      },
      context: {
        includeDeclaration,
      },
    })

    return normalizeLocations({
      projectRoot: this.projectRoot,
      result,
    })
  }
}

const normalizeLocations = ({
  projectRoot,
  result,
}: {
  projectRoot: string
  result: unknown
}) => {
  const items = Array.isArray(result) ? result : result ? [result] : []

  return items
    .map((item) => {
      if (typeof item !== "object" || item === null) {
        return undefined
      }

      const itemRecord = item as Record<string, unknown>
      const uriValue =
        typeof itemRecord.uri === "string"
          ? itemRecord.uri
          : typeof itemRecord.targetUri === "string"
            ? itemRecord.targetUri
            : undefined
      const rangeValue =
        typeof itemRecord.range === "object" && itemRecord.range !== null
          ? itemRecord.range
          : typeof itemRecord.targetSelectionRange === "object" &&
              itemRecord.targetSelectionRange !== null
            ? itemRecord.targetSelectionRange
            : undefined

      if (!uriValue || !rangeValue) {
        return undefined
      }

      const absolutePath = fileURLToPath(uriValue)

      if (!isWithinPath({ parent: projectRoot, child: absolutePath })) {
        return undefined
      }

      const range = rangeValue as {
        start: {
          line: number
          character: number
        }
        end: {
          line: number
          character: number
        }
      }

      return {
        relativePath: toProjectRelativePath({
          projectRoot,
          targetPath: absolutePath,
        }),
        line: range.start.line + 1,
        column: range.start.character + 1,
        endLine: range.end.line + 1,
        endColumn: range.end.character + 1,
      }
    })
    .filter((value): value is NonNullable<typeof value> => value !== undefined)
}

export const getPyrightClient = async ({
  projectRoot,
  generation,
}: {
  projectRoot: string
  generation: number
}) => {
  const existing = clientCache.get(projectRoot)

  if (existing && existing.generation === generation) {
    await existing.client.ensureInitialized()
    return existing.client
  }

  const client = new PyrightClient(projectRoot)

  await client.ensureInitialized()

  clientCache.set(projectRoot, {
    generation,
    client,
  })

  return client
}
