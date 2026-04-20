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

  const client = new McpTestClient()
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
          depth: 1,
          maxEntries: 200,
          includeFiles: false,
          includeHidden: false,
        },
      })
      const structureContent = structure.structuredContent as {
        entries: Array<{
          path: string
        }>
      }
      const flattenedPaths = structureContent.entries.map((entry) => entry.path)

      expect(flattenedPaths.length).toBeGreaterThan(0)
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

  it("indexes the real Next.js repository and reports large-repo status", async () => {
    const fixture = realFixtures.nextjs
    const client = await createClient(fixture.projectRoot)

    const refresh = await client.callTool({
      name: "refresh_index",
      args: {
        projectRoot: fixture.projectRoot,
        scopePath: fixture.indexScopePath,
      },
    })
    const refreshContent = refresh.structuredContent as {
      generation: number
      indexedFiles: number
    }

    expect(refreshContent.generation).toBeGreaterThan(0)
    expect(refreshContent.indexedFiles).toBeGreaterThanOrEqual(
      fixture.minIndexedFiles,
    )

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
    expect(statusContent.fileCount).toBeGreaterThanOrEqual(
      fixture.minIndexedFiles,
    )
    expect(statusContent.symbolCount).toBeGreaterThanOrEqual(
      fixture.minIndexedFiles,
    )
    expect(statusContent.referenceCount).toBeGreaterThan(0)
  })

  it("indexes the real Flask repository and resolves index-first symbol flows", async () => {
    const fixture = realFixtures.flask
    const client = await createClient(fixture.projectRoot)

    const refresh = await client.callTool({
      name: "refresh_index",
      args: {
        projectRoot: fixture.projectRoot,
        scopePath: fixture.indexScopePath,
      },
    })
    const refreshContent = refresh.structuredContent as {
      indexedFiles: number
    }

    expect(refreshContent.indexedFiles).toBeGreaterThanOrEqual(
      fixture.minIndexedFiles,
    )

    const definitions = await client.callTool({
      name: "query_symbol",
      args: {
        projectRoot: fixture.projectRoot,
        target: {
          by: "symbol",
          symbol: fixture.semantic.symbol,
        },
        action: "definition",
        maxResults: 20,
      },
    })
    const definitionContent = definitions.structuredContent as {
      strategy: string
      matches: Array<{
        filePath: string
        symbolId?: string
      }>
    }
    const definition = definitionContent.matches.find(
      (candidate) =>
        candidate.filePath === fixture.semantic.definitionPath &&
        candidate.symbolId,
    )

    expect(definitionContent.strategy).toBe("index")
    expect(definition).toBeDefined()

    const references = await client.callTool({
      name: "query_symbol",
      args: {
        projectRoot: fixture.projectRoot,
        target: {
          by: "symbolId",
          symbolId: definition?.symbolId ?? "",
        },
        action: "references",
        maxResults: 40,
        includeDeclaration: false,
      },
    })
    const referenceContent = references.structuredContent as {
      strategy: string
      matches: Array<{
        filePath: string
      }>
    }

    expect(["index", "fallback"]).toContain(referenceContent.strategy)
    expect(
      referenceContent.matches.some(
        (candidate) => candidate.filePath !== fixture.semantic.definitionPath,
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
        scopePath: fixture.indexScopePath,
      },
    })
    const refreshContent = refresh.structuredContent as {
      generation: number
      indexedFiles: number
    }

    expect(refreshContent.generation).toBeGreaterThan(0)
    expect(refreshContent.indexedFiles).toBeGreaterThanOrEqual(
      fixture.minIndexedFiles,
    )

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
    expect(statusContent.fileCount).toBeGreaterThanOrEqual(
      fixture.minIndexedFiles,
    )
    expect(statusContent.symbolCount).toBeGreaterThanOrEqual(
      fixture.minIndexedFiles,
    )
    expect(statusContent.referenceCount).toBeGreaterThan(0)
  })
})
