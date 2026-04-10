import { afterEach, describe, expect, it } from "vitest"

import { refreshProjectIndex } from "../src/indexing/indexer.js"
import { loadProjectContext } from "../src/project/context.js"
import { findSymbolDefinitions } from "../src/query/definitions.js"
import { findReferences } from "../src/query/references.js"
import { EyeDatabase } from "../src/storage/database.js"
import { createTempFixtureProject } from "./helpers/project.js"

const cleanups: Array<() => Promise<void>> = []

afterEach(async () => {
  while (cleanups.length > 0) {
    const cleanup = cleanups.pop()

    await cleanup?.()
  }
})

describe("Python navigation", () => {
  it("resolves definitions through pyright", async () => {
    const fixture = await createTempFixtureProject("python-app")
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

      const output = await findSymbolDefinitions({
        context,
        database,
        anchor: {
          filePath: "app/main.py",
          line: 7,
          column: 12,
        },
        maxResults: 10,
      })

      expect(output.strategy).toBe("semantic")
      expect(output.candidates[0]?.filePath).toBe("app/helpers.py")
      expect(output.candidates[0]?.name).toBe("greet")
    } finally {
      database.close()
    }
  })

  it("resolves references through pyright", async () => {
    const fixture = await createTempFixtureProject("python-app")
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

      const definition = await findSymbolDefinitions({
        context,
        database,
        symbol: "greet",
        maxResults: 10,
      })
      const symbolId = definition.candidates[0]?.symbolId

      expect(symbolId).toBeTruthy()

      const references = await findReferences({
        context,
        database,
        symbolId,
        maxResults: 20,
        includeDeclaration: false,
      })

      expect(
        references.candidates.some(
          (candidate) => candidate.filePath === "app/main.py",
        ),
      ).toBe(true)
    } finally {
      database.close()
    }
  })
})
