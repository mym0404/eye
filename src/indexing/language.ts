import path from "node:path"

import type { LanguageId } from "./types.js"

const javascriptExtensions = new Set([".js", ".jsx", ".mjs", ".cjs"])
const typescriptExtensions = new Set([".ts", ".tsx", ".mts", ".cts"])
const pythonExtensions = new Set([".py"])

export const getLanguageIdFromPath = (relativePath: string): LanguageId => {
  const extension = path.extname(relativePath).toLowerCase()

  if (javascriptExtensions.has(extension)) {
    return "javascript"
  }

  if (typescriptExtensions.has(extension)) {
    return "typescript"
  }

  if (pythonExtensions.has(extension)) {
    return "python"
  }

  return "unknown"
}

export const getTreeSitterGrammarName = (relativePath: string) => {
  const extension = path.extname(relativePath).toLowerCase()

  if (extension === ".tsx" || extension === ".jsx") {
    return "tsx" as const
  }

  if (typescriptExtensions.has(extension)) {
    return "typescript" as const
  }

  if (javascriptExtensions.has(extension)) {
    return "javascript" as const
  }

  if (pythonExtensions.has(extension)) {
    return "python" as const
  }

  return undefined
}

export const isSupportedSourcePath = (relativePath: string) =>
  getLanguageIdFromPath(relativePath) !== "unknown"

export const isSemanticLanguage = (language: LanguageId) =>
  language === "javascript" ||
  language === "typescript" ||
  language === "python"
