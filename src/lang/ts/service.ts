import { readFileSync } from "node:fs"
import path from "node:path"

import ts from "typescript"

import { isWithinPath, toProjectRelativePath } from "../../util/path.js"

type CachedLanguageService = {
  generation: number
  fileNames: string[]
  service: ts.LanguageService
}

const serviceCache = new Map<string, CachedLanguageService>()

const normalizeAbsolutePath = (value: string) => path.resolve(value)

const toAbsolutePath = ({
  projectRoot,
  relativePath,
}: {
  projectRoot: string
  relativePath: string
}) => path.join(projectRoot, relativePath)

const loadConfiguredFileNames = ({ projectRoot }: { projectRoot: string }) => {
  const configPath =
    ts.findConfigFile(projectRoot, ts.sys.fileExists, "tsconfig.json") ??
    ts.findConfigFile(projectRoot, ts.sys.fileExists, "jsconfig.json")

  if (!configPath) {
    return undefined
  }

  const configFile = ts.readConfigFile(configPath, ts.sys.readFile)

  if (configFile.error) {
    return undefined
  }

  const parsedConfig = ts.parseJsonConfigFileContent(
    configFile.config,
    ts.sys,
    path.dirname(configPath),
  )

  if (parsedConfig.errors.length > 0) {
    return undefined
  }

  return {
    compilerOptions: parsedConfig.options,
    fileNames: parsedConfig.fileNames.map((fileName) =>
      normalizeAbsolutePath(fileName),
    ),
  }
}

const createLanguageService = ({
  projectRoot,
  trackedRelativePaths,
}: {
  projectRoot: string
  trackedRelativePaths: string[]
}) => {
  const configuredFiles = loadConfiguredFileNames({ projectRoot })
  const fileNames =
    configuredFiles?.fileNames ??
    trackedRelativePaths.map((relativePath) =>
      normalizeAbsolutePath(
        toAbsolutePath({
          projectRoot,
          relativePath,
        }),
      ),
    )

  const compilerOptions =
    configuredFiles?.compilerOptions ??
    ({
      allowJs: true,
      checkJs: false,
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.NodeNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      target: ts.ScriptTarget.ESNext,
    } satisfies ts.CompilerOptions)

  const host: ts.LanguageServiceHost = {
    getCompilationSettings: () => compilerOptions,
    getCurrentDirectory: () => projectRoot,
    getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options),
    getScriptFileNames: () => fileNames,
    getScriptSnapshot: (fileName) => {
      if (!ts.sys.fileExists(fileName)) {
        return undefined
      }

      return ts.ScriptSnapshot.fromString(readFileSync(fileName, "utf8"))
    },
    getScriptVersion: () => "1",
    readDirectory: ts.sys.readDirectory,
    readFile: ts.sys.readFile,
    fileExists: ts.sys.fileExists,
    directoryExists: ts.sys.directoryExists,
    getDirectories: ts.sys.getDirectories,
    realpath: ts.sys.realpath,
  }

  return {
    fileNames,
    service: ts.createLanguageService(host, ts.createDocumentRegistry()),
  }
}

const getCachedService = ({
  projectRoot,
  trackedRelativePaths,
  generation,
}: {
  projectRoot: string
  trackedRelativePaths: string[]
  generation: number
}) => {
  const cacheKey = projectRoot
  const existing = serviceCache.get(cacheKey)

  if (existing && existing.generation === generation) {
    return existing
  }

  existing?.service.dispose()

  const created = createLanguageService({
    projectRoot,
    trackedRelativePaths,
  })
  const cached = {
    generation,
    ...created,
  }

  serviceCache.set(cacheKey, cached)

  return cached
}

const getPosition = ({
  sourceFile,
  line,
  column,
}: {
  sourceFile: ts.SourceFile
  line: number
  column: number
}) =>
  sourceFile.getPositionOfLineAndCharacter(line - 1, Math.max(0, column - 1))

const toRelativeLocation = ({
  projectRoot,
  fileName,
  start,
  length,
  program,
}: {
  projectRoot: string
  fileName: string
  start: number
  length: number
  program: ts.Program | undefined
}) => {
  const normalizedPath = normalizeAbsolutePath(fileName)

  if (!isWithinPath({ parent: projectRoot, child: normalizedPath })) {
    return undefined
  }

  const sourceFile = program?.getSourceFile(normalizedPath)

  if (!sourceFile) {
    return undefined
  }

  const startPosition = sourceFile.getLineAndCharacterOfPosition(start)
  const endPosition = sourceFile.getLineAndCharacterOfPosition(start + length)

  return {
    relativePath: toProjectRelativePath({
      projectRoot,
      targetPath: normalizedPath,
    }),
    line: startPosition.line + 1,
    column: startPosition.character + 1,
    endLine: endPosition.line + 1,
    endColumn: endPosition.character + 1,
  }
}

export const getTsDefinitionsAt = ({
  projectRoot,
  trackedRelativePaths,
  generation,
  relativePath,
  line,
  column,
}: {
  projectRoot: string
  trackedRelativePaths: string[]
  generation: number
  relativePath: string
  line: number
  column: number
}) => {
  const cached = getCachedService({
    projectRoot,
    trackedRelativePaths,
    generation,
  })
  const absolutePath = normalizeAbsolutePath(
    toAbsolutePath({
      projectRoot,
      relativePath,
    }),
  )
  const program = cached.service.getProgram()
  const sourceFile = program?.getSourceFile(absolutePath)

  if (!sourceFile) {
    return []
  }

  const offset = getPosition({
    sourceFile,
    line,
    column,
  })
  const definitions =
    cached.service.getDefinitionAtPosition(absolutePath, offset) ?? []

  return definitions
    .map((definition) =>
      toRelativeLocation({
        projectRoot,
        fileName: definition.fileName,
        start: definition.textSpan.start,
        length: definition.textSpan.length,
        program,
      }),
    )
    .filter((value): value is NonNullable<typeof value> => value !== undefined)
}

export const getTsReferencesAt = ({
  projectRoot,
  trackedRelativePaths,
  generation,
  relativePath,
  line,
  column,
}: {
  projectRoot: string
  trackedRelativePaths: string[]
  generation: number
  relativePath: string
  line: number
  column: number
}) => {
  const cached = getCachedService({
    projectRoot,
    trackedRelativePaths,
    generation,
  })
  const absolutePath = normalizeAbsolutePath(
    toAbsolutePath({
      projectRoot,
      relativePath,
    }),
  )
  const program = cached.service.getProgram()
  const sourceFile = program?.getSourceFile(absolutePath)

  if (!sourceFile) {
    return []
  }

  const offset = getPosition({
    sourceFile,
    line,
    column,
  })
  const definitionLocations = getTsDefinitionsAt({
    projectRoot,
    trackedRelativePaths,
    generation,
    relativePath,
    line,
    column,
  })
  const definitionKeys = new Set(
    definitionLocations.map(
      (location) =>
        `${location.relativePath}:${location.line}:${location.column}`,
    ),
  )
  const references =
    cached.service.getReferencesAtPosition(absolutePath, offset) ?? []

  return references
    .map((reference) => {
      const location = toRelativeLocation({
        projectRoot,
        fileName: reference.fileName,
        start: reference.textSpan.start,
        length: reference.textSpan.length,
        program,
      })

      if (!location) {
        return undefined
      }

      return {
        ...location,
        isDefinition: definitionKeys.has(
          `${location.relativePath}:${location.line}:${location.column}`,
        ),
      }
    })
    .filter((value): value is NonNullable<typeof value> => value !== undefined)
}
