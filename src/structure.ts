import type { Dirent } from "node:fs"
import { readdir } from "node:fs/promises"
import path from "node:path"

import { shouldSkipName, toRelativeProjectPath } from "./config.js"

export type TreeEntry = {
  name: string
  path: string
  kind: "file" | "directory" | "symlink"
  children?: TreeEntry[]
}

const sortDirents = (left: Dirent, right: Dirent) => {
  if (left.isDirectory() && !right.isDirectory()) {
    return -1
  }

  if (!left.isDirectory() && right.isDirectory()) {
    return 1
  }

  return left.name.localeCompare(right.name)
}

export const getProjectStructure = async ({
  projectRoot,
  depth,
  maxEntries,
  includeFiles,
  includeHidden,
}: {
  projectRoot: string
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
      .filter((dirent) => !shouldSkipName({ name: dirent.name, includeHidden }))
      .sort(sortDirents)

    const entries: TreeEntry[] = []

    for (const dirent of visibleDirents) {
      if (totalEntries >= maxEntries) {
        truncated = true
        break
      }

      const absolutePath = path.join(absoluteDir, dirent.name)
      const relativePath = toRelativeProjectPath({ projectRoot, targetPath: absolutePath })

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

  const entries = await walk({ absoluteDir: projectRoot, remainingDepth: depth })

  return {
    projectRoot,
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
        node.kind === "directory" ? "dir " : node.kind === "symlink" ? "ln  " : "file"

      lines.push(`${indent}${prefix} ${node.name}`)

      if (node.children) {
        appendEntries(node.children, `${indent}  `)
      }
    }
  }

  appendEntries(entries, "")

  return lines.join("\n")
}
