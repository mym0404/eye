import type Parser from "web-tree-sitter"
import { getLanguageIdFromPath } from "../../indexing/language.js"
import { createSymbolId } from "../../indexing/symbol-id.js"
import type {
  IndexedFileData,
  LanguageId,
  NormalizedDependencyEdge,
  NormalizedReferenceRecord,
  NormalizedSymbolRecord,
  SymbolKind,
} from "../../indexing/types.js"

const treeSitterSchemaVersion = 1

const identifierNodeTypes = new Set([
  "identifier",
  "property_identifier",
  "shorthand_property_identifier",
  "type_identifier",
])

const stripQuotes = (value: string) =>
  value.replace(/^['"]/u, "").replace(/['"]$/u, "")

const buildLineIndex = (text: string) => text.split(/\r?\n/u)

const getLineText = ({ lines, line }: { lines: string[]; line: number }) =>
  lines[line - 1] ?? ""

const toLocation = (node: Parser.SyntaxNode) => ({
  line: node.startPosition.row + 1,
  column: node.startPosition.column + 1,
  endLine: node.endPosition.row + 1,
  endColumn: node.endPosition.column + 1,
})

const walk = ({
  node,
  visit,
}: {
  node: Parser.SyntaxNode
  visit: (
    node: Parser.SyntaxNode,
    parent: Parser.SyntaxNode | undefined,
  ) => void
}) => {
  const visitNode = (
    currentNode: Parser.SyntaxNode,
    parentNode: Parser.SyntaxNode | undefined,
  ) => {
    visit(currentNode, parentNode)

    for (const child of currentNode.namedChildren) {
      visitNode(child, currentNode)
    }
  }

  visitNode(node, undefined)
}

const collectBindingIdentifiers = (
  node: Parser.SyntaxNode | null,
): Parser.SyntaxNode[] => {
  if (!node) {
    return []
  }

  if (identifierNodeTypes.has(node.type)) {
    return [node]
  }

  return node.namedChildren.flatMap((child: Parser.SyntaxNode) =>
    collectBindingIdentifiers(child),
  )
}

const addSymbol = ({
  symbols,
  relativePath,
  language,
  nameNode,
  kind,
  containerName,
}: {
  symbols: NormalizedSymbolRecord[]
  relativePath: string
  language: LanguageId
  nameNode: Parser.SyntaxNode
  kind: SymbolKind
  containerName?: string
}) => {
  const location = toLocation(nameNode)
  const name = nameNode.text

  symbols.push({
    symbolId: createSymbolId({
      projectRoot: "",
      language,
      relativePath,
      name,
      kind,
      line: location.line,
      column: location.column,
    }),
    relativePath,
    language,
    name,
    kind,
    line: location.line,
    column: location.column,
    endLine: location.endLine,
    endColumn: location.endColumn,
    containerName,
    source: "tree-sitter",
  })
}

const recordDependency = ({
  dependencies,
  relativePath,
  node,
  edgeKind,
}: {
  dependencies: NormalizedDependencyEdge[]
  relativePath: string
  node: Parser.SyntaxNode | null
  edgeKind: "import" | "export" | "include"
}) => {
  if (!node) {
    return
  }

  const specifier = stripQuotes(node.text)

  dependencies.push({
    relativePath,
    dependencyPath: specifier,
    edgeKind,
    specifier,
  })
}

const extractTsLikeSymbols = ({
  node,
  relativePath,
  language,
  symbols,
  containerStack,
}: {
  node: Parser.SyntaxNode
  relativePath: string
  language: LanguageId
  symbols: NormalizedSymbolRecord[]
  containerStack: string[]
}) => {
  const containerName = containerStack.at(-1)
  const declarationNameNode = node.childForFieldName("name")

  switch (node.type) {
    case "class_declaration":
      if (declarationNameNode) {
        addSymbol({
          symbols,
          relativePath,
          language,
          nameNode: declarationNameNode,
          kind: "class",
          containerName,
        })
      }
      break
    case "function_declaration":
    case "generator_function_declaration":
      if (declarationNameNode) {
        addSymbol({
          symbols,
          relativePath,
          language,
          nameNode: declarationNameNode,
          kind: "function",
          containerName,
        })
      }
      break
    case "interface_declaration":
      if (declarationNameNode) {
        addSymbol({
          symbols,
          relativePath,
          language,
          nameNode: declarationNameNode,
          kind: "interface",
          containerName,
        })
      }
      break
    case "type_alias_declaration":
      if (declarationNameNode) {
        addSymbol({
          symbols,
          relativePath,
          language,
          nameNode: declarationNameNode,
          kind: "type",
          containerName,
        })
      }
      break
    case "enum_declaration":
      if (declarationNameNode) {
        addSymbol({
          symbols,
          relativePath,
          language,
          nameNode: declarationNameNode,
          kind: "enum",
          containerName,
        })
      }
      break
    case "method_definition":
      if (declarationNameNode) {
        addSymbol({
          symbols,
          relativePath,
          language,
          nameNode: declarationNameNode,
          kind: "method",
          containerName,
        })
      }
      break
    case "public_field_definition":
    case "property_signature":
      if (declarationNameNode) {
        addSymbol({
          symbols,
          relativePath,
          language,
          nameNode: declarationNameNode,
          kind: "property",
          containerName,
        })
      }
      break
    case "variable_declarator":
      for (const identifier of collectBindingIdentifiers(
        node.childForFieldName("name"),
      )) {
        addSymbol({
          symbols,
          relativePath,
          language,
          nameNode: identifier,
          kind: "variable",
          containerName,
        })
      }
      break
  }
}

const extractPythonSymbols = ({
  node,
  relativePath,
  symbols,
  containerStack,
}: {
  node: Parser.SyntaxNode
  relativePath: string
  symbols: NormalizedSymbolRecord[]
  containerStack: string[]
}) => {
  const containerName = containerStack.at(-1)
  const declarationNameNode = node.childForFieldName("name")

  switch (node.type) {
    case "class_definition":
      if (declarationNameNode) {
        addSymbol({
          symbols,
          relativePath,
          language: "python",
          nameNode: declarationNameNode,
          kind: "class",
          containerName,
        })
      }
      break
    case "function_definition":
      if (declarationNameNode) {
        addSymbol({
          symbols,
          relativePath,
          language: "python",
          nameNode: declarationNameNode,
          kind: "function",
          containerName,
        })
      }
      break
    case "assignment":
      for (const identifier of collectBindingIdentifiers(
        node.childForFieldName("left"),
      )) {
        addSymbol({
          symbols,
          relativePath,
          language: "python",
          nameNode: identifier,
          kind: "variable",
          containerName,
        })
      }
      break
  }
}

const buildDeclarationOffsets = (symbols: NormalizedSymbolRecord[]) =>
  new Set(
    symbols.map((symbol) => `${symbol.line}:${symbol.column}:${symbol.name}`),
  )

const extractReferences = ({
  rootNode,
  relativePath,
  language,
  symbols,
  lines,
}: {
  rootNode: Parser.SyntaxNode
  relativePath: string
  language: LanguageId
  symbols: NormalizedSymbolRecord[]
  lines: string[]
}) => {
  const declarationOffsets = buildDeclarationOffsets(symbols)
  const references: NormalizedReferenceRecord[] = []

  walk({
    node: rootNode,
    visit(node) {
      if (!identifierNodeTypes.has(node.type)) {
        return
      }

      const location = toLocation(node)
      const name = node.text
      const offsetKey = `${location.line}:${location.column}:${name}`

      if (declarationOffsets.has(offsetKey)) {
        return
      }

      references.push({
        relativePath,
        language,
        name,
        line: location.line,
        column: location.column,
        context: getLineText({ lines, line: location.line }).trim(),
        source: "tree-sitter",
      })
    },
  })

  return references
}

const extractTsLikeData = ({
  rootNode,
  relativePath,
  language,
}: {
  rootNode: Parser.SyntaxNode
  relativePath: string
  language: LanguageId
}) => {
  const symbols: NormalizedSymbolRecord[] = []
  const dependencies: NormalizedDependencyEdge[] = []

  const visitDeclaration = (
    node: Parser.SyntaxNode,
    containerStack: string[],
  ) => {
    const symbolCountBefore = symbols.length

    extractTsLikeSymbols({
      node,
      relativePath,
      language,
      symbols,
      containerStack,
    })

    if (node.type === "import_statement") {
      recordDependency({
        dependencies,
        relativePath,
        node: node.childForFieldName("source"),
        edgeKind: "import",
      })
    }

    if (node.type === "export_statement") {
      recordDependency({
        dependencies,
        relativePath,
        node: node.childForFieldName("source"),
        edgeKind: "export",
      })
    }

    const createdSymbol = symbols.at(symbols.length - 1)
    const nextContainerStack =
      createdSymbol && symbols.length > symbolCountBefore
        ? createdSymbol.kind === "class" ||
          createdSymbol.kind === "function" ||
          createdSymbol.kind === "interface"
          ? [...containerStack, createdSymbol.name]
          : containerStack
        : containerStack

    for (const child of node.namedChildren) {
      visitDeclaration(child, nextContainerStack)
    }
  }

  visitDeclaration(rootNode, [])

  return {
    symbols,
    dependencies,
  }
}

const extractPythonData = ({
  rootNode,
  relativePath,
}: {
  rootNode: Parser.SyntaxNode
  relativePath: string
}) => {
  const symbols: NormalizedSymbolRecord[] = []
  const dependencies: NormalizedDependencyEdge[] = []

  const visitDeclaration = (
    node: Parser.SyntaxNode,
    containerStack: string[],
  ) => {
    const symbolCountBefore = symbols.length

    extractPythonSymbols({
      node,
      relativePath,
      symbols,
      containerStack,
    })

    if (node.type === "import_statement") {
      for (const child of node.namedChildren) {
        if (child.type === "dotted_name" || child.type === "aliased_import") {
          dependencies.push({
            relativePath,
            dependencyPath: child.text,
            edgeKind: "import",
            specifier: child.text,
          })
        }
      }
    }

    if (node.type === "import_from_statement") {
      const moduleNode = node.childForFieldName("module_name")

      if (moduleNode) {
        dependencies.push({
          relativePath,
          dependencyPath: moduleNode.text,
          edgeKind: "import",
          specifier: moduleNode.text,
        })
      }
    }

    const createdSymbol = symbols.at(symbols.length - 1)
    const nextContainerStack =
      createdSymbol && symbols.length > symbolCountBefore
        ? createdSymbol.kind === "class" || createdSymbol.kind === "function"
          ? [...containerStack, createdSymbol.name]
          : containerStack
        : containerStack

    for (const child of node.namedChildren) {
      visitDeclaration(child, nextContainerStack)
    }
  }

  visitDeclaration(rootNode, [])

  return {
    symbols,
    dependencies,
  }
}

export const extractTreeSitterIndexData = ({
  relativePath,
  text,
  tree,
}: {
  relativePath: string
  text: string
  tree: Parser.Tree
}): Omit<IndexedFileData, "file"> => {
  const language = getLanguageIdFromPath(relativePath)
  const lines = buildLineIndex(text)
  const rootNode = tree.rootNode

  const extracted =
    language === "python"
      ? extractPythonData({
          rootNode,
          relativePath,
        })
      : extractTsLikeData({
          rootNode,
          relativePath,
          language,
        })

  const references = extractReferences({
    rootNode,
    relativePath,
    language,
    symbols: extracted.symbols,
    lines,
  })

  return {
    symbols: extracted.symbols,
    references,
    dependencies: extracted.dependencies,
    blobPayload: {
      schemaVersion: treeSitterSchemaVersion,
      relativePath,
      language,
      parseSource: "tree-sitter",
      symbols: extracted.symbols.map((symbol) => ({
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
      dependencies: extracted.dependencies,
    },
  }
}
