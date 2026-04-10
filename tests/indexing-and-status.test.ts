import { afterEach, describe, expect, it } from "vitest"

import { refreshProjectIndex } from "../src/indexing/indexer.js"
import { loadProjectContext } from "../src/project/context.js"
import { findSymbolDefinitions } from "../src/query/definitions.js"
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

      const firstDefinition = await findSymbolDefinitions({
        context,
        database,
        symbol: "helper",
        maxResults: 10,
      })
      const secondRefresh = await refreshProjectIndex({
        context,
        database,
      })
      const secondDefinition = await findSymbolDefinitions({
        context,
        database,
        symbol: "helper",
        maxResults: 10,
      })

      expect(firstDefinition.candidates[0]?.symbolId).toBeTruthy()
      expect(secondRefresh.changedFiles).toBe(0)
      expect(firstDefinition.candidates[0]?.symbolId).toBe(
        secondDefinition.candidates[0]?.symbolId,
      )
    } finally {
      database.close()
    }
  })
})
