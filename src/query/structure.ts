import type { Dirent } from "node:fs"
import { readdir } from "node:fs/promises"
import path from "node:path"

import type { EyeProjectContext } from "../project/context.js"
import { shouldSkipName } from "../project/root.js"
import { toProjectRelativePath } from "../util/path.js"

export type TreeEntry = {
  name: string
  path: string
  kind: "file" | "directory" | "symlink"
  children?: TreeEntry[]
}

type VisibleDirent = {
  dirent: Dirent
  absolutePath: string
  relativePath: string
}

const isSourceRootPath = ({
  relativePath,
  sourceRoots,
}: {
  relativePath: string
  sourceRoots: string[]
}) =>
  sourceRoots.some(
    (sourceRoot) =>
      sourceRoot === "." ||
      relativePath === sourceRoot ||
      relativePath.startsWith(`${sourceRoot}/`) ||
      sourceRoot.startsWith(`${relativePath}/`),
  )

const getSourceRootPriority = ({
  entry,
  sourceRoots,
}: {
  entry: VisibleDirent
  sourceRoots: string[]
}) =>
  entry.dirent.isDirectory() &&
  isSourceRootPath({
    relativePath: entry.relativePath,
    sourceRoots,
  })
    ? 0
    : 1

const sortDirents = ({
  left,
  right,
  sourceRoots,
}: {
  left: VisibleDirent
  right: VisibleDirent
  sourceRoots: string[]
}) => {
  if (left.dirent.isDirectory() && !right.dirent.isDirectory()) {
    return -1
  }

  if (!left.dirent.isDirectory() && right.dirent.isDirectory()) {
    return 1
  }

  const sourceRootPriority =
    getSourceRootPriority({ entry: left, sourceRoots }) -
    getSourceRootPriority({ entry: right, sourceRoots })

  if (sourceRootPriority !== 0) {
    return sourceRootPriority
  }

  return left.dirent.name.localeCompare(right.dirent.name)
}

export const getProjectStructure = async ({
  context,
  depth,
  maxEntries,
  includeFiles,
  includeHidden,
}: {
  context: EyeProjectContext
  depth: number
  maxEntries: number
  includeFiles: boolean
  includeHidden: boolean
}) => {
  let totalEntries = 0
  let truncated = false

  const walk = async ({
    absoluteDir,
    remainingDepth,
  }: {
    absoluteDir: string
    remainingDepth: number
  }): Promise<TreeEntry[]> => {
    if (remainingDepth < 0 || truncated) {
      return []
    }

    const dirents = await readdir(absoluteDir, { withFileTypes: true })
    const visibleDirents = dirents
      .map((dirent) => {
        const absolutePath = path.join(absoluteDir, dirent.name)
        const relativePath = toProjectRelativePath({
          projectRoot: context.projectRoot,
          targetPath: absolutePath,
        })

        return {
          dirent,
          absolutePath,
          relativePath,
        }
      })
      .filter(
        (entry) =>
          !shouldSkipName({
            name: entry.dirent.name,
            includeHidden,
          }) && !context.shouldIgnorePath(entry.relativePath),
      )
      .sort((left, right) =>
        sortDirents({
          left,
          right,
          sourceRoots: context.config.sourceRoots,
        }),
      )

    const entries: TreeEntry[] = []

    for (const entry of visibleDirents) {
      if (totalEntries >= maxEntries) {
        truncated = true
        break
      }

      const { absolutePath, relativePath } = entry
      const { dirent } = entry

      if (dirent.isDirectory()) {
        totalEntries += 1

        const entry: TreeEntry = {
          name: dirent.name,
          path: relativePath,
          kind: "directory",
        }

        if (remainingDepth > 0) {
          const children = await walk({
            absoluteDir: absolutePath,
            remainingDepth: remainingDepth - 1,
          })

          if (children.length > 0) {
            entry.children = children
          }
        }

        entries.push(entry)
        continue
      }

      if (!includeFiles) {
        continue
      }

      totalEntries += 1
      entries.push({
        name: dirent.name,
        path: relativePath,
        kind: dirent.isSymbolicLink() ? "symlink" : "file",
      })
    }

    return entries
  }

  const entries = await walk({
    absoluteDir: context.projectRoot,
    remainingDepth: depth,
  })

  return {
    projectRoot: context.projectRoot,
    depth,
    maxEntries,
    totalEntries,
    truncated,
    entries,
  }
}

export const formatProjectStructure = ({
  projectRoot,
  totalEntries,
  truncated,
  entries,
}: {
  projectRoot: string
  totalEntries: number
  truncated: boolean
  entries: TreeEntry[]
}) => {
  const lines = [
    `root: ${projectRoot}`,
    `entries: ${totalEntries}${truncated ? " (truncated)" : ""}`,
  ]

  const appendEntries = (nodes: TreeEntry[], indent: string) => {
    for (const node of nodes) {
      const prefix =
        node.kind === "directory"
          ? "dir "
          : node.kind === "symlink"
            ? "ln  "
            : "file"

      lines.push(`${indent}${prefix} ${node.name}`)

      if (node.children) {
        appendEntries(node.children, `${indent}  `)
      }
    }
  }

  appendEntries(entries, "")

  return lines.join("\n")
}
