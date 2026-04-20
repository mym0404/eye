import { mkdir, readFile, rm, stat } from "node:fs/promises"
import path from "node:path"
import { listFilesWithRipgrep } from "../fallback/ripgrep.js"
import type { EyeProjectContext } from "../project/context.js"
import { resolveSearchRoots } from "../project/source-roots.js"
import { EyeBlobStore } from "../storage/blob-store.js"
import type { EyeDatabase } from "../storage/database.js"
import { runWithConcurrency } from "../util/concurrency.js"
import { hashValue } from "../util/hash.js"
import { getLanguageIdFromPath, isSupportedSourcePath } from "./language.js"
import { indexFileContent } from "./parser.js"
import type { IndexedFileData, NormalizedFileRecord } from "./types.js"

type RefreshResult = {
  generation: number
  changedFiles: number
  reusedFiles: number
  removedFiles: number
  indexedFiles: number
}

const buildRipgrepGlobs = (context: EyeProjectContext) =>
  [
    ...context.config.ignore.generatedPaths,
    ...context.config.ignore.additionalPaths,
  ].map((pattern) => `!${pattern}`)

const toAbsolutePath = ({
  projectRoot,
  relativePath,
}: {
  projectRoot: string
  relativePath: string
}) => path.join(projectRoot, relativePath)

const getCurrentFileInfo = async ({
  projectRoot,
  relativePath,
}: {
  projectRoot: string
  relativePath: string
}) => {
  const absolutePath = toAbsolutePath({
    projectRoot,
    relativePath,
  })
  const fileInfo = await stat(absolutePath)

  return {
    relativePath,
    size: fileInfo.size,
    mtimeMs: fileInfo.mtimeMs,
  }
}

const toReusedFileRecord = ({
  row,
  size,
  mtimeMs,
}: {
  row: {
    relative_path: string
    language: NormalizedFileRecord["language"]
    content_hash: string
    blob_hash?: string
    parse_source: string
  }
  size: number
  mtimeMs: number
}): NormalizedFileRecord => ({
  relativePath: row.relative_path,
  language: row.language,
  contentHash: row.content_hash,
  blobHash: row.blob_hash,
  size,
  mtimeMs,
  parseSource: row.parse_source as NormalizedFileRecord["parseSource"],
})

export const refreshProjectIndex = async ({
  context,
  database,
  scopePath,
}: {
  context: EyeProjectContext
  database: EyeDatabase
  scopePath?: string
}): Promise<RefreshResult> => {
  if (database.consumeSchemaResetFlag()) {
    await rm(context.paths.blobsDir, {
      recursive: true,
      force: true,
    })
    await mkdir(context.paths.blobsDir, { recursive: true })
  }

  const trackedFiles = database.listTrackedFiles({ scopePath })
  const trackedMap = new Map(
    trackedFiles.map((row) => [row.relative_path, row]),
  )
  const searchRoots = resolveSearchRoots({
    sourceRoots: context.config.sourceRoots,
    scopePath,
  })
  const discoveredPaths = [
    ...new Set(
      (
        await Promise.all(
          searchRoots.map((searchRoot) =>
            listFilesWithRipgrep({
              projectRoot: context.projectRoot,
              searchRoot,
              globs: buildRipgrepGlobs(context),
            }),
          ),
        )
      ).flat(),
    ),
  ].sort((left, right) => left.localeCompare(right))

  const candidatePaths = discoveredPaths.filter(
    (relativePath) =>
      isSupportedSourcePath(relativePath) &&
      !context.shouldIgnorePath(relativePath),
  )
  const discoveredSet = new Set(candidatePaths)
  const removedPaths = trackedFiles
    .filter((row) => !discoveredSet.has(row.relative_path))
    .map((row) => row.relative_path)

  const changedPaths: string[] = []
  const reusedFiles: NormalizedFileRecord[] = []

  for (const relativePath of candidatePaths) {
    const existing = trackedMap.get(relativePath)
    const currentInfo = await getCurrentFileInfo({
      projectRoot: context.projectRoot,
      relativePath,
    })

    if (
      existing &&
      existing.size === currentInfo.size &&
      Math.trunc(existing.mtime_ms) === Math.trunc(currentInfo.mtimeMs)
    ) {
      reusedFiles.push(
        toReusedFileRecord({
          row: existing,
          size: currentInfo.size,
          mtimeMs: currentInfo.mtimeMs,
        }),
      )
      continue
    }

    changedPaths.push(relativePath)
  }

  if (changedPaths.length === 0 && removedPaths.length === 0) {
    return {
      generation: database.getIndexStatus().indexGeneration,
      changedFiles: 0,
      reusedFiles: reusedFiles.length,
      removedFiles: 0,
      indexedFiles: 0,
    }
  }

  const generation = database.startIndexRun()
  database.replaceDirtyFiles({
    paths: [...changedPaths, ...removedPaths],
    reason: "refresh",
  })

  const blobStore = new EyeBlobStore(context.paths.blobsDir)

  try {
    const indexedFiles = await runWithConcurrency({
      items: changedPaths,
      concurrency: context.config.indexing.workerConcurrency,
      worker: async (relativePath) => {
        const fileText = await readFile(
          toAbsolutePath({
            projectRoot: context.projectRoot,
            relativePath,
          }),
          "utf8",
        )
        const indexed = await indexFileContent({
          projectRoot: context.projectRoot,
          relativePath,
          text: fileText,
        })
        const blobHash = hashValue(JSON.stringify(indexed.blobPayload))

        await blobStore.writeJsonBlob({
          hash: blobHash,
          value: indexed.blobPayload,
        })

        return {
          ...indexed,
          file: {
            ...indexed.file,
            blobHash,
          },
        } satisfies IndexedFileData
      },
    })

    database.commitIndexRun({
      generation,
      indexedFiles,
      reusedFiles,
      removedPaths,
    })

    return {
      generation,
      changedFiles: changedPaths.length,
      reusedFiles: reusedFiles.length,
      removedFiles: removedPaths.length,
      indexedFiles: indexedFiles.length,
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "unknown indexing error"
    database.markIndexRunFailed(message)
    throw error
  }
}

export const getIndexedTokenAtLocation = async ({
  projectRoot,
  relativePath,
  line,
  column,
}: {
  projectRoot: string
  relativePath: string
  line: number
  column: number
}) => {
  const text = await readFile(
    toAbsolutePath({
      projectRoot,
      relativePath,
    }),
    "utf8",
  )
  const lineText = text.split(/\r?\n/u)[line - 1] ?? ""

  if (lineText.length === 0) {
    return undefined
  }

  const safeColumn = Math.max(1, Math.min(column, lineText.length + 1))
  const left = lineText.slice(0, safeColumn - 1)
  const right = lineText.slice(safeColumn - 1)
  const leftMatch = left.match(/[A-Za-z_][A-Za-z0-9_]*$/u)
  const rightMatch = right.match(/^[A-Za-z0-9_]*/u)
  const token = `${leftMatch?.[0] ?? ""}${rightMatch?.[0] ?? ""}`

  return token.length > 0 ? token : undefined
}

export const buildLanguageSummary = (relativePath: string) =>
  getLanguageIdFromPath(relativePath)
