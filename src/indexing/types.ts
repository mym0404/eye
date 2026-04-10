export type LanguageId = "javascript" | "typescript" | "python" | "unknown"

export type RecordSource = "semantic" | "tree-sitter" | "fallback" | "index"

export type SymbolKind =
  | "class"
  | "constant"
  | "enum"
  | "function"
  | "interface"
  | "method"
  | "module"
  | "property"
  | "type"
  | "unknown"
  | "variable"

export type NormalizedFileRecord = {
  relativePath: string
  language: LanguageId
  size: number
  mtimeMs: number
  contentHash: string
  blobHash?: string
  parseSource: "tree-sitter" | "fallback-text"
}

export type NormalizedSymbolRecord = {
  symbolId: string
  relativePath: string
  language: LanguageId
  name: string
  kind: SymbolKind
  line: number
  column: number
  endLine?: number
  endColumn?: number
  containerName?: string
  source: RecordSource
}

export type NormalizedReferenceRecord = {
  relativePath: string
  language: LanguageId
  name: string
  line: number
  column: number
  context: string
  symbolId?: string
  source: RecordSource
}

export type NormalizedDependencyEdge = {
  relativePath: string
  dependencyPath: string
  edgeKind: "import" | "export" | "include"
  specifier: string
}

export type IndexedFileData = {
  file: NormalizedFileRecord
  symbols: NormalizedSymbolRecord[]
  references: NormalizedReferenceRecord[]
  dependencies: NormalizedDependencyEdge[]
  blobPayload: {
    schemaVersion: number
    relativePath: string
    language: LanguageId
    parseSource: "tree-sitter" | "fallback-text"
    symbols: Array<{
      symbolId: string
      name: string
      kind: SymbolKind
      line: number
      column: number
      endLine?: number
      endColumn?: number
      containerName?: string
    }>
    references: Array<{
      name: string
      line: number
      column: number
      symbolId?: string
    }>
    dependencies: NormalizedDependencyEdge[]
  }
}
