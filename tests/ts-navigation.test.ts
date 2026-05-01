import { afterEach, describe, expect, it, vi } from "vitest"

import { refreshProjectIndex } from "../src/indexing/indexer.js"
import * as tsService from "../src/lang/ts/service.js"
import { loadProjectContext } from "../src/project/context.js"
import { querySymbol } from "../src/query/symbol.js"
import { EyeDatabase } from "../src/storage/database.js"
import { createTempFixtureProject } from "./helpers/project.js"

const cleanups: Array<() => Promise<void>> = []

afterEach(async () => {
  vi.restoreAllMocks()

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

  it("resolves references from a symbol id through the semantic backend", async () => {
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
      expect(definition.strategy).toBe("index")

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

      expect(references.strategy).toBe("semantic")
      expect(
        references.matches
          .filter((candidate) => candidate.source === "semantic")
          .every((candidate) => candidate.symbolId === symbolId),
      ).toBe(true)
      expect(
        new Set(
          references.matches.map(
            (candidate) =>
              `${candidate.filePath}:${candidate.line}:${candidate.column}`,
          ),
        ).size,
      ).toBe(references.matches.length)
      expect(
        references.matches.some(
          (candidate) => candidate.filePath === "src/main.ts",
        ),
      ).toBe(true)
    } finally {
      database.close()
    }
  })

  it("falls back to the index when semantic definitions throw", async () => {
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

      vi.spyOn(tsService, "getTsDefinitionsAt").mockImplementation(() => {
        throw new Error("semantic definition failure")
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

      expect(output.strategy).toBe("index")
      expect(output.matches[0]?.filePath).toBe("src/utils/helper.ts")
    } finally {
      database.close()
    }
  })

  it("falls back to the index when semantic references throw", async () => {
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
      const symbolId = definition.matches[0]?.symbolId ?? ""
      const referencesSpy = vi
        .spyOn(tsService, "getTsReferencesAt")
        .mockImplementation(() => {
          throw new Error("semantic reference failure")
        })

      const references = await querySymbol({
        context,
        database,
        target: {
          by: "symbolId",
          symbolId,
        },
        action: "references",
        maxResults: 20,
        includeDeclaration: false,
      })

      expect(referencesSpy).toHaveBeenCalledTimes(1)
      expect(["index", "fallback"]).toContain(references.strategy)
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

      expect(output.strategy).toBe("semantic")
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
