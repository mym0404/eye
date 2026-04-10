import { access, rm } from "node:fs/promises"
import path from "node:path"

const repoRoot = process.cwd()

export const realFixtures = {
  typescript: {
    name: "typescript",
    projectRoot: path.join(repoRoot, "tests", "fixtures", "real", "typescript"),
    structurePath: "src",
    source: {
      filePath: "src/compiler/program.ts",
      line: 1515,
      snippet: "export function createProgram",
    },
    semantic: {
      symbol: "createProgram",
      definitionPath: "src/compiler/program.ts",
      referencePath: "src/services/services.ts",
    },
  },
  nextjs: {
    name: "nextjs",
    projectRoot: path.join(repoRoot, "tests", "fixtures", "real", "nextjs"),
    structurePath: "packages",
    source: {
      filePath: "packages/next/src/server/config.ts",
      line: 1602,
      snippet: "export default async function loadConfig",
    },
  },
  flask: {
    name: "flask",
    projectRoot: path.join(repoRoot, "tests", "fixtures", "real", "flask"),
    structurePath: "src",
    source: {
      filePath: "src/flask/app.py",
      line: 109,
      snippet: "class Flask(App):",
    },
    semantic: {
      symbol: "Flask",
      definitionPath: "src/flask/app.py",
      referencePath: "tests/test_async.py",
    },
  },
  django: {
    name: "django",
    projectRoot: path.join(repoRoot, "tests", "fixtures", "real", "django"),
    structurePath: "django",
    source: {
      filePath: "django/core/handlers/wsgi.py",
      line: 113,
      snippet: "class WSGIHandler",
    },
  },
} as const

export const getRealFixtureList = () => Object.values(realFixtures)

export const ensureRealFixturesPresent = async () => {
  await Promise.all(
    getRealFixtureList().map(async (fixture) => {
      await access(fixture.projectRoot)
    }),
  )
}

export const cleanupRealFixtureRuntime = async (projectRoot: string) => {
  await rm(path.join(projectRoot, ".eye"), {
    recursive: true,
    force: true,
  })
}
