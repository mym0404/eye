import { cp, mkdtemp, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

export const createTempFixtureProject = async (fixtureName: string) => {
  const fixtureRoot = path.join(
    process.cwd(),
    "tests",
    "fixtures",
    "projects",
    fixtureName,
  )
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "eye-fixture-"))
  const projectRoot = path.join(tempRoot, fixtureName)

  await cp(fixtureRoot, projectRoot, {
    recursive: true,
  })

  return {
    projectRoot,
    cleanup: async () => {
      await rm(tempRoot, {
        recursive: true,
        force: true,
      })
    },
  }
}
