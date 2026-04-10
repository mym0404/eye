import { realpath, stat } from "node:fs/promises"
import path from "node:path"

const alwaysIgnoredNames = new Set([
  ".git",
  ".worktrees",
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".next",
  ".turbo",
  ".cache",
])

const splitConfiguredRoots = (value: string | undefined) =>
  value
    ?.split(",")
    .map((item) => item.trim())
    .filter(Boolean) ?? []

const isWithinPath = ({
  parent,
  child,
}: {
  parent: string
  child: string
}) => {
  const relativePath = path.relative(parent, child)

  return relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath))
}

const resolveExistingPath = async (targetPath: string) => {
  const resolvedPath = await realpath(targetPath)

  await stat(resolvedPath)

  return resolvedPath
}

const toPosixPath = (value: string) => value.split(path.sep).join("/")

const getAllowedRoots = async () => {
  const roots = splitConfiguredRoots(process.env.EYE_ALLOWED_ROOTS)

  const resolvedRoots = await Promise.all(
    roots.map(async (root) => resolveExistingPath(root).catch(() => undefined)),
  )

  return resolvedRoots.filter((root): root is string => root !== undefined)
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

export const toRelativeProjectPath = ({
  projectRoot,
  targetPath,
}: {
  projectRoot: string
  targetPath: string
}) => {
  const relativePath = path.relative(projectRoot, targetPath)

  return relativePath === "" ? "." : toPosixPath(relativePath)
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

  const resolvedRoot = await resolveExistingPath(rawRoot)
  const rootInfo = await stat(resolvedRoot)

  if (!rootInfo.isDirectory()) {
    throw new Error(`projectRoot is not a directory: ${resolvedRoot}`)
  }

  const allowedRoots = await getAllowedRoots()

  if (
    allowedRoots.length > 0 &&
    !allowedRoots.some((allowedRoot) => isWithinPath({ parent: allowedRoot, child: resolvedRoot }))
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

  const pathInfo = await stat(resolvedPath)

  if (!allowDirectory && !pathInfo.isFile()) {
    throw new Error(`path is not a file: ${targetPath}`)
  }

  return {
    absolutePath: resolvedPath,
    relativePath: toRelativeProjectPath({ projectRoot, targetPath: resolvedPath }),
    isDirectory: pathInfo.isDirectory(),
  }
}
