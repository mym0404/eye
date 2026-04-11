import { access, stat } from "node:fs/promises"
import path from "node:path"

import {
  isWithinPath,
  resolveExistingDirectory,
  resolveExistingPath,
  toProjectRelativePath,
} from "../util/path.js"

const alwaysIgnoredNames = new Set([
  ".git",
  ".worktrees",
  "node_modules",
  ".eye",
  "build",
  "coverage",
  "dist",
  "out",
  ".next",
  ".turbo",
  ".cache",
])

const workspaceMarkers = [".git", "pnpm-workspace.yaml", "turbo.json"]
const projectMarkers = [
  "package.json",
  "tsconfig.json",
  "jsconfig.json",
  "pyproject.toml",
  "setup.py",
]

const markerExists = async ({
  directoryPath,
  marker,
}: {
  directoryPath: string
  marker: string
}) => {
  try {
    await access(path.join(directoryPath, marker))
    return true
  } catch {
    return false
  }
}

const listAncestors = (directoryPath: string) => {
  const ancestors: string[] = []
  let currentPath = directoryPath

  while (true) {
    ancestors.push(currentPath)
    const parentPath = path.dirname(currentPath)

    if (parentPath === currentPath) {
      return ancestors
    }

    currentPath = parentPath
  }
}

const findMarkedAncestor = async ({
  ancestors,
  markers,
}: {
  ancestors: string[]
  markers: string[]
}) => {
  for (const candidatePath of ancestors) {
    const matches = await Promise.all(
      markers.map((marker) =>
        markerExists({
          directoryPath: candidatePath,
          marker,
        }),
      ),
    )

    if (matches.some(Boolean)) {
      return candidatePath
    }
  }

  return undefined
}

export const shouldSkipName = ({
  name,
  includeHidden,
}: {
  name: string
  includeHidden: boolean
}) => {
  if (alwaysIgnoredNames.has(name)) {
    return true
  }

  if (!includeHidden && name.startsWith(".")) {
    return true
  }

  return false
}

export const resolveProjectRoot = async ({
  projectRoot,
  cwd,
}: {
  projectRoot?: string
  cwd?: string
}) => {
  if (projectRoot) {
    if (!path.isAbsolute(projectRoot)) {
      throw new Error("projectRoot must be an absolute path.")
    }

    return resolveExistingDirectory(projectRoot)
  }

  const resolvedCwd = await resolveExistingDirectory(cwd ?? process.cwd())
  const ancestors = listAncestors(resolvedCwd)
  const configRoot = await findMarkedAncestor({
    ancestors,
    markers: [path.join(".eye", "config.json")],
  })

  if (configRoot) {
    return resolveExistingDirectory(configRoot)
  }

  const workspaceRoot = await findMarkedAncestor({
    ancestors,
    markers: workspaceMarkers,
  })

  if (workspaceRoot) {
    return resolveExistingDirectory(workspaceRoot)
  }

  const projectMarkerRoot = await findMarkedAncestor({
    ancestors,
    markers: projectMarkers,
  })

  if (projectMarkerRoot) {
    return resolveExistingDirectory(projectMarkerRoot)
  }

  return resolvedCwd
}

export const resolveProjectPath = async ({
  projectRoot,
  targetPath,
  allowDirectory = false,
}: {
  projectRoot: string
  targetPath: string
  allowDirectory?: boolean
}) => {
  const absolutePath = path.isAbsolute(targetPath)
    ? targetPath
    : path.join(projectRoot, targetPath)
  const resolvedPath = await resolveExistingPath(absolutePath)

  if (!isWithinPath({ parent: projectRoot, child: resolvedPath })) {
    throw new Error(`path is outside projectRoot: ${targetPath}`)
  }

  const info = await stat(resolvedPath)

  if (!allowDirectory && !info.isFile()) {
    throw new Error(`path is not a file: ${targetPath}`)
  }

  return {
    absolutePath: resolvedPath,
    relativePath: toProjectRelativePath({
      projectRoot,
      targetPath: resolvedPath,
    }),
    isDirectory: info.isDirectory(),
  }
}
