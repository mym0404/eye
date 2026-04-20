import { searchWithRipgrep } from "../fallback/ripgrep.js"
import {
  getIndexedTokenAtLocation,
  refreshProjectIndex,
} from "../indexing/indexer.js"
import { getLanguageIdFromPath } from "../indexing/language.js"
import type { LanguageId } from "../indexing/types.js"
import type { EyeProjectContext } from "../project/context.js"
import { resolveSearchRoots } from "../project/source-roots.js"
import type { EyeDatabase } from "../storage/database.js"

export type ReferenceCandidate = {
  symbolId?: string
  name?: string
  filePath: string
  line: number
  column: number
  endLine?: number
  endColumn?: number
  language: LanguageId
  context: string
  confidence: "exact" | "high" | "medium" | "low"
  source: "index" | "fallback"
}

const buildRipgrepGlobs = (context: EyeProjectContext) =>
  [
    ...context.config.ignore.generatedPaths,
    ...context.config.ignore.additionalPaths,
  ].map((pattern) => `!${pattern}`)

const dedupeCandidates = (candidates: ReferenceCandidate[]) => {
  const seen = new Set<string>()

  return candidates.filter((candidate) => {
    const key = [
      candidate.symbolId ?? "",
      candidate.filePath,
      candidate.line,
      candidate.column,
      candidate.source,
    ].join(":")

    if (seen.has(key)) {
      return false
    }

    seen.add(key)
    return true
  })
}

export const findReferences = async ({
  context,
  database,
  symbolId,
  symbol,
  anchor,
  scopePath,
  maxResults,
  includeDeclaration,
}: {
  context: EyeProjectContext
  database: EyeDatabase
  symbolId?: string
  symbol?: string
  anchor?: {
    filePath: string
    line: number
    column: number
  }
  scopePath?: string
  maxResults: number
  includeDeclaration: boolean
}) => {
  const refreshResult = await refreshProjectIndex({
    context,
    database,
    scopePath,
  })

  const targetSymbol = symbolId ? database.findSymbolById(symbolId) : undefined
  const anchorLocation = targetSymbol
    ? {
        filePath: targetSymbol.relative_path,
        line: targetSymbol.line,
        column: targetSymbol.column_number,
      }
    : anchor
  const anchorToken = anchorLocation
    ? await getIndexedTokenAtLocation({
        projectRoot: context.projectRoot,
        relativePath: anchorLocation.filePath,
        line: anchorLocation.line,
        column: anchorLocation.column,
      })
    : undefined
  const symbolName = symbol ?? targetSymbol?.name ?? anchorToken
  const declarationLocation = targetSymbol
    ? {
        filePath: targetSymbol.relative_path,
        line: targetSymbol.line,
        column: targetSymbol.column_number,
      }
    : undefined

  const indexCandidates = symbolName
    ? database
        .findReferencesByName({
          name: symbolName,
          scopePath,
          limit: maxResults,
        })
        .filter((row) => {
          if (includeDeclaration || !declarationLocation) {
            return true
          }

          return !(
            row.relative_path === declarationLocation.filePath &&
            row.line === declarationLocation.line &&
            row.column_number === declarationLocation.column
          )
        })
        .map((row) => {
          const reference = database.toReferenceRecord(row)

          return {
            symbolId: reference.symbolId,
            name: reference.name,
            filePath: reference.relativePath,
            line: reference.line,
            column: reference.column,
            language: reference.language,
            context: reference.context,
            confidence: "high",
            source: "index",
          } satisfies ReferenceCandidate
        })
    : []

  const fallbackCandidates =
    symbolName && indexCandidates.length < maxResults
      ? (
          await searchWithRipgrep({
            projectRoot: context.projectRoot,
            pattern: symbolName,
            maxResults: Math.max(1, maxResults - indexCandidates.length),
            fixedStrings: true,
            wordMatch: true,
            caseSensitive: false,
            searchRoots: resolveSearchRoots({
              sourceRoots: context.config.sourceRoots,
              scopePath,
            }),
            globs: buildRipgrepGlobs(context),
          })
        ).matches
          .filter((match) => {
            if (includeDeclaration || !declarationLocation) {
              return true
            }

            return !(
              match.path === declarationLocation.filePath &&
              match.line === declarationLocation.line &&
              match.column === declarationLocation.column
            )
          })
          .map((match) => ({
            name: symbolName,
            filePath: match.path,
            line: match.line,
            column: match.column,
            language: getLanguageIdFromPath(match.path),
            context: match.text,
            confidence: "low" as const,
            source: "fallback" as const,
          }))
      : []

  const candidates = dedupeCandidates([
    ...indexCandidates,
    ...fallbackCandidates,
  ]).slice(0, maxResults)

  return {
    projectRoot: context.projectRoot,
    strategy:
      indexCandidates.length > 0 ? ("index" as const) : ("fallback" as const),
    indexedGeneration: refreshResult.generation,
    truncated: candidates.length >= maxResults,
    candidates,
  }
}

export const formatReferenceSearch = ({
  strategy,
  indexedGeneration,
  candidates,
}: {
  strategy: string
  indexedGeneration: number
  candidates: ReferenceCandidate[]
}) => {
  const lines = [
    `strategy: ${strategy}`,
    `generation: ${indexedGeneration}`,
    `results: ${candidates.length}`,
  ]

  for (const candidate of candidates) {
    lines.push(
      `- ${candidate.source}:${candidate.confidence} ${candidate.filePath}:${candidate.line}:${candidate.column} ${candidate.context}`,
    )
  }

  return lines.join("\n")
}
