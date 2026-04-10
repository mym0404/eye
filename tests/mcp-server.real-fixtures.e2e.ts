import { afterEach, beforeAll, describe, expect, it } from "vitest"

import { McpTestClient } from "./helpers/mcp-client.js"
import {
  cleanupRealFixtureRuntime,
  ensureRealFixturesPresent,
  getRealFixtureList,
  realFixtures,
} from "./helpers/real-fixtures.js"

const clients: McpTestClient[] = []
const touchedProjectRoots = new Set<string>()

const createClient = async (projectRoot: string) => {
  touchedProjectRoots.add(projectRoot)

  const client = new McpTestClient({
    allowedRoot: projectRoot,
  })
  clients.push(client)
  await client.initialize()

  return client
}

beforeAll(async () => {
  await ensureRealFixturesPresent()
})

afterEach(async () => {
  while (clients.length > 0) {
    const client = clients.pop()

    await client?.close()
  }

  await Promise.all(
    [...touchedProjectRoots].map(async (projectRoot) => {
      await cleanupRealFixtureRuntime(projectRoot)
    }),
  )
  touchedProjectRoots.clear()
})

describe("MCP server real fixture E2E", () => {
  it("reads bounded structure and source from all pinned real repositories", async () => {
    for (const fixture of getRealFixtureList()) {
      const client = await createClient(fixture.projectRoot)

      const structure = await client.callTool({
        name: "get_project_structure",
        args: {
          projectRoot: fixture.projectRoot,
          depth: 2,
          maxEntries: 300,
          includeFiles: false,
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

      expect(flattenedPaths).toContain(fixture.structurePath)
      expect(flattenedPaths).not.toContain("dist")
      expect(flattenedPaths).not.toContain("build")
      expect(flattenedPaths).not.toContain(".eye")

      const source = await client.callTool({
        name: "read_source_range",
        args: {
          projectRoot: fixture.projectRoot,
          filePath: fixture.source.filePath,
          line: fixture.source.line,
          before: 0,
          after: 0,
          maxLines: 3,
        },
      })
      const sourceContent = source.structuredContent as {
        lines: Array<{ text: string }>
      }

      expect(
        sourceContent.lines.some((line) =>
          line.text.includes(fixture.source.snippet),
        ),
      ).toBe(true)
    }
  })

  it("indexes the real TypeScript repository and resolves semantic references", async () => {
    const fixture = realFixtures.typescript
    const client = await createClient(fixture.projectRoot)

    const refresh = await client.callTool({
      name: "refresh_index",
      args: {
        projectRoot: fixture.projectRoot,
      },
    })
    const refreshContent = refresh.structuredContent as {
      indexedFiles: number
    }

    expect(refreshContent.indexedFiles).toBeGreaterThan(100)

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
    expect(statusContent.fileCount).toBeGreaterThan(100)
    expect(statusContent.symbolCount).toBeGreaterThan(100)
    expect(statusContent.referenceCount).toBeGreaterThan(100)

    const definitions = await client.callTool({
      name: "find_symbol_definitions",
      args: {
        projectRoot: fixture.projectRoot,
        symbol: fixture.semantic.symbol,
        maxResults: 20,
      },
    })
    const definitionContent = definitions.structuredContent as {
      strategy: string
      candidates: Array<{
        filePath: string
        symbolId?: string
      }>
    }
    const definition = definitionContent.candidates.find(
      (candidate) =>
        candidate.filePath === fixture.semantic.definitionPath &&
        candidate.symbolId,
    )

    expect(definitionContent.strategy).toBe("index")
    expect(definition).toBeDefined()

    const references = await client.callTool({
      name: "find_references",
      args: {
        projectRoot: fixture.projectRoot,
        symbolId: definition?.symbolId,
        maxResults: 40,
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
        (candidate) => candidate.filePath === fixture.semantic.referencePath,
      ),
    ).toBe(true)
  })

  it("indexes the real Next.js repository and reports large-repo status", async () => {
    const fixture = realFixtures.nextjs
    const client = await createClient(fixture.projectRoot)

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
    expect(refreshContent.indexedFiles).toBeGreaterThan(200)

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
    expect(statusContent.fileCount).toBeGreaterThan(200)
    expect(statusContent.symbolCount).toBeGreaterThan(200)
    expect(statusContent.referenceCount).toBeGreaterThan(200)
  })

  it("indexes the real Flask repository and resolves semantic references", async () => {
    const fixture = realFixtures.flask
    const client = await createClient(fixture.projectRoot)

    const refresh = await client.callTool({
      name: "refresh_index",
      args: {
        projectRoot: fixture.projectRoot,
      },
    })
    const refreshContent = refresh.structuredContent as {
      indexedFiles: number
    }

    expect(refreshContent.indexedFiles).toBeGreaterThan(20)

    const definitions = await client.callTool({
      name: "find_symbol_definitions",
      args: {
        projectRoot: fixture.projectRoot,
        symbol: fixture.semantic.symbol,
        maxResults: 20,
      },
    })
    const definitionContent = definitions.structuredContent as {
      strategy: string
      candidates: Array<{
        filePath: string
        symbolId?: string
      }>
    }
    const definition = definitionContent.candidates.find(
      (candidate) =>
        candidate.filePath === fixture.semantic.definitionPath &&
        candidate.symbolId,
    )

    expect(definitionContent.strategy).toBe("index")
    expect(definition).toBeDefined()

    const references = await client.callTool({
      name: "find_references",
      args: {
        projectRoot: fixture.projectRoot,
        symbolId: definition?.symbolId,
        maxResults: 40,
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
        (candidate) => candidate.filePath === fixture.semantic.referencePath,
      ),
    ).toBe(true)
  })

  it("indexes the real Django repository and reports large-repo status", async () => {
    const fixture = realFixtures.django
    const client = await createClient(fixture.projectRoot)

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
    expect(refreshContent.indexedFiles).toBeGreaterThan(100)

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
    expect(statusContent.fileCount).toBeGreaterThan(100)
    expect(statusContent.symbolCount).toBeGreaterThan(100)
    expect(statusContent.referenceCount).toBeGreaterThan(100)
  })
})
