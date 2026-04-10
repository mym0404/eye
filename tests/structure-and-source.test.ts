import { afterEach, describe, expect, it } from "vitest"
import { loadProjectContext } from "../src/project/context.js"
import { readSourceRange } from "../src/query/source.js"
import { getProjectStructure } from "../src/query/structure.js"
import { createTempFixtureProject } from "./helpers/project.js"

const cleanups: Array<() => Promise<void>> = []

afterEach(async () => {
  while (cleanups.length > 0) {
    const cleanup = cleanups.pop()

    await cleanup?.()
  }
})

describe("structure and source queries", () => {
  it("skips generated directories from project structure", async () => {
    const fixture = await createTempFixtureProject("mixed-app")
    cleanups.push(fixture.cleanup)

    const context = await loadProjectContext({
      projectRoot: fixture.projectRoot,
      ensureRuntime: false,
    })
    const structure = await getProjectStructure({
      context,
      depth: 4,
      maxEntries: 200,
      includeFiles: true,
      includeHidden: false,
    })
    const flattenedPaths = structure.entries.flatMap((entry) => [
      entry.path,
      ...(entry.children?.map((child) => child.path) ?? []),
    ])

    expect(flattenedPaths).not.toContain("dist")
    expect(flattenedPaths).not.toContain("build")
    expect(flattenedPaths).toContain("src")
  })

  it("reads a bounded range around a requested line", async () => {
    const fixture = await createTempFixtureProject("ts-app")
    cleanups.push(fixture.cleanup)

    const output = await readSourceRange({
      projectRoot: fixture.projectRoot,
      filePath: "src/main.ts",
      line: 5,
      before: 1,
      after: 1,
      maxLines: 5,
    })

    expect(output.startLine).toBe(4)
    expect(output.endLine).toBe(6)
    expect(output.lines[1]?.text).toContain("const total = helper(4)")
  })
})
