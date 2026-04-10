import { readFile } from "node:fs/promises"
import path from "node:path"

import { searchWithRipgrep } from "../fallback/ripgrep.js"
import {
  getIndexedTokenAtLocation,
  refreshProjectIndex,
} from "../indexing/indexer.js"
import { getLanguageIdFromPath } from "../indexing/language.js"
import type { LanguageId } from "../indexing/types.js"
import { getPyrightClient } from "../lang/python/pyright-client.js"
import { getTsReferencesAt } from "../lang/ts/service.js"
import type { EyeProjectContext } from "../project/context.js"
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
  source: "semantic" | "index" | "fallback"
}

const buildRipgrepGlobs = (context: EyeProjectContext) =>
  [
    ...context.config.ignore.generatedPaths,
    ...context.config.ignore.additionalPaths,
  ].map((pattern) => `!${pattern}`)

const readContextLine = async ({
  projectRoot,
  relativePath,
  line,
}: {
  projectRoot: string
  relativePath: string
  line: number
}) => {
  const text = await readFile(path.join(projectRoot, relativePath), "utf8")

  return text.split(/\r?\n/u)[line - 1] ?? ""
}

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

const resolveSemanticReferences = async ({
  context,
  database,
  filePath,
  line,
  column,
  includeDeclaration,
}: {
  context: EyeProjectContext
  database: EyeDatabase
  filePath: string
  line: number
  column: number
  includeDeclaration: boolean
}) => {
  const language = getLanguageIdFromPath(filePath)
  const generation = database.getIndexStatus().indexGeneration

  if (language === "javascript" || language === "typescript") {
    const references = getTsReferencesAt({
      projectRoot: context.projectRoot,
      trackedRelativePaths: database.listSemanticFiles({
        languages: ["javascript", "typescript"],
      }),
      generation,
      relativePath: filePath,
      line,
      column,
    })

    return Promise.all(
      references
        .filter((reference) => includeDeclaration || !reference.isDefinition)
        .map(async (reference) => {
          const nearestSymbol = database.findNearestSymbol({
            relativePath: reference.relativePath,
            line: reference.line,
            column: reference.column,
          })

          return {
            symbolId: nearestSymbol?.symbol_id,
            name: nearestSymbol?.name,
            filePath: reference.relativePath,
            line: reference.line,
            column: reference.column,
            endLine: reference.endLine,
            endColumn: reference.endColumn,
            language: getLanguageIdFromPath(reference.relativePath),
            context: (
              await readContextLine({
                projectRoot: context.projectRoot,
                relativePath: reference.relativePath,
                line: reference.line,
              })
            ).trim(),
            confidence: "exact" as const,
            source: "semantic" as const,
          }
        }),
    )
  }

  if (language === "python") {
    const client = await getPyrightClient({
      projectRoot: context.projectRoot,
      generation,
    })
    const references = await client.references({
      relativePath: filePath,
      line,
      column,
      includeDeclaration,
    })

    return Promise.all(
      references.map(async (reference) => {
        const nearestSymbol = database.findNearestSymbol({
          relativePath: reference.relativePath,
          line: reference.line,
          column: reference.column,
        })

        return {
          symbolId: nearestSymbol?.symbol_id,
          name: nearestSymbol?.name,
          filePath: reference.relativePath,
          line: reference.line,
          column: reference.column,
          endLine: reference.endLine,
          endColumn: reference.endColumn,
          language: getLanguageIdFromPath(reference.relativePath),
          context: (
            await readContextLine({
              projectRoot: context.projectRoot,
              relativePath: reference.relativePath,
              line: reference.line,
            })
          ).trim(),
          confidence: "exact" as const,
          source: "semantic" as const,
        }
      }),
    )
  }

  return []
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
  const semanticCandidates = anchorLocation
    ? await resolveSemanticReferences({
        context,
        database,
        filePath: anchorLocation.filePath,
        line: anchorLocation.line,
        column: anchorLocation.column,
        includeDeclaration,
      })
    : []

  const anchorToken =
    anchorLocation && semanticCandidates.length === 0
      ? await getIndexedTokenAtLocation({
          projectRoot: context.projectRoot,
          relativePath: anchorLocation.filePath,
          line: anchorLocation.line,
          column: anchorLocation.column,
        })
      : undefined
  const symbolName = symbol ?? targetSymbol?.name ?? anchorToken
  const indexCandidates = symbolName
    ? database
        .findReferencesByName({
          name: symbolName,
          scopePath,
          limit: maxResults,
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
            confidence: semanticCandidates.length > 0 ? "medium" : "high",
            source: "index",
          } satisfies ReferenceCandidate
        })
    : []

  const fallbackCandidates =
    symbolName &&
    semanticCandidates.length + indexCandidates.length < maxResults
      ? (
          await searchWithRipgrep({
            projectRoot: context.projectRoot,
            pattern: symbolName,
            maxResults: Math.max(
              1,
              maxResults - semanticCandidates.length - indexCandidates.length,
            ),
            fixedStrings: true,
            wordMatch: true,
            caseSensitive: false,
            searchRoots: scopePath ? [scopePath] : ["."],
            globs: buildRipgrepGlobs(context),
          })
        ).matches.map((match) => ({
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
    ...semanticCandidates,
    ...indexCandidates,
    ...fallbackCandidates,
  ]).slice(0, maxResults)

  return {
    projectRoot: context.projectRoot,
    strategy:
      semanticCandidates.length > 0
        ? "semantic"
        : indexCandidates.length > 0
          ? "index"
          : "fallback",
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
