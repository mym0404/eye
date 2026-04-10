import { stat } from "node:fs/promises"
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

const splitConfiguredRoots = (value: string | undefined) =>
  value
    ?.split(",")
    .map((item) => item.trim())
    .filter(Boolean) ?? []

const getAllowedRoots = async () => {
  const configuredRoots = splitConfiguredRoots(process.env.EYE_ALLOWED_ROOTS)
  const roots = await Promise.all(
    configuredRoots.map(async (candidate) =>
      resolveExistingDirectory(candidate).catch(() => undefined),
    ),
  )

  return roots.filter((value): value is string => value !== undefined)
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
}: {
  projectRoot?: string
}) => {
  const rawRoot = projectRoot ?? process.env.EYE_WORKSPACE_ROOT ?? process.cwd()

  if (!path.isAbsolute(rawRoot)) {
    throw new Error(
      "projectRoot must be an absolute path. Pass an absolute path or set EYE_WORKSPACE_ROOT.",
    )
  }

  const resolvedRoot = await resolveExistingDirectory(rawRoot)
  const allowedRoots = await getAllowedRoots()

  if (
    allowedRoots.length > 0 &&
    !allowedRoots.some((allowedRoot) =>
      isWithinPath({ parent: allowedRoot, child: resolvedRoot }),
    )
  ) {
    throw new Error(
      `projectRoot is outside EYE_ALLOWED_ROOTS: ${resolvedRoot}. Allowed roots: ${allowedRoots.join(", ")}`,
    )
  }

  return resolvedRoot
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
