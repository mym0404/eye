import { afterEach, describe, expect, it } from "vitest"

import { McpTestClient } from "./helpers/mcp-client.js"
import { createTempFixtureProject } from "./helpers/project.js"

const cleanups: Array<() => Promise<void>> = []
const clients: McpTestClient[] = []

afterEach(async () => {
  while (clients.length > 0) {
    const client = clients.pop()

    await client?.close()
  }

  while (cleanups.length > 0) {
    const cleanup = cleanups.pop()

    await cleanup?.()
  }
})

describe("MCP server E2E", () => {
  it("lists the shipped tools over stdio MCP", async () => {
    const fixture = await createTempFixtureProject("ts-app")
    cleanups.push(fixture.cleanup)

    const client = new McpTestClient({
      allowedRoot: fixture.projectRoot,
    })
    clients.push(client)

    await client.initialize()

    const tools = await client.listTools()
    const toolNames = tools.map((tool) => tool.name)

    expect(toolNames).toEqual(
      expect.arrayContaining([
        "get_project_structure",
        "read_source_range",
        "find_symbol_definitions",
        "find_references",
        "refresh_index",
        "get_index_status",
      ]),
    )
  })

  it("returns MCP tool errors with the declared contract", async () => {
    const fixture = await createTempFixtureProject("ts-app")
    cleanups.push(fixture.cleanup)

    const client = new McpTestClient({
      allowedRoot: fixture.projectRoot,
    })
    clients.push(client)

    await client.initialize()

    const result = await client.callToolRaw({
      name: "find_symbol_definitions",
      args: {
        projectRoot: fixture.projectRoot,
      },
    })

    expect(result.isError).toBe(true)
    expect(result.content[0]?.text).toContain(
      "Provide one of symbolId, symbol, or anchor.",
    )
  })

  it("reads structure and source ranges through MCP tools", async () => {
    const fixture = await createTempFixtureProject("mixed-app")
    cleanups.push(fixture.cleanup)

    const client = new McpTestClient({
      allowedRoot: fixture.projectRoot,
    })
    clients.push(client)

    await client.initialize()

    const structure = await client.callTool({
      name: "get_project_structure",
      args: {
        projectRoot: fixture.projectRoot,
        depth: 4,
        maxEntries: 200,
        includeFiles: true,
        includeHidden: false,
      },
    })
    const structureContent = structure.structuredContent as {
      entries: Array<{
        path: string
        children?: Array<{ path: string }>
      }>
    }
    const flattenedPaths = structureContent.entries.flatMap((entry) => [
      entry.path,
      ...(entry.children?.map((child) => child.path) ?? []),
    ])

    expect(flattenedPaths).toContain("src")
    expect(flattenedPaths).not.toContain("build")
    expect(flattenedPaths).not.toContain("dist")

    const source = await client.callTool({
      name: "read_source_range",
      args: {
        projectRoot: fixture.projectRoot,
        filePath: "src/app.ts",
        line: 1,
        before: 0,
        after: 0,
        maxLines: 5,
      },
    })
    const sourceContent = source.structuredContent as {
      lines: Array<{ text: string }>
    }

    expect(sourceContent.lines[0]?.text).toContain(
      'export const startApp = () => "ok"',
    )
  })

  it("refreshes index, reports status, and resolves TS definitions/references", async () => {
    const fixture = await createTempFixtureProject("ts-app")
    cleanups.push(fixture.cleanup)

    const client = new McpTestClient({
      allowedRoot: fixture.projectRoot,
    })
    clients.push(client)

    await client.initialize()

    const initialStatus = await client.callTool({
      name: "get_index_status",
      args: {
        projectRoot: fixture.projectRoot,
      },
    })
    const initialStatusContent = initialStatus.structuredContent as {
      status: string
      fileCount: number
      symbolCount: number
    }

    expect(initialStatusContent.status).toBe("idle")
    expect(initialStatusContent.fileCount).toBe(0)
    expect(initialStatusContent.symbolCount).toBe(0)

    const refresh = await client.callTool({
      name: "refresh_index",
      args: {
        projectRoot: fixture.projectRoot,
      },
    })
    const refreshContent = refresh.structuredContent as {
      generation: number
      indexedFiles: number
    }

    expect(refreshContent.generation).toBeGreaterThan(0)
    expect(refreshContent.indexedFiles).toBeGreaterThan(0)

    const status = await client.callTool({
      name: "get_index_status",
      args: {
        projectRoot: fixture.projectRoot,
      },
    })
    const statusContent = status.structuredContent as {
      status: string
      fileCount: number
      symbolCount: number
      referenceCount: number
    }

    expect(statusContent.status).toBe("ready")
    expect(statusContent.fileCount).toBeGreaterThan(0)
    expect(statusContent.symbolCount).toBeGreaterThan(0)
    expect(statusContent.referenceCount).toBeGreaterThan(0)

    const definitions = await client.callTool({
      name: "find_symbol_definitions",
      args: {
        projectRoot: fixture.projectRoot,
        anchor: {
          filePath: "src/main.ts",
          line: 5,
          column: 15,
        },
        maxResults: 10,
      },
    })
    const definitionContent = definitions.structuredContent as {
      strategy: string
      candidates: Array<{
        filePath: string
        name?: string
        symbolId?: string
      }>
    }

    expect(definitionContent.strategy).toBe("semantic")
    expect(definitionContent.candidates[0]?.filePath).toBe(
      "src/utils/helper.ts",
    )
    expect(definitionContent.candidates[0]?.name).toBe("helper")

    const references = await client.callTool({
      name: "find_references",
      args: {
        projectRoot: fixture.projectRoot,
        symbolId: definitionContent.candidates[0]?.symbolId,
        maxResults: 20,
        includeDeclaration: false,
      },
    })
    const referenceContent = references.structuredContent as {
      strategy: string
      candidates: Array<{
        filePath: string
      }>
    }

    expect(referenceContent.strategy).toBe("semantic")
    expect(
      referenceContent.candidates.some(
        (candidate) => candidate.filePath === "src/main.ts",
      ),
    ).toBe(true)
  })

  it("resolves Python definitions and references through MCP tools", async () => {
    const fixture = await createTempFixtureProject("python-app")
    cleanups.push(fixture.cleanup)

    const client = new McpTestClient({
      allowedRoot: fixture.projectRoot,
    })
    clients.push(client)

    await client.initialize()

    const definitions = await client.callTool({
      name: "find_symbol_definitions",
      args: {
        projectRoot: fixture.projectRoot,
        anchor: {
          filePath: "app/main.py",
          line: 7,
          column: 12,
        },
        maxResults: 10,
      },
    })
    const definitionContent = definitions.structuredContent as {
      strategy: string
      candidates: Array<{
        filePath: string
        name?: string
        symbolId?: string
      }>
    }

    expect(definitionContent.strategy).toBe("semantic")
    expect(definitionContent.candidates[0]?.filePath).toBe("app/helpers.py")
    expect(definitionContent.candidates[0]?.name).toBe("greet")

    const references = await client.callTool({
      name: "find_references",
      args: {
        projectRoot: fixture.projectRoot,
        symbolId: definitionContent.candidates[0]?.symbolId,
        maxResults: 20,
        includeDeclaration: false,
      },
    })
    const referenceContent = references.structuredContent as {
      strategy: string
      candidates: Array<{
        filePath: string
      }>
    }

    expect(referenceContent.strategy).toBe("semantic")
    expect(
      referenceContent.candidates.some(
        (candidate) => candidate.filePath === "app/main.py",
      ),
    ).toBe(true)
  })
})
