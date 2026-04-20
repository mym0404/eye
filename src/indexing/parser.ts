import { execFile } from "node:child_process"
import { stat } from "node:fs/promises"
import path from "node:path"
import { promisify } from "node:util"

import { hashValue } from "../util/hash.js"
import { getLanguageIdFromPath } from "./language.js"
import { createSymbolId } from "./symbol-id.js"
import type {
  IndexedFileData,
  LanguageId,
  NormalizedDependencyEdge,
  NormalizedReferenceRecord,
  NormalizedSymbolRecord,
  SymbolKind,
} from "./types.js"

const execFileAsync = promisify(execFile)
const ctagsBlobSchemaVersion = 2

type CtagsTag = {
  _type?: string
  name?: string
  kind?: string
  line?: number
  scope?: string
}

const toAbsolutePath = ({
  projectRoot,
  relativePath,
}: {
  projectRoot: string
  relativePath: string
}) => path.join(projectRoot, relativePath)

const buildLineIndex = (text: string) => text.split(/\r?\n/u)

const getLineText = ({ lines, line }: { lines: string[]; line: number }) =>
  lines[line - 1] ?? ""

const findColumn = ({ lineText, name }: { lineText: string; name: string }) => {
  const index = lineText.indexOf(name)

  return index >= 0 ? index + 1 : 1
}

const toSymbolKind = (kind?: string): SymbolKind => {
  switch (kind?.toLowerCase()) {
    case "class":
      return "class"
    case "constant":
    case "const":
      return "constant"
    case "enum":
      return "enum"
    case "field":
    case "member":
    case "property":
      return "property"
    case "function":
      return "function"
    case "interface":
      return "interface"
    case "method":
      return "method"
    case "module":
    case "namespace":
    case "package":
      return "module"
    case "type":
    case "typealias":
      return "type"
    case "variable":
      return "variable"
    default:
      return "unknown"
  }
}

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
    schemaVersion: ctagsBlobSchemaVersion,
    relativePath,
    language,
    parseSource: "fallback-text",
    symbols: [],
    references: [],
    dependencies: [],
  },
})

const extractTsLikeDependencies = ({
  relativePath,
  text,
}: {
  relativePath: string
  text: string
}) => {
  const dependencies: NormalizedDependencyEdge[] = []
  const importExportPattern =
    /(?:^|\n)\s*(import|export)\s+[\s\S]*?\sfrom\s+["']([^"']+)["']/gu
  const requirePattern = /require\(\s*["']([^"']+)["']\s*\)/gu

  for (const match of text.matchAll(importExportPattern)) {
    const edgeKind = match[1] === "export" ? "export" : "import"
    const specifier = match[2]

    if (!specifier) {
      continue
    }

    dependencies.push({
      relativePath,
      dependencyPath: specifier,
      edgeKind,
      specifier,
    })
  }

  for (const match of text.matchAll(requirePattern)) {
    const specifier = match[1]

    if (!specifier) {
      continue
    }

    dependencies.push({
      relativePath,
      dependencyPath: specifier,
      edgeKind: "import",
      specifier,
    })
  }

  return dependencies
}

const extractPythonDependencies = ({
  relativePath,
  text,
}: {
  relativePath: string
  text: string
}) => {
  const dependencies: NormalizedDependencyEdge[] = []
  const fromPattern = /(?:^|\n)\s*from\s+([A-Za-z0-9_.]+)\s+import\b/gu
  const importPattern = /(?:^|\n)\s*import\s+([A-Za-z0-9_.,\s]+)/gu

  for (const match of text.matchAll(fromPattern)) {
    const specifier = match[1]?.trim()

    if (!specifier) {
      continue
    }

    dependencies.push({
      relativePath,
      dependencyPath: specifier,
      edgeKind: "import",
      specifier,
    })
  }

  for (const match of text.matchAll(importPattern)) {
    const imports = match[1]
      ?.split(",")
      .map((entry) =>
        entry
          .trim()
          .split(/\s+as\s+/u)[0]
          ?.trim(),
      )
      .filter((entry): entry is string => Boolean(entry))

    for (const specifier of imports ?? []) {
      dependencies.push({
        relativePath,
        dependencyPath: specifier,
        edgeKind: "import",
        specifier,
      })
    }
  }

  return dependencies
}

const buildDependencies = ({
  relativePath,
  language,
  text,
}: {
  relativePath: string
  language: LanguageId
  text: string
}) => {
  if (language === "javascript" || language === "typescript") {
    return extractTsLikeDependencies({
      relativePath,
      text,
    })
  }

  if (language === "python") {
    return extractPythonDependencies({
      relativePath,
      text,
    })
  }

  return []
}

const readCtagsTags = async (absolutePath: string) => {
  const { stdout } = await execFileAsync("ctags", [
    "--options=NONE",
    "--output-format=json",
    "--fields=+nKSE",
    "--extras=-F",
    "--sort=no",
    "-o",
    "-",
    absolutePath,
  ])

  return stdout
    .split(/\r?\n/u)
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as CtagsTag)
    .filter((tag) => tag._type === "tag")
}

const buildCtagsRecords = ({
  relativePath,
  language,
  text,
  size,
  mtimeMs,
  contentHash,
  tags,
}: {
  relativePath: string
  language: LanguageId
  text: string
  size: number
  mtimeMs: number
  contentHash: string
  tags: CtagsTag[]
}): IndexedFileData => {
  const lines = buildLineIndex(text)
  const symbols: NormalizedSymbolRecord[] = []
  const references: NormalizedReferenceRecord[] = []

  for (const tag of tags) {
    if (!tag.name || !tag.line) {
      continue
    }

    const lineText = getLineText({
      lines,
      line: tag.line,
    })
    const column = findColumn({
      lineText,
      name: tag.name,
    })
    const kind = toSymbolKind(tag.kind)
    const symbolId = createSymbolId({
      projectRoot: "",
      language,
      relativePath,
      name: tag.name,
      kind,
      line: tag.line,
      column,
    })

    symbols.push({
      symbolId,
      relativePath,
      language,
      name: tag.name,
      kind,
      line: tag.line,
      column,
      containerName: tag.scope,
      source: "ctags",
    })

    references.push({
      relativePath,
      language,
      name: tag.name,
      line: tag.line,
      column,
      context: lineText.trim(),
      symbolId,
      source: "ctags",
    })
  }

  const dependencies = buildDependencies({
    relativePath,
    language,
    text,
  })

  return {
    file: {
      relativePath,
      language,
      size,
      mtimeMs,
      contentHash,
      parseSource: "ctags",
    },
    symbols,
    references,
    dependencies,
    blobPayload: {
      schemaVersion: ctagsBlobSchemaVersion,
      relativePath,
      language,
      parseSource: "ctags",
      symbols: symbols.map((symbol) => ({
        symbolId: symbol.symbolId,
        name: symbol.name,
        kind: symbol.kind,
        line: symbol.line,
        column: symbol.column,
        endLine: symbol.endLine,
        endColumn: symbol.endColumn,
        containerName: symbol.containerName,
      })),
      references: references.map((reference) => ({
        name: reference.name,
        line: reference.line,
        column: reference.column,
        symbolId: reference.symbolId,
      })),
      dependencies,
    },
  }
}

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

  if (language === "unknown") {
    return buildFallbackRecords({
      relativePath,
      language,
      size: fileInfo.size,
      mtimeMs: fileInfo.mtimeMs,
      contentHash,
    })
  }

  try {
    const tags = await readCtagsTags(absolutePath)

    return buildCtagsRecords({
      relativePath,
      language,
      text,
      size: fileInfo.size,
      mtimeMs: fileInfo.mtimeMs,
      contentHash,
      tags,
    })
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
