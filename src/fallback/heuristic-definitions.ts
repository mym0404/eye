import type { EyeProjectContext } from "../project/context.js"
import { searchWithRipgrep } from "./ripgrep.js"

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")

const buildDefinitionPattern = (symbol: string) => {
  const escapedSymbol = escapeRegExp(symbol)

  return [
    `^\\s*(export\\s+)?(async\\s+)?function\\s+${escapedSymbol}\\b`,
    `^\\s*(export\\s+)?(const|let|var)\\s+${escapedSymbol}\\b`,
    `^\\s*(export\\s+)?(class|interface|type|enum)\\s+${escapedSymbol}\\b`,
    `^\\s*def\\s+${escapedSymbol}\\b`,
    `^\\s*class\\s+${escapedSymbol}\\b`,
  ].join("|")
}

const buildRipgrepGlobs = (context: EyeProjectContext) =>
  [
    ...context.config.ignore.generatedPaths,
    ...context.config.ignore.additionalPaths,
  ].map((pattern) => `!${pattern}`)

export const searchDefinitionHeuristics = async ({
  context,
  symbol,
  scopePath,
  maxResults,
}: {
  context: EyeProjectContext
  symbol: string
  scopePath?: string
  maxResults: number
}) => {
  const pattern = buildDefinitionPattern(symbol)

  return searchWithRipgrep({
    projectRoot: context.projectRoot,
    pattern,
    maxResults,
    fixedStrings: false,
    wordMatch: false,
    caseSensitive: false,
    searchRoots: scopePath ? [scopePath] : ["."],
    globs: buildRipgrepGlobs(context),
  })
}
