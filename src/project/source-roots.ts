import { access, readdir } from "node:fs/promises"
import path from "node:path"

import { isSupportedSourcePath } from "../indexing/language.js"
import {
  getDefaultGeneratedPathPatterns,
  shouldIgnoreRelativePath,
} from "./ignore.js"

const sourceRootPatterns = [
  "src",
  "app",
  "packages/*/src",
  "packages/*/app",
  "apps/*/src",
  "apps/*/app",
  "libs/*/src",
  "services/*/src",
] as const

const generatedPathPatterns = getDefaultGeneratedPathPatterns()

const normalizeRelativePath = (value: string) => {
  const normalizedValue = value.replaceAll("\\", "/").replace(/^\.\/+/u, "")
  const collapsedValue = path.posix.normalize(normalizedValue || ".")

  return collapsedValue === "" ? "." : collapsedValue.replace(/\/$/u, "") || "."
}

export const dedupeAndSortPaths = (values: string[]) =>
  [...new Set(values.map(normalizeRelativePath))].sort((left, right) =>
    left.localeCompare(right),
  )

const pathExists = async (targetPath: string) => {
  try {
    await access(targetPath)
    return true
  } catch {
    return false
  }
}

const hasSupportedRootFile = async ({
  projectRoot,
}: {
  projectRoot: string
}) => {
  const entries = await readdir(projectRoot, {
    withFileTypes: true,
  })

  return entries.some(
    (entry) => entry.isFile() && isSupportedSourcePath(entry.name),
  )
}

const directoryContainsSupportedSource = async ({
  projectRoot,
  relativePath,
}: {
  projectRoot: string
  relativePath: string
}): Promise<boolean> => {
  const absolutePath = path.join(projectRoot, relativePath)
  const entries = await readdir(absolutePath, {
    withFileTypes: true,
  })

  for (const entry of entries) {
    const entryRelativePath = normalizeRelativePath(
      path.posix.join(relativePath, entry.name),
    )

    if (
      shouldIgnoreRelativePath({
        relativePath: entryRelativePath,
        patterns: generatedPathPatterns,
      })
    ) {
      continue
    }

    if (entry.isFile() && isSupportedSourcePath(entry.name)) {
      return true
    }

    if (entry.isDirectory()) {
      const nestedMatch = await directoryContainsSupportedSource({
        projectRoot,
        relativePath: entryRelativePath,
      })

      if (nestedMatch) {
        return true
      }
    }
  }

  return false
}

const expandWildcardPattern = async ({
  projectRoot,
  pattern,
}: {
  projectRoot: string
  pattern: (typeof sourceRootPatterns)[number]
}) => {
  if (!pattern.includes("*")) {
    return (await pathExists(path.join(projectRoot, pattern))) ? [pattern] : []
  }

  const [containerDir, , leafDir] = pattern.split("/")
  const containerPath = path.join(projectRoot, containerDir)

  if (!(await pathExists(containerPath))) {
    return []
  }

  const entries = await readdir(containerPath, {
    withFileTypes: true,
  })

  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.posix.join(containerDir, entry.name, leafDir))
}

export const normalizeSourceRoot = (value: string) =>
  dedupeAndSortPaths([value])[0] ?? "."

export const inferSourceRoots = async ({
  projectRoot,
}: {
  projectRoot: string
}) => {
  const candidateRoots: string[] = []

  for (const pattern of sourceRootPatterns) {
    const expandedPaths = await expandWildcardPattern({
      projectRoot,
      pattern,
    })

    for (const candidatePath of expandedPaths) {
      if (!(await pathExists(path.join(projectRoot, candidatePath)))) {
        continue
      }

      if (
        await directoryContainsSupportedSource({
          projectRoot,
          relativePath: candidatePath,
        })
      ) {
        candidateRoots.push(candidatePath)
      }
    }
  }

  if (candidateRoots.length > 0) {
    return dedupeAndSortPaths(candidateRoots)
  }

  if (await hasSupportedRootFile({ projectRoot })) {
    return ["."]
  }

  return ["."]
}

export const resolveSearchRoots = ({
  sourceRoots,
  scopePath,
}: {
  sourceRoots: string[]
  scopePath?: string
}) => {
  if (!scopePath || scopePath === ".") {
    return dedupeAndSortPaths(sourceRoots)
  }

  const normalizedScopePath = normalizeSourceRoot(scopePath)

  return dedupeAndSortPaths(
    sourceRoots.flatMap((sourceRoot) => {
      if (sourceRoot === ".") {
        return [normalizedScopePath]
      }

      if (
        normalizedScopePath === sourceRoot ||
        normalizedScopePath.startsWith(`${sourceRoot}/`)
      ) {
        return [normalizedScopePath]
      }

      if (sourceRoot.startsWith(`${normalizedScopePath}/`)) {
        return [sourceRoot]
      }

      return []
    }),
  )
}
