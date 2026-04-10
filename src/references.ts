import { resolveProjectPath } from "./config.js"
import { searchWithRipgrep, type SearchMatch } from "./ripgrep.js"

const isIdentifierLike = (value: string) => /^[A-Za-z_][A-Za-z0-9_]*$/u.test(value)

export const searchReferences = async ({
  projectRoot,
  query,
  maxResults,
  scopePath,
  mode,
  wordMatch,
  caseSensitive,
}: {
  projectRoot: string
  query: string
  maxResults: number
  scopePath?: string
  mode: "literal" | "regex"
  wordMatch: boolean
  caseSensitive: boolean
}) => {
  const searchRoots = scopePath
    ? [
        (
          await resolveProjectPath({
            projectRoot,
            targetPath: scopePath,
            allowDirectory: true,
          })
        ).relativePath,
      ]
    : ["."]

  const effectiveWordMatch = wordMatch && isIdentifierLike(query)
  const result = await searchWithRipgrep({
    projectRoot,
    pattern: query,
    maxResults,
    fixedStrings: mode === "literal",
    wordMatch: effectiveWordMatch,
    caseSensitive,
    searchRoots,
  })

  return {
    projectRoot,
    query,
    mode,
    wordMatch: effectiveWordMatch,
    truncated: result.truncated,
    matches: result.matches,
  }
}

export const formatReferenceSearch = ({
  query,
  mode,
  wordMatch,
  truncated,
  matches,
}: {
  query: string
  mode: "literal" | "regex"
  wordMatch: boolean
  truncated: boolean
  matches: SearchMatch[]
}) => {
  if (matches.length === 0) {
    return `query: ${query}\nmode: ${mode}\nword_match: ${wordMatch}\nresults: 0`
  }

  const lines = [
    `query: ${query}`,
    `mode: ${mode}`,
    `word_match: ${wordMatch}`,
    `results: ${matches.length}${truncated ? " (truncated)" : ""}`,
  ]

  for (const match of matches) {
    lines.push(`- ${match.path}:${match.line}:${match.column} ${match.text}`)
  }

  return lines.join("\n")
}
