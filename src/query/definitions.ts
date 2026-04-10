import { searchDefinitionHeuristics } from "../fallback/heuristic-definitions.js"
import {
  getIndexedTokenAtLocation,
  refreshProjectIndex,
} from "../indexing/indexer.js"
import { getLanguageIdFromPath } from "../indexing/language.js"
import type { LanguageId, SymbolKind } from "../indexing/types.js"
import { getPyrightClient } from "../lang/python/pyright-client.js"
import { getTsDefinitionsAt } from "../lang/ts/service.js"
import type { EyeProjectContext } from "../project/context.js"
import type { EyeDatabase } from "../storage/database.js"

export type DefinitionCandidate = {
  symbolId?: string
  name?: string
  kind?: SymbolKind
  containerName?: string
  filePath: string
  line: number
  column: number
  endLine?: number
  endColumn?: number
  language: LanguageId
  confidence: "exact" | "high" | "medium" | "low"
  source: "semantic" | "index" | "fallback"
}

const dedupeCandidates = (candidates: DefinitionCandidate[]) => {
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

const toCandidateFromRow = (
  database: EyeDatabase,
  row: ReturnType<EyeDatabase["findSymbolById"]> extends infer Value
    ? Exclude<Value, undefined>
    : never,
): DefinitionCandidate => {
  const symbol = database.toSymbolRecord(row)

  return {
    symbolId: symbol.symbolId,
    name: symbol.name,
    kind: symbol.kind,
    containerName: symbol.containerName,
    filePath: symbol.relativePath,
    line: symbol.line,
    column: symbol.column,
    endLine: symbol.endLine,
    endColumn: symbol.endColumn,
    language: symbol.language,
    confidence: "exact",
    source: "index",
  }
}

const toSemanticCandidates = ({
  database,
  locations,
}: {
  database: EyeDatabase
  locations: Array<{
    relativePath: string
    line: number
    column: number
    endLine?: number
    endColumn?: number
  }>
}) =>
  locations.map((location) => {
    const nearestSymbol = database.findNearestSymbol({
      relativePath: location.relativePath,
      line: location.line,
      column: location.column,
    })

    if (nearestSymbol) {
      const symbol = database.toSymbolRecord(nearestSymbol)

      return {
        symbolId: symbol.symbolId,
        name: symbol.name,
        kind: symbol.kind,
        containerName: symbol.containerName,
        filePath: symbol.relativePath,
        line: symbol.line,
        column: symbol.column,
        endLine: symbol.endLine,
        endColumn: symbol.endColumn,
        language: symbol.language,
        confidence: "exact",
        source: "semantic",
      } satisfies DefinitionCandidate
    }

    return {
      filePath: location.relativePath,
      line: location.line,
      column: location.column,
      endLine: location.endLine,
      endColumn: location.endColumn,
      language: getLanguageIdFromPath(location.relativePath),
      confidence: "medium",
      source: "semantic",
    } satisfies DefinitionCandidate
  })

const resolveSemanticDefinitions = async ({
  context,
  database,
  filePath,
  line,
  column,
}: {
  context: EyeProjectContext
  database: EyeDatabase
  filePath: string
  line: number
  column: number
}) => {
  const language = getLanguageIdFromPath(filePath)
  const generation = database.getIndexStatus().indexGeneration

  if (language === "javascript" || language === "typescript") {
    const locations = getTsDefinitionsAt({
      projectRoot: context.projectRoot,
      trackedRelativePaths: database.listSemanticFiles({
        languages: ["javascript", "typescript"],
      }),
      generation,
      relativePath: filePath,
      line,
      column,
    })

    return toSemanticCandidates({
      database,
      locations,
    })
  }

  if (language === "python") {
    const client = await getPyrightClient({
      projectRoot: context.projectRoot,
      generation,
    })
    const locations = await client.definition({
      relativePath: filePath,
      line,
      column,
    })

    return toSemanticCandidates({
      database,
      locations,
    })
  }

  return []
}

export const findSymbolDefinitions = async ({
  context,
  database,
  symbolId,
  symbol,
  anchor,
  scopePath,
  maxResults,
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
}) => {
  const refreshResult = await refreshProjectIndex({
    context,
    database,
    scopePath,
  })

  if (symbolId) {
    const row = database.findSymbolById(symbolId)

    return {
      projectRoot: context.projectRoot,
      strategy: "index" as const,
      indexedGeneration: refreshResult.generation,
      truncated: false,
      candidates: row ? [toCandidateFromRow(database, row)] : [],
    }
  }

  const semanticCandidates = anchor
    ? await resolveSemanticDefinitions({
        context,
        database,
        filePath: anchor.filePath,
        line: anchor.line,
        column: anchor.column,
      })
    : []

  const anchorToken =
    anchor && semanticCandidates.length === 0
      ? await getIndexedTokenAtLocation({
          projectRoot: context.projectRoot,
          relativePath: anchor.filePath,
          line: anchor.line,
          column: anchor.column,
        })
      : undefined
  const symbolName = symbol ?? anchorToken

  const indexCandidates = symbolName
    ? database
        .findSymbolsByName({
          name: symbolName,
          scopePath,
          limit: maxResults,
        })
        .map((row) => {
          const symbolRecord = database.toSymbolRecord(row)

          return {
            symbolId: symbolRecord.symbolId,
            name: symbolRecord.name,
            kind: symbolRecord.kind,
            containerName: symbolRecord.containerName,
            filePath: symbolRecord.relativePath,
            line: symbolRecord.line,
            column: symbolRecord.column,
            endLine: symbolRecord.endLine,
            endColumn: symbolRecord.endColumn,
            language: symbolRecord.language,
            confidence: semanticCandidates.length > 0 ? "high" : "exact",
            source: "index",
          } satisfies DefinitionCandidate
        })
    : []

  const fallbackCandidates =
    symbolName &&
    semanticCandidates.length + indexCandidates.length < maxResults
      ? (
          await searchDefinitionHeuristics({
            context,
            symbol: symbolName,
            scopePath,
            maxResults: Math.max(
              1,
              maxResults - semanticCandidates.length - indexCandidates.length,
            ),
          })
        ).matches.map((match) => ({
          name: symbolName,
          filePath: match.path,
          line: match.line,
          column: match.column,
          language: getLanguageIdFromPath(match.path),
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

export const formatDefinitionSearch = ({
  strategy,
  indexedGeneration,
  candidates,
}: {
  strategy: string
  indexedGeneration: number
  candidates: DefinitionCandidate[]
}) => {
  const lines = [
    `strategy: ${strategy}`,
    `generation: ${indexedGeneration}`,
    `results: ${candidates.length}`,
  ]

  for (const candidate of candidates) {
    lines.push(
      `- ${candidate.source}:${candidate.confidence} ${candidate.filePath}:${candidate.line}:${candidate.column} ${candidate.name ?? "(anonymous)"}`,
    )
  }

  return lines.join("\n")
}
