import Parser from "web-tree-sitter"

import { resolvePackagePath } from "../../util/package-path.js"

const grammarFileNames = {
  javascript: "tree-sitter-javascript.wasm",
  python: "tree-sitter-python.wasm",
  tsx: "tree-sitter-tsx.wasm",
  typescript: "tree-sitter-typescript.wasm",
} as const

type GrammarName = keyof typeof grammarFileNames

let parserReady: Promise<void> | undefined
const loadedLanguages = new Map<GrammarName, Promise<Parser.Language>>()

const getWebTreeSitterWasmPath = () =>
  resolvePackagePath({
    packageName: "web-tree-sitter",
    relativePath: "tree-sitter.wasm",
  })

const getGrammarWasmPath = (grammarName: GrammarName) =>
  resolvePackagePath({
    packageName: "tree-sitter-wasms",
    relativePath: `out/${grammarFileNames[grammarName]}`,
  })

const ensureParserReady = async () => {
  if (!parserReady) {
    const wasmPath = getWebTreeSitterWasmPath()
    parserReady = Parser.init({
      locateFile(scriptName: string) {
        if (scriptName.endsWith(".wasm")) {
          return wasmPath
        }

        return scriptName
      },
    })
  }

  await parserReady
}

const loadLanguage = async (grammarName: GrammarName) => {
  const existing = loadedLanguages.get(grammarName)

  if (existing) {
    return existing
  }

  const promise = (async () => {
    await ensureParserReady()
    const wasmPath = getGrammarWasmPath(grammarName)

    return Parser.Language.load(wasmPath)
  })()

  loadedLanguages.set(grammarName, promise)

  return promise
}

export const parseWithTreeSitter = async ({
  grammarName,
  text,
}: {
  grammarName: GrammarName
  text: string
}) => {
  const language = await loadLanguage(grammarName)
  const parser = new Parser()

  try {
    parser.setLanguage(language)

    const tree = parser.parse(text)

    if (!tree) {
      throw new Error(`failed to parse source with ${grammarName}`)
    }

    return tree
  } finally {
    parser.delete()
  }
}
