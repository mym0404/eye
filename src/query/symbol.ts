import type { LanguageId, SymbolKind } from "../indexing/types.js"
import type { EyeProjectContext } from "../project/context.js"
import type { EyeDatabase } from "../storage/database.js"
import {
  type DefinitionCandidate,
  findSymbolDefinitions,
} from "./definitions.js"
import { findReferences, type ReferenceCandidate } from "./references.js"
import { readSourceRange, type SourceLine } from "./source.js"

export type SymbolQueryAction = "definition" | "references" | "context"

export type SymbolQueryTarget =
  | {
      by: "anchor"
      filePath: string
      line: number
      column: number
    }
  | {
      by: "symbolId"
      symbolId: string
    }
  | {
      by: "symbol"
      symbol: string
    }

export type SymbolQueryMatch = {
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
  context?: string
  confidence: "exact" | "high" | "medium" | "low"
  source: "semantic" | "index" | "fallback"
}

export type SymbolQueryContext = {
  bodyAvailable: boolean
  bodyStartLine?: number
  bodyEndLine?: number
  snippetStartLine: number
  snippetEndLine: number
  totalLines: number
  clamped: boolean
  signatureLine?: SourceLine
  lines: SourceLine[]
}

export type SymbolQueryResult = {
  projectRoot: string
  action: SymbolQueryAction
  strategy: "semantic" | "index" | "fallback"
  indexedGeneration: number
  truncated: boolean
  matches: SymbolQueryMatch[]
  context?: SymbolQueryContext
}

const asQueryStrategy = (value: string): SymbolQueryResult["strategy"] => {
  if (value === "semantic" || value === "index" || value === "fallback") {
    return value
  }

  throw new Error(`unsupported query strategy: ${value}`)
}

const defaultContextBefore = 2
const defaultContextAfter = 4
const defaultContextMaxLines = 120

const asDefinitionMatch = (
  candidate: DefinitionCandidate,
): SymbolQueryMatch => ({
  symbolId: candidate.symbolId,
  name: candidate.name,
  kind: candidate.kind,
  containerName: candidate.containerName,
  filePath: candidate.filePath,
  line: candidate.line,
  column: candidate.column,
  endLine: candidate.endLine,
  endColumn: candidate.endColumn,
  language: candidate.language,
  confidence: candidate.confidence,
  source: candidate.source,
})

const asReferenceMatch = (candidate: ReferenceCandidate): SymbolQueryMatch => ({
  symbolId: candidate.symbolId,
  name: candidate.name,
  filePath: candidate.filePath,
  line: candidate.line,
  column: candidate.column,
  endLine: candidate.endLine,
  endColumn: candidate.endColumn,
  language: candidate.language,
  context: candidate.context,
  confidence: candidate.confidence,
  source: candidate.source,
})

const toDefinitionArgs = (target: SymbolQueryTarget) => {
  if (target.by === "anchor") {
    return {
      anchor: {
        filePath: target.filePath,
        line: target.line,
        column: target.column,
      },
    }
  }

  if (target.by === "symbolId") {
    return {
      symbolId: target.symbolId,
    }
  }

  return {
    symbol: target.symbol,
  }
}

const toReferenceArgs = (target: SymbolQueryTarget) => {
  if (target.by === "anchor") {
    return {
      anchor: {
        filePath: target.filePath,
        line: target.line,
        column: target.column,
      },
    }
  }

  if (target.by === "symbolId") {
    return {
      symbolId: target.symbolId,
    }
  }

  return {
    symbol: target.symbol,
  }
}

const buildContext = async ({
  projectRoot,
  match,
  includeBody,
  before,
  after,
  maxLines,
}: {
  projectRoot: string
  match: SymbolQueryMatch
  includeBody: boolean
  before: number
  after: number
  maxLines: number
}) => {
  const bodyLineCount =
    match.endLine && match.endLine >= match.line
      ? match.endLine - match.line + 1
      : undefined
  const sourceRange = await readSourceRange({
    projectRoot,
    filePath: match.filePath,
    line: match.line,
    before,
    after:
      includeBody && bodyLineCount
        ? after + Math.max(0, bodyLineCount - 1)
        : after,
    maxLines,
  })

  return {
    bodyAvailable: bodyLineCount !== undefined,
    bodyStartLine: bodyLineCount ? match.line : undefined,
    bodyEndLine: match.endLine,
    snippetStartLine: sourceRange.startLine,
    snippetEndLine: sourceRange.endLine,
    totalLines: sourceRange.totalLines,
    clamped: sourceRange.clamped,
    signatureLine: sourceRange.lines.find((line) => line.number === match.line),
    lines: sourceRange.lines,
  } satisfies SymbolQueryContext
}

export const querySymbol = async ({
  context,
  database,
  target,
  action,
  scopePath,
  maxResults,
  includeDeclaration,
  includeBody,
  before,
  after,
  maxLines,
}: {
  context: EyeProjectContext
  database: EyeDatabase
  target: SymbolQueryTarget
  action: SymbolQueryAction
  scopePath?: string
  maxResults: number
  includeDeclaration?: boolean
  includeBody?: boolean
  before?: number
  after?: number
  maxLines?: number
}): Promise<SymbolQueryResult> => {
  if (action === "definition") {
    const output = await findSymbolDefinitions({
      context,
      database,
      ...toDefinitionArgs(target),
      scopePath,
      maxResults,
    })

    return {
      projectRoot: output.projectRoot,
      action,
      strategy: asQueryStrategy(output.strategy),
      indexedGeneration: output.indexedGeneration,
      truncated: output.truncated,
      matches: output.candidates.map(asDefinitionMatch),
    }
  }

  if (action === "references") {
    const output = await findReferences({
      context,
      database,
      ...toReferenceArgs(target),
      scopePath,
      maxResults,
      includeDeclaration: includeDeclaration ?? false,
    })

    return {
      projectRoot: output.projectRoot,
      action,
      strategy: asQueryStrategy(output.strategy),
      indexedGeneration: output.indexedGeneration,
      truncated: output.truncated,
      matches: output.candidates.map(asReferenceMatch),
    }
  }

  const definitionOutput = await findSymbolDefinitions({
    context,
    database,
    ...toDefinitionArgs(target),
    scopePath,
    maxResults,
  })
  const matches = definitionOutput.candidates.map(asDefinitionMatch)
  const primaryMatch = matches[0]
  const contextPayload = primaryMatch
    ? await buildContext({
        projectRoot: context.projectRoot,
        match: primaryMatch,
        includeBody: includeBody ?? true,
        before: before ?? defaultContextBefore,
        after: after ?? defaultContextAfter,
        maxLines: maxLines ?? defaultContextMaxLines,
      })
    : undefined

  return {
    projectRoot: definitionOutput.projectRoot,
    action,
    strategy: asQueryStrategy(definitionOutput.strategy),
    indexedGeneration: definitionOutput.indexedGeneration,
    truncated: definitionOutput.truncated,
    matches,
    context: contextPayload,
  }
}

export const formatSymbolQuery = ({
  action,
  strategy,
  indexedGeneration,
  matches,
  context,
}: SymbolQueryResult) => {
  const lines = [
    `action: ${action}`,
    `strategy: ${strategy}`,
    `generation: ${indexedGeneration}`,
    `results: ${matches.length}`,
  ]

  for (const match of matches) {
    lines.push(
      [
        `- ${match.source}:${match.confidence}`,
        `${match.filePath}:${match.line}:${match.column}`,
        match.name ?? "(anonymous)",
        match.context ? `| ${match.context}` : undefined,
      ]
        .filter(Boolean)
        .join(" "),
    )
  }

  if (action === "context" && context) {
    lines.push(
      `snippet: ${context.snippetStartLine}-${context.snippetEndLine} of ${context.totalLines}${context.clamped ? " (clamped)" : ""}`,
    )

    for (const line of context.lines) {
      lines.push(`${String(line.number).padStart(4)} | ${line.text}`)
    }
  }

  return lines.join("\n")
}
