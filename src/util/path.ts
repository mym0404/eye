import { realpath, stat } from "node:fs/promises"
import path from "node:path"

export const toPosixPath = (value: string) => value.split(path.sep).join("/")

export const isWithinPath = ({
  parent,
  child,
}: {
  parent: string
  child: string
}) => {
  const relativePath = path.relative(parent, child)

  return (
    relativePath === "" ||
    (!relativePath.startsWith("..") && !path.isAbsolute(relativePath))
  )
}

export const toProjectRelativePath = ({
  projectRoot,
  targetPath,
}: {
  projectRoot: string
  targetPath: string
}) => {
  const relativePath = path.relative(projectRoot, targetPath)

  return relativePath === "" ? "." : toPosixPath(relativePath)
}

export const resolveExistingDirectory = async (targetPath: string) => {
  const resolvedPath = await realpath(targetPath)
  const info = await stat(resolvedPath)

  if (!info.isDirectory()) {
    throw new Error(`path is not a directory: ${resolvedPath}`)
  }

  return resolvedPath
}

export const resolveExistingPath = async (targetPath: string) => {
  const resolvedPath = await realpath(targetPath)

  await stat(resolvedPath)

  return resolvedPath
}
