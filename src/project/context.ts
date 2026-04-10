import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"

import { hashValue } from "../util/hash.js"
import {
  getDefaultGeneratedPathPatterns,
  shouldIgnoreRelativePath,
} from "./ignore.js"
import { resolveProjectRoot } from "./root.js"

export type EyeProjectConfig = {
  ignore: {
    generatedPaths: string[]
    additionalPaths: string[]
  }
  indexing: {
    workerConcurrency: number
    includeHidden: boolean
  }
}

export type EyeProjectPaths = {
  eyeDir: string
  configPath: string
  fixturesManifestPath: string
  runtimePath: string
  cacheDbPath: string
  blobsDir: string
  tmpDir: string
  logsDir: string
}

export type EyeProjectContext = {
  projectRoot: string
  config: EyeProjectConfig
  configHash: string
  paths: EyeProjectPaths
  shouldIgnorePath: (relativePath: string) => boolean
}

const defaultConfig: EyeProjectConfig = {
  ignore: {
    generatedPaths: getDefaultGeneratedPathPatterns(),
    additionalPaths: [],
  },
  indexing: {
    workerConcurrency: 4,
    includeHidden: true,
  },
}

export const getProjectPaths = (projectRoot: string): EyeProjectPaths => {
  const eyeDir = path.join(projectRoot, ".eye")

  return {
    eyeDir,
    configPath: path.join(eyeDir, "config.json"),
    fixturesManifestPath: path.join(eyeDir, "fixtures-manifest.json"),
    runtimePath: path.join(eyeDir, "runtime.json"),
    cacheDbPath: path.join(eyeDir, "cache.db"),
    blobsDir: path.join(eyeDir, "blobs"),
    tmpDir: path.join(eyeDir, "tmp"),
    logsDir: path.join(eyeDir, "logs"),
  }
}

const mergeConfig = (
  parsedConfig: Partial<EyeProjectConfig>,
): EyeProjectConfig => ({
  ignore: {
    generatedPaths: Array.from(
      new Set([
        ...defaultConfig.ignore.generatedPaths,
        ...(parsedConfig.ignore?.generatedPaths ?? []),
      ]),
    ),
    additionalPaths:
      parsedConfig.ignore?.additionalPaths ??
      defaultConfig.ignore.additionalPaths,
  },
  indexing: {
    workerConcurrency:
      parsedConfig.indexing?.workerConcurrency ??
      defaultConfig.indexing.workerConcurrency,
    includeHidden:
      parsedConfig.indexing?.includeHidden ??
      defaultConfig.indexing.includeHidden,
  },
})

export const loadProjectConfig = async ({
  projectRoot,
}: {
  projectRoot: string
}) => {
  const paths = getProjectPaths(projectRoot)

  try {
    const file = await readFile(paths.configPath, "utf8")
    const parsedConfig = JSON.parse(file) as Partial<EyeProjectConfig>

    return mergeConfig(parsedConfig)
  } catch {
    return defaultConfig
  }
}

export const ensureProjectRuntimeLayout = async ({
  projectRoot,
  config,
}: {
  projectRoot: string
  config: EyeProjectConfig
}) => {
  const paths = getProjectPaths(projectRoot)

  await Promise.all([
    mkdir(paths.eyeDir, { recursive: true }),
    mkdir(paths.blobsDir, { recursive: true }),
    mkdir(paths.tmpDir, { recursive: true }),
    mkdir(paths.logsDir, { recursive: true }),
  ])

  await writeFile(
    paths.runtimePath,
    JSON.stringify(
      {
        schemaVersion: 1,
        updatedAt: new Date().toISOString(),
        nodeVersion: process.version,
        configHash: hashValue(JSON.stringify(config)),
      },
      null,
      2,
    ),
  )

  return paths
}

export const buildIgnoreMatcher = ({
  config,
}: {
  config: EyeProjectConfig
}) => {
  const patterns = [
    ...config.ignore.generatedPaths,
    ...config.ignore.additionalPaths,
  ]

  return (relativePath: string) =>
    shouldIgnoreRelativePath({ relativePath, patterns })
}

export const loadProjectContext = async ({
  projectRoot,
  ensureRuntime = true,
}: {
  projectRoot?: string
  ensureRuntime?: boolean
} = {}): Promise<EyeProjectContext> => {
  const resolvedRoot = await resolveProjectRoot({ projectRoot })
  const config = await loadProjectConfig({
    projectRoot: resolvedRoot,
  })
  const paths = ensureRuntime
    ? await ensureProjectRuntimeLayout({
        projectRoot: resolvedRoot,
        config,
      })
    : getProjectPaths(resolvedRoot)

  return {
    projectRoot: resolvedRoot,
    config,
    configHash: hashValue(JSON.stringify(config)),
    paths,
    shouldIgnorePath: buildIgnoreMatcher({ config }),
  }
}
