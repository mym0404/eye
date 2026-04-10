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

      const output = await querySymbol({
        context,
        database,
        target: {
          by: "anchor",
          filePath: "app/main.py",
          line: 7,
          column: 12,
        },
        action: "definition",
        maxResults: 10,
      })

      expect(output.strategy).toBe("semantic")
      expect(output.matches[0]?.filePath).toBe("app/helpers.py")
      expect(output.matches[0]?.name).toBe("greet")
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

      const definition = await querySymbol({
        context,
        database,
        target: {
          by: "symbol",
          symbol: "greet",
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
          (candidate) => candidate.filePath === "app/main.py",
        ),
      ).toBe(true)
    } finally {
      database.close()
    }
  })

  it("returns context for the resolved python definition", async () => {
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

      const output = await querySymbol({
        context,
        database,
        target: {
          by: "anchor",
          filePath: "app/main.py",
          line: 7,
          column: 12,
        },
        action: "context",
        maxResults: 10,
        includeBody: true,
        before: 0,
        after: 5,
        maxLines: 20,
      })

      expect(output.matches[0]?.filePath).toBe("app/helpers.py")
      expect(output.context?.bodyAvailable).toBe(true)
      expect(output.context?.signatureLine?.text).toContain("def greet")
      expect(
        output.context?.lines.some((line) =>
          line.text.includes("format_name(name)"),
        ),
      ).toBe(true)
    } finally {
      database.close()
    }
  })
})
