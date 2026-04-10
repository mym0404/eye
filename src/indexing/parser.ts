import { stat } from "node:fs/promises"
import path from "node:path"

import { extractTreeSitterIndexData } from "../lang/tree-sitter/extract.js"
import { parseWithTreeSitter } from "../lang/tree-sitter/parser.js"
import { hashValue } from "../util/hash.js"
import { getLanguageIdFromPath, getTreeSitterGrammarName } from "./language.js"
import type { IndexedFileData } from "./types.js"

const toAbsolutePath = ({
  projectRoot,
  relativePath,
}: {
  projectRoot: string
  relativePath: string
}) => path.join(projectRoot, relativePath)

const buildFallbackRecords = ({
  relativePath,
  language,
  size,
  mtimeMs,
  contentHash,
}: {
  relativePath: string
  language: ReturnType<typeof getLanguageIdFromPath>
  size: number
  mtimeMs: number
  contentHash: string
}): IndexedFileData => ({
  file: {
    relativePath,
    language,
    size,
    mtimeMs,
    contentHash,
    parseSource: "fallback-text",
  },
  symbols: [],
  references: [],
  dependencies: [],
  blobPayload: {
    schemaVersion: 1,
    relativePath,
    language,
    parseSource: "fallback-text",
    symbols: [],
    references: [],
    dependencies: [],
  },
})

export const indexFileContent = async ({
  projectRoot,
  relativePath,
  text,
}: {
  projectRoot: string
  relativePath: string
  text: string
}) => {
  const absolutePath = toAbsolutePath({
    projectRoot,
    relativePath,
  })
  const fileInfo = await stat(absolutePath)
  const language = getLanguageIdFromPath(relativePath)
  const contentHash = hashValue(text)
  const grammarName = getTreeSitterGrammarName(relativePath)

  if (!grammarName) {
    return buildFallbackRecords({
      relativePath,
      language,
      size: fileInfo.size,
      mtimeMs: fileInfo.mtimeMs,
      contentHash,
    })
  }

  try {
    const tree = await parseWithTreeSitter({
      grammarName,
      text,
    })

    try {
      const extracted = extractTreeSitterIndexData({
        relativePath,
        text,
        tree,
      })

      return {
        file: {
          relativePath,
          language,
          size: fileInfo.size,
          mtimeMs: fileInfo.mtimeMs,
          contentHash,
          parseSource: "tree-sitter",
        },
        ...extracted,
      } satisfies IndexedFileData
    } finally {
      tree.delete()
    }
  } catch {
    return buildFallbackRecords({
      relativePath,
      language,
      size: fileInfo.size,
      mtimeMs: fileInfo.mtimeMs,
      contentHash,
    })
  }
}
