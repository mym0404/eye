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

describe("TypeScript navigation", () => {
  it("resolves semantic definitions from an anchor", async () => {
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

      const output = await querySymbol({
        context,
        database,
        target: {
          by: "anchor",
          filePath: "src/main.ts",
          line: 5,
          column: 15,
        },
        action: "definition",
        maxResults: 10,
      })

      expect(output.strategy).toBe("semantic")
      expect(output.matches[0]?.filePath).toBe("src/utils/helper.ts")
      expect(output.matches[0]?.name).toBe("helper")
    } finally {
      database.close()
    }
  })

  it("resolves semantic references from a symbol id", async () => {
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

      const definition = await querySymbol({
        context,
        database,
        target: {
          by: "symbol",
          symbol: "helper",
        },
        action: "definition",
        maxResults: 10,
      })
      const symbolId = definition.matches[0]?.symbolId

      expect(symbolId).toBeTruthy()

      const references = await querySymbol({
        context,
        database,
        target: {
          by: "symbolId",
          symbolId: symbolId ?? "",
        },
        action: "references",
        maxResults: 20,
        includeDeclaration: false,
      })

      expect(
        references.matches.some(
          (candidate) => candidate.filePath === "src/main.ts",
        ),
      ).toBe(true)
    } finally {
      database.close()
    }
  })

  it("returns bounded context for the resolved definition", async () => {
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

      const output = await querySymbol({
        context,
        database,
        target: {
          by: "anchor",
          filePath: "src/main.ts",
          line: 5,
          column: 15,
        },
        action: "context",
        maxResults: 10,
        includeBody: true,
        before: 0,
        after: 0,
        maxLines: 20,
      })

      expect(output.matches[0]?.filePath).toBe("src/utils/helper.ts")
      expect(output.context?.bodyAvailable).toBe(true)
      expect(output.context?.signatureLine?.text).toContain(
        "export const helper",
      )
      expect(
        output.context?.lines.some((line) => line.text.includes("helper")),
      ).toBe(true)
    } finally {
      database.close()
    }
  })
})
