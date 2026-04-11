import { afterEach, describe, expect, it } from "vitest"

import { refreshProjectIndex } from "../src/indexing/indexer.js"
import { loadProjectContext } from "../src/project/context.js"
import { querySymbol } from "../src/query/symbol.js"
import { EyeDatabase } from "../src/storage/database.js"
import { createTempFixtureProject } from "./helpers/project.js"

const cleanups: Array<() => Promise<void>> = []

afterEach(async () => {
  while (cleanups.length > 0) {
    const cleanup = cleanups.pop()

    await cleanup?.()
  }
})

describe("index lifecycle", () => {
  it("creates cache state and reports counts", async () => {
    const fixture = await createTempFixtureProject("js-app")
    cleanups.push(fixture.cleanup)

    const context = await loadProjectContext({
      projectRoot: fixture.projectRoot,
    })
    const database = await EyeDatabase.open({
      databasePath: context.paths.cacheDbPath,
      projectRoot: context.projectRoot,
    })

    try {
      const refreshResult = await refreshProjectIndex({
        context,
        database,
      })
      const status = database.getIndexStatus()

      expect(refreshResult.generation).toBeGreaterThan(0)
      expect(status.fileCount).toBeGreaterThan(0)
      expect(status.symbolCount).toBeGreaterThan(0)
      expect(status.status).toBe("ready")
    } finally {
      database.close()
    }
  })

  it("keeps symbol ids stable across unchanged reindex runs", async () => {
    const fixture = await createTempFixtureProject("ts-app")
    cleanups.push(fixture.cleanup)

    const context = await loadProjectContext({
      projectRoot: fixture.projectRoot,
    })
    const database = await EyeDatabase.open({
      databasePath: context.paths.cacheDbPath,
      projectRoot: context.projectRoot,
    })

    try {
      await refreshProjectIndex({
        context,
        database,
      })

      const firstDefinition = await querySymbol({
        context,
        database,
        target: {
          by: "symbol",
          symbol: "helper",
        },
        action: "definition",
        maxResults: 10,
      })
      const secondRefresh = await refreshProjectIndex({
        context,
        database,
      })
      const secondDefinition = await querySymbol({
        context,
        database,
        target: {
          by: "symbol",
          symbol: "helper",
        },
        action: "definition",
        maxResults: 10,
      })

      expect(firstDefinition.matches[0]?.symbolId).toBeTruthy()
      expect(secondRefresh.changedFiles).toBe(0)
      expect(firstDefinition.matches[0]?.symbolId).toBe(
        secondDefinition.matches[0]?.symbolId,
      )
    } finally {
      database.close()
    }
  })

  it("indexes only the configured source roots", async () => {
    const fixture = await createTempFixtureProject("monorepo-app")
    cleanups.push(fixture.cleanup)

    const context = await loadProjectContext({
      projectRoot: fixture.projectRoot,
    })
    const database = await EyeDatabase.open({
      databasePath: context.paths.cacheDbPath,
      projectRoot: context.projectRoot,
    })

    try {
      await refreshProjectIndex({
        context,
        database,
      })

      expect(context.config.sourceRoots).toEqual([
        "packages/api/app",
        "packages/web/src",
      ])

      const trackedPaths = database
        .listTrackedFiles()
        .map((row) => row.relative_path)

      expect(trackedPaths).toContain("packages/web/src/index.ts")
      expect(trackedPaths).toContain("packages/api/app/main.py")
      expect(trackedPaths).not.toContain("scripts/tool.js")

      const definition = await querySymbol({
        context,
        database,
        target: {
          by: "symbol",
          symbol: "runTool",
        },
        action: "definition",
        maxResults: 10,
      })

      expect(definition.matches).toEqual([])
    } finally {
      database.close()
    }
  })
})
