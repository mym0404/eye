import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { loadProjectContext } from "../src/project/context.js"
import { createTempFixtureProject } from "./helpers/project.js"

const cleanups: Array<() => Promise<void>> = []

afterEach(async () => {
  while (cleanups.length > 0) {
    const cleanup = cleanups.pop()

    await cleanup?.()
  }
})

describe("project context", () => {
  it("detects the nearest project root from a nested cwd", async () => {
    const fixture = await createTempFixtureProject("ts-app")
    cleanups.push(fixture.cleanup)

    const context = await loadProjectContext({
      ensureRuntime: false,
      cwd: path.join(fixture.projectRoot, "src"),
    })

    expect(context.projectRoot).toBe(fixture.projectRoot)
  })

  it("prefers the workspace root over nested package markers", async () => {
    const fixture = await createTempFixtureProject("monorepo-app")
    cleanups.push(fixture.cleanup)

    const context = await loadProjectContext({
      ensureRuntime: false,
      cwd: path.join(fixture.projectRoot, "packages", "web", "src"),
    })

    expect(context.projectRoot).toBe(fixture.projectRoot)
  })

  it("lets an explicit projectRoot override cwd detection", async () => {
    const fixture = await createTempFixtureProject("monorepo-app")
    cleanups.push(fixture.cleanup)

    const explicitRoot = path.join(fixture.projectRoot, "packages", "web")
    const context = await loadProjectContext({
      projectRoot: explicitRoot,
      ensureRuntime: false,
      cwd: path.join(fixture.projectRoot, "packages", "api", "app"),
    })

    expect(context.projectRoot).toBe(explicitRoot)
  })

  it("creates config.json with inferred source roots on first runtime init", async () => {
    const fixture = await createTempFixtureProject("mixed-app")
    cleanups.push(fixture.cleanup)

    const context = await loadProjectContext({
      projectRoot: fixture.projectRoot,
    })
    const config = JSON.parse(
      await readFile(context.paths.configPath, "utf8"),
    ) as {
      sourceRoots: string[]
    }

    expect(context.config.sourceRoots).toEqual(["app", "src"])
    expect(config.sourceRoots).toEqual(["app", "src"])
  })

  it("preserves an existing sourceRoots config", async () => {
    const fixture = await createTempFixtureProject("ts-app")
    cleanups.push(fixture.cleanup)

    const eyeDir = path.join(fixture.projectRoot, ".eye")
    await mkdir(eyeDir, {
      recursive: true,
    })
    await writeFile(
      path.join(eyeDir, "config.json"),
      `${JSON.stringify(
        {
          sourceRoots: ["custom"],
          ignore: {
            generatedPaths: [],
            additionalPaths: ["tmp/**"],
          },
        },
        null,
        2,
      )}\n`,
    )

    const context = await loadProjectContext({
      projectRoot: fixture.projectRoot,
    })
    const config = JSON.parse(
      await readFile(context.paths.configPath, "utf8"),
    ) as {
      sourceRoots: string[]
      ignore: {
        additionalPaths: string[]
      }
    }

    expect(context.config.sourceRoots).toEqual(["custom"])
    expect(config.sourceRoots).toEqual(["custom"])
    expect(config.ignore.additionalPaths).toEqual(["tmp/**"])
  })

  it("backfills missing sourceRoots into an existing config", async () => {
    const fixture = await createTempFixtureProject("ts-app")
    cleanups.push(fixture.cleanup)

    const eyeDir = path.join(fixture.projectRoot, ".eye")
    await mkdir(eyeDir, {
      recursive: true,
    })
    await writeFile(
      path.join(eyeDir, "config.json"),
      `${JSON.stringify(
        {
          ignore: {
            additionalPaths: ["tmp/**"],
          },
        },
        null,
        2,
      )}\n`,
    )

    const context = await loadProjectContext({
      projectRoot: fixture.projectRoot,
    })
    const config = JSON.parse(
      await readFile(context.paths.configPath, "utf8"),
    ) as {
      sourceRoots: string[]
      ignore: {
        additionalPaths: string[]
      }
    }

    expect(context.config.sourceRoots).toEqual(["src"])
    expect(config.sourceRoots).toEqual(["src"])
    expect(config.ignore.additionalPaths).toEqual(["tmp/**"])
  })

  it('uses "." when source files live at the project root', async () => {
    const fixture = await createTempFixtureProject("root-app")
    cleanups.push(fixture.cleanup)

    const context = await loadProjectContext({
      projectRoot: fixture.projectRoot,
    })
    const config = JSON.parse(
      await readFile(context.paths.configPath, "utf8"),
    ) as {
      sourceRoots: string[]
    }

    expect(context.config.sourceRoots).toEqual(["."])
    expect(config.sourceRoots).toEqual(["."])
  })
})
