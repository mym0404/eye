import { afterEach, describe, expect, it, vi } from "vitest"

import { refreshProjectIndex } from "../src/indexing/indexer.js"
import * as pyrightClient from "../src/lang/python/pyright-client.js"
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

describe("Python navigation", () => {
  it("resolves semantic definitions from an anchor", async () => {
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

  it("resolves references from a symbol id through pyright", async () => {
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
          by: "anchor",
          filePath: "app/main.py",
          line: 7,
          column: 12,
        },
        action: "definition",
        maxResults: 10,
      })
      const symbolId = definition.matches[0]?.symbolId

      expect(symbolId).toBeTruthy()
      expect(definition.strategy).toBe("semantic")

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
          .every(
            (candidate) =>
              candidate.symbolId === symbolId && candidate.name === "greet",
          ),
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
          (candidate) => candidate.filePath === "app/main.py",
        ),
      ).toBe(true)
    } finally {
      database.close()
    }
  })

  it("does not infer symbol ids for anchor-based semantic references", async () => {
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

      const references = await querySymbol({
        context,
        database,
        target: {
          by: "anchor",
          filePath: "app/main.py",
          line: 7,
          column: 12,
        },
        action: "references",
        maxResults: 20,
        includeDeclaration: false,
      })

      expect(references.strategy).toBe("semantic")
      expect(
        references.matches
          .filter((candidate) => candidate.source === "semantic")
          .every((candidate) => candidate.symbolId === undefined),
      ).toBe(true)
    } finally {
      database.close()
    }
  })

  it("falls back to the index when pyright definitions throw", async () => {
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

      vi.spyOn(pyrightClient, "getPyrightClient").mockRejectedValue(
        new Error("pyright definition failure"),
      )

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

      expect(output.strategy).toBe("index")
      expect(output.matches[0]?.filePath).toBe("app/helpers.py")
    } finally {
      database.close()
    }
  })

  it("falls back to the index when pyright references throw", async () => {
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
      const symbolId = definition.matches[0]?.symbolId ?? ""
      const client = await pyrightClient.getPyrightClient({
        projectRoot: context.projectRoot,
        generation: database.getIndexStatus().indexGeneration,
      })
      const clientSpy = vi
        .spyOn(pyrightClient, "getPyrightClient")
        .mockResolvedValue(client)
      const referencesSpy = vi
        .spyOn(client, "references")
        .mockRejectedValue(new Error("pyright reference failure"))

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

      expect(clientSpy).toHaveBeenCalledTimes(1)
      expect(referencesSpy).toHaveBeenCalledTimes(1)
      expect(["index", "fallback"]).toContain(references.strategy)
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

      expect(output.strategy).toBe("semantic")
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
