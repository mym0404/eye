import { createReadStream } from "node:fs"
import { access, readFile } from "node:fs/promises"
import path from "node:path"
import readline from "node:readline"

import { resolveProjectPath } from "./config.js"
import { searchWithRipgrep, type SearchMatch } from "./ripgrep.js"

export type DefinitionMatch = SearchMatch & {
  provider: "tags-file" | "ripgrep-heuristic"
  confidence: "high" | "medium"
  kind?: string
}

type DefinitionQuery = {
  projectRoot: string
  symbol: string
  maxResults: number
  searchRoots: string[]
}

type DefinitionProviderResult = {
  provider: "tags-file" | "ripgrep-heuristic"
  truncated: boolean
  matches: DefinitionMatch[]
}

type DefinitionProvider = {
  findDefinitions: (query: DefinitionQuery) => Promise<DefinitionProviderResult>
}

const sourceFileGlobs = [
  "*.ts",
  "*.tsx",
  "*.js",
  "*.jsx",
  "*.mjs",
  "*.cjs",
  "*.py",
  "*.go",
  "*.rs",
  "*.java",
  "*.kt",
  "*.cs",
  "*.c",
  "*.cc",
  "*.cpp",
  "*.h",
  "*.hpp",
]

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")

const inferKind = (line: string) => {
  const patterns = [
    { pattern: /\binterface\b/u, kind: "interface" },
    { pattern: /\btype\b/u, kind: "type" },
    { pattern: /\benum\b/u, kind: "enum" },
    { pattern: /\bclass\b/u, kind: "class" },
    { pattern: /\btrait\b/u, kind: "trait" },
    { pattern: /\bstruct\b/u, kind: "struct" },
    { pattern: /\bfunction\b/u, kind: "function" },
    { pattern: /\bfunc\b/u, kind: "function" },
    { pattern: /\bdef\b/u, kind: "function" },
    { pattern: /\b(const|let|var)\b/u, kind: "variable" },
  ]

  return patterns.find(({ pattern }) => pattern.test(line))?.kind
}

const buildDefinitionPattern = (symbol: string) => {
  const escapedSymbol = escapeRegExp(symbol)

  return [
    `^\\s*(export\\s+)?(async\\s+)?function\\s+${escapedSymbol}\\b`,
    `^\\s*(export\\s+)?(const|let|var)\\s+${escapedSymbol}\\b`,
    `^\\s*(export\\s+)?(class|interface|type|enum)\\s+${escapedSymbol}\\b`,
    `^\\s*def\\s+${escapedSymbol}\\b`,
    `^\\s*class\\s+${escapedSymbol}\\b`,
    `^\\s*func\\s+(\\([^)]*\\)\\s*)?${escapedSymbol}\\b`,
    `^\\s*(pub\\s+)?(fn|struct|enum|trait|type)\\s+${escapedSymbol}\\b`,
  ].join("|")
}

const matchesSearchRoots = ({
  candidatePath,
  searchRoots,
}: {
  candidatePath: string
  searchRoots: string[]
}) => {
  if (searchRoots.includes(".")) {
    return true
  }

  return searchRoots.some(
    (searchRoot) =>
      candidatePath === searchRoot || candidatePath.startsWith(`${searchRoot}/`),
  )
}

const decodeTagsLocatorText = (locator: string) => {
  if (locator.length < 2) {
    return locator
  }

  return locator
    .replace(/^[/?]/u, "")
    .replace(/[/?]$/u, "")
    .replace(/^\^/u, "")
    .replace(/\$$/u, "")
    .replace(/\\(.)/gu, "$1")
}

const findTagsFile = async (projectRoot: string) => {
  const candidates = [path.join(projectRoot, "tags"), path.join(projectRoot, ".tags")]

  for (const candidate of candidates) {
    try {
      await access(candidate)
      return candidate
    } catch {
      continue
    }
  }

  return undefined
}

class TagsFileDefinitionProvider implements DefinitionProvider {
  findDefinitions = async ({
    projectRoot,
    symbol,
    maxResults,
    searchRoots,
  }: DefinitionQuery): Promise<DefinitionProviderResult> => {
    const tagsFile = await findTagsFile(projectRoot)

    if (!tagsFile) {
      return {
        provider: "tags-file",
        truncated: false,
        matches: [],
      }
    }

    const fileCache = new Map<string, string[]>()
    const matches: DefinitionMatch[] = []
    let truncated = false

    const getFileLines = async (relativePath: string) => {
      const absolutePath = path.join(projectRoot, relativePath)

      if (fileCache.has(absolutePath)) {
        return fileCache.get(absolutePath) ?? []
      }

      const buffer = await readFile(absolutePath)
      const lines = buffer.toString("utf8").split(/\r?\n/u)

      fileCache.set(absolutePath, lines)
      return lines
    }

    const resolveLineNumber = async ({
      locator,
      fields,
      relativePath,
    }: {
      locator: string
      fields: string[]
      relativePath: string
    }) => {
      const directLine =
        Number.parseInt(locator.replace(/;"$/u, ""), 10) ||
        Number.parseInt(
          fields.find((field) => field.startsWith("line:"))?.slice("line:".length) ?? "",
          10,
        )

      if (Number.isFinite(directLine) && directLine > 0) {
        return directLine
      }

      const locatorText = decodeTagsLocatorText(locator.replace(/;"$/u, ""))

      if (locatorText.length === 0) {
        return undefined
      }

      const lines = await getFileLines(relativePath)
      const lineIndex = lines.findIndex((line) => line.includes(locatorText))

      return lineIndex === -1 ? undefined : lineIndex + 1
    }

    const lineReader = readline.createInterface({
      input: createReadStream(tagsFile, { encoding: "utf8" }),
      crlfDelay: Infinity,
    })

    for await (const line of lineReader) {
      if (line.startsWith("!_TAG_")) {
        continue
      }

      const parts = line.split("\t")

      if (parts.length < 3 || parts[0] !== symbol) {
        continue
      }

      const [, rawRelativePath, locator, ...fields] = parts
      const relativePath = rawRelativePath.replace(/\\/gu, "/")

      if (!matchesSearchRoots({ candidatePath: relativePath, searchRoots })) {
        continue
      }

      const lineNumber = await resolveLineNumber({
        locator,
        fields,
        relativePath,
      })

      if (!lineNumber) {
        continue
      }

      const fileLines = await getFileLines(relativePath)
      const text = fileLines[lineNumber - 1] ?? decodeTagsLocatorText(locator)
      const kindField = fields.find((field) => field.startsWith("kind:"))
      const shorthandKind = fields.find((field) => /^[A-Za-z]$/u.test(field))

      matches.push({
        path: relativePath,
        line: lineNumber,
        column: 1,
        text,
        provider: "tags-file",
        confidence: "high",
        kind: kindField?.slice("kind:".length) ?? shorthandKind,
      })

      if (matches.length >= maxResults) {
        truncated = true
        lineReader.close()
        break
      }
    }

    return {
      provider: "tags-file",
      truncated,
      matches,
    }
  }
}

class RipgrepDefinitionProvider implements DefinitionProvider {
  findDefinitions = async ({
    projectRoot,
    symbol,
    maxResults,
    searchRoots,
  }: DefinitionQuery): Promise<DefinitionProviderResult> => {
    const result = await searchWithRipgrep({
      projectRoot,
      pattern: buildDefinitionPattern(symbol),
      maxResults,
      caseSensitive: true,
      searchRoots,
      globs: sourceFileGlobs,
    })

    return {
      provider: "ripgrep-heuristic",
      truncated: result.truncated,
      matches: result.matches.map((match) => ({
        ...match,
        provider: "ripgrep-heuristic",
        confidence: "medium",
        kind: inferKind(match.text),
      })),
    }
  }
}

const providers: DefinitionProvider[] = [
  new TagsFileDefinitionProvider(),
  new RipgrepDefinitionProvider(),
]

const resolveSearchRoots = async ({
  projectRoot,
  scopePath,
}: {
  projectRoot: string
  scopePath?: string
}) => {
  if (!scopePath) {
    return ["."]
  }

  const resolvedPath = await resolveProjectPath({
    projectRoot,
    targetPath: scopePath,
    allowDirectory: true,
  })

  return [resolvedPath.relativePath]
}

export const findSymbolDefinitions = async ({
  projectRoot,
  symbol,
  maxResults,
  scopePath,
}: {
  projectRoot: string
  symbol: string
  maxResults: number
  scopePath?: string
}) => {
  const searchRoots = await resolveSearchRoots({ projectRoot, scopePath })
  let lastResult: DefinitionProviderResult = {
    provider: "ripgrep-heuristic",
    truncated: false,
    matches: [],
  }

  for (const provider of providers) {
    const result = await provider.findDefinitions({
      projectRoot,
      symbol,
      maxResults,
      searchRoots,
    })

    if (result.matches.length > 0) {
      return {
        projectRoot,
        symbol,
        provider: result.provider,
        truncated: result.truncated,
        matches: result.matches,
      }
    }

    lastResult = result
  }

  return {
    projectRoot,
    symbol,
    provider: lastResult.provider,
    truncated: lastResult.truncated,
    matches: lastResult.matches,
  }
}

export const formatDefinitionSearch = ({
  symbol,
  provider,
  truncated,
  matches,
}: {
  symbol: string
  provider: string
  truncated: boolean
  matches: DefinitionMatch[]
}) => {
  if (matches.length === 0) {
    return `symbol: ${symbol}\nprovider: ${provider}\nresults: 0`
  }

  const lines = [
    `symbol: ${symbol}`,
    `provider: ${provider}`,
    `results: ${matches.length}${truncated ? " (truncated)" : ""}`,
  ]

  for (const match of matches) {
    const suffix = match.kind ? ` ${match.kind}` : ""
    lines.push(
      `- ${match.path}:${match.line}:${match.column} [${match.confidence}]${suffix} ${match.text}`,
    )
  }

  return lines.join("\n")
}
