import { McpServer } from "@modelcontextprotocol/server"
import * as z from "zod/v4"

import { refreshProjectIndex } from "../indexing/indexer.js"
import { loadProjectContext } from "../project/context.js"
import {
  type DefinitionCandidate,
  findSymbolDefinitions,
  formatDefinitionSearch,
} from "../query/definitions.js"
import {
  findReferences,
  formatReferenceSearch,
  type ReferenceCandidate,
} from "../query/references.js"
import {
  formatSourceRange,
  readSourceRange,
  type SourceLine,
} from "../query/source.js"
import { getIndexStatusSummary } from "../query/status.js"
import {
  formatProjectStructure,
  getProjectStructure,
  type TreeEntry,
} from "../query/structure.js"
import { EyeDatabase } from "../storage/database.js"

const serverVersion = "0.2.0"

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "unknown error"

const asToolError = (error: unknown) => ({
  isError: true,
  content: [
    {
      type: "text" as const,
      text: getErrorMessage(error),
    },
  ],
})

const treeEntrySchema: z.ZodType<TreeEntry> = z.lazy(() =>
  z.object({
    name: z.string(),
    path: z.string(),
    kind: z.enum(["file", "directory", "symlink"]),
    children: z.array(treeEntrySchema).optional(),
  }),
)

const sourceLineSchema: z.ZodType<SourceLine> = z.object({
  number: z.number().int().positive(),
  text: z.string(),
})

const definitionCandidateSchema: z.ZodType<DefinitionCandidate> = z.object({
  symbolId: z.string().optional(),
  name: z.string().optional(),
  kind: z
    .enum([
      "class",
      "constant",
      "enum",
      "function",
      "interface",
      "method",
      "module",
      "property",
      "type",
      "unknown",
      "variable",
    ])
    .optional(),
  containerName: z.string().optional(),
  filePath: z.string(),
  line: z.number().int().positive(),
  column: z.number().int().positive(),
  endLine: z.number().int().positive().optional(),
  endColumn: z.number().int().positive().optional(),
  language: z.enum(["javascript", "typescript", "python", "unknown"]),
  confidence: z.enum(["exact", "high", "medium", "low"]),
  source: z.enum(["semantic", "index", "fallback"]),
})

const referenceCandidateSchema: z.ZodType<ReferenceCandidate> = z.object({
  symbolId: z.string().optional(),
  name: z.string().optional(),
  filePath: z.string(),
  line: z.number().int().positive(),
  column: z.number().int().positive(),
  endLine: z.number().int().positive().optional(),
  endColumn: z.number().int().positive().optional(),
  language: z.enum(["javascript", "typescript", "python", "unknown"]),
  context: z.string(),
  confidence: z.enum(["exact", "high", "medium", "low"]),
  source: z.enum(["semantic", "index", "fallback"]),
})

const anchorSchema = z.object({
  filePath: z.string(),
  line: z.number().int().min(1),
  column: z.number().int().min(1),
})

const withDatabase = async <ResultValue>({
  projectRoot,
  run,
}: {
  projectRoot?: string
  run: (args: {
    context: Awaited<ReturnType<typeof loadProjectContext>>
    database: EyeDatabase
  }) => Promise<ResultValue>
}) => {
  const context = await loadProjectContext({
    projectRoot,
    ensureRuntime: true,
  })
  const database = await EyeDatabase.open({
    databasePath: context.paths.cacheDbPath,
    projectRoot: context.projectRoot,
  })

  try {
    return await run({
      context,
      database,
    })
  } finally {
    database.close()
  }
}

export const createEyeServer = () => {
  const server = new McpServer(
    {
      name: "eye",
      version: serverVersion,
    },
    {
      capabilities: {
        logging: {},
      },
      instructions:
        "Use bounded repository reads. Prefer symbolId for exact navigation. The server maintains a lazy project-local .eye cache for semantic and structural queries.",
    },
  )

  server.registerTool(
    "get_project_structure",
    {
      title: "Get Project Structure",
      description:
        "Return a bounded directory tree for the selected project root.",
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
      },
      inputSchema: z.object({
        projectRoot: z.string().optional(),
        depth: z.number().int().min(0).max(8).optional(),
        maxEntries: z.number().int().min(1).max(2000).optional(),
        includeFiles: z.boolean().optional(),
        includeHidden: z.boolean().optional(),
      }),
      outputSchema: z.object({
        projectRoot: z.string(),
        depth: z.number().int().min(0),
        maxEntries: z.number().int().min(1),
        totalEntries: z.number().int().min(0),
        truncated: z.boolean(),
        entries: z.array(treeEntrySchema),
      }),
    },
    async ({ projectRoot, depth, maxEntries, includeFiles, includeHidden }) => {
      try {
        const context = await loadProjectContext({
          projectRoot,
          ensureRuntime: false,
        })
        const output = await getProjectStructure({
          context,
          depth: depth ?? 3,
          maxEntries: maxEntries ?? 200,
          includeFiles: includeFiles ?? true,
          includeHidden: includeHidden ?? false,
        })

        return {
          content: [
            {
              type: "text" as const,
              text: formatProjectStructure(output),
            },
          ],
          structuredContent: output,
        }
      } catch (error) {
        return asToolError(error)
      }
    },
  )

  server.registerTool(
    "read_source_range",
    {
      title: "Read Source Range",
      description:
        "Read a file around a requested line and return numbered lines.",
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
      },
      inputSchema: z.object({
        projectRoot: z.string().optional(),
        filePath: z.string(),
        line: z.number().int().min(1),
        before: z.number().int().min(0).max(400).optional(),
        after: z.number().int().min(0).max(400).optional(),
        maxLines: z.number().int().min(1).max(400).optional(),
      }),
      outputSchema: z.object({
        projectRoot: z.string(),
        filePath: z.string(),
        line: z.number().int().min(1),
        startLine: z.number().int().min(0),
        endLine: z.number().int().min(0),
        totalLines: z.number().int().min(0),
        clamped: z.boolean(),
        lines: z.array(sourceLineSchema),
      }),
    },
    async ({ projectRoot, filePath, line, before, after, maxLines }) => {
      try {
        const context = await loadProjectContext({
          projectRoot,
          ensureRuntime: false,
        })
        const output = await readSourceRange({
          projectRoot: context.projectRoot,
          filePath,
          line,
          before: before ?? 20,
          after: after ?? 20,
          maxLines: maxLines ?? 120,
        })

        return {
          content: [
            {
              type: "text" as const,
              text: formatSourceRange(output),
            },
          ],
          structuredContent: output,
        }
      } catch (error) {
        return asToolError(error)
      }
    },
  )

  server.registerTool(
    "find_symbol_definitions",
    {
      title: "Find Symbol Definitions",
      description:
        "Find symbol definition candidates using lazy indexing, semantic backends, and ripgrep fallback.",
      inputSchema: z.object({
        projectRoot: z.string().optional(),
        symbolId: z.string().optional(),
        symbol: z.string().min(1).optional(),
        anchor: anchorSchema.optional(),
        scopePath: z.string().optional(),
        maxResults: z.number().int().min(1).max(100).optional(),
      }),
      outputSchema: z.object({
        projectRoot: z.string(),
        strategy: z.enum(["semantic", "index", "fallback"]),
        indexedGeneration: z.number().int().min(0),
        truncated: z.boolean(),
        candidates: z.array(definitionCandidateSchema),
      }),
    },
    async ({
      projectRoot,
      symbolId,
      symbol,
      anchor,
      scopePath,
      maxResults,
    }) => {
      if (!symbolId && !symbol && !anchor) {
        return asToolError(
          new Error("Provide one of symbolId, symbol, or anchor."),
        )
      }

      try {
        const output = await withDatabase({
          projectRoot,
          run: ({ context, database }) =>
            findSymbolDefinitions({
              context,
              database,
              symbolId,
              symbol,
              anchor,
              scopePath,
              maxResults: maxResults ?? 20,
            }),
        })

        return {
          content: [
            {
              type: "text" as const,
              text: formatDefinitionSearch(output),
            },
          ],
          structuredContent: output,
        }
      } catch (error) {
        return asToolError(error)
      }
    },
  )

  server.registerTool(
    "find_references",
    {
      title: "Find References",
      description:
        "Find references using semantic navigation when possible, then supplement with indexed and ripgrep matches.",
      inputSchema: z.object({
        projectRoot: z.string().optional(),
        symbolId: z.string().optional(),
        symbol: z.string().min(1).optional(),
        anchor: anchorSchema.optional(),
        scopePath: z.string().optional(),
        maxResults: z.number().int().min(1).max(200).optional(),
        includeDeclaration: z.boolean().optional(),
      }),
      outputSchema: z.object({
        projectRoot: z.string(),
        strategy: z.enum(["semantic", "index", "fallback"]),
        indexedGeneration: z.number().int().min(0),
        truncated: z.boolean(),
        candidates: z.array(referenceCandidateSchema),
      }),
    },
    async ({
      projectRoot,
      symbolId,
      symbol,
      anchor,
      scopePath,
      maxResults,
      includeDeclaration,
    }) => {
      if (!symbolId && !symbol && !anchor) {
        return asToolError(
          new Error("Provide one of symbolId, symbol, or anchor."),
        )
      }

      try {
        const output = await withDatabase({
          projectRoot,
          run: ({ context, database }) =>
            findReferences({
              context,
              database,
              symbolId,
              symbol,
              anchor,
              scopePath,
              maxResults: maxResults ?? 50,
              includeDeclaration: includeDeclaration ?? false,
            }),
        })

        return {
          content: [
            {
              type: "text" as const,
              text: formatReferenceSearch(output),
            },
          ],
          structuredContent: output,
        }
      } catch (error) {
        return asToolError(error)
      }
    },
  )

  server.registerTool(
    "refresh_index",
    {
      title: "Refresh Index",
      description:
        "Refresh the lazy project-local index for the whole root or a narrowed scope.",
      inputSchema: z.object({
        projectRoot: z.string().optional(),
        scopePath: z.string().optional(),
      }),
      outputSchema: z.object({
        generation: z.number().int().min(0),
        changedFiles: z.number().int().min(0),
        reusedFiles: z.number().int().min(0),
        removedFiles: z.number().int().min(0),
        indexedFiles: z.number().int().min(0),
      }),
    },
    async ({ projectRoot, scopePath }) => {
      try {
        const output = await withDatabase({
          projectRoot,
          run: ({ context, database }) =>
            refreshProjectIndex({
              context,
              database,
              scopePath,
            }),
        })

        return {
          content: [
            {
              type: "text" as const,
              text: [
                `generation: ${output.generation}`,
                `changed_files: ${output.changedFiles}`,
                `reused_files: ${output.reusedFiles}`,
                `removed_files: ${output.removedFiles}`,
                `indexed_files: ${output.indexedFiles}`,
              ].join("\n"),
            },
          ],
          structuredContent: output,
        }
      } catch (error) {
        return asToolError(error)
      }
    },
  )

  server.registerTool(
    "get_index_status",
    {
      title: "Get Index Status",
      description:
        "Return the current lazy index status for the selected project root.",
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
      },
      inputSchema: z.object({
        projectRoot: z.string().optional(),
      }),
      outputSchema: z.object({
        indexGeneration: z.number().int().min(0),
        status: z.string(),
        lastIndexStartedAt: z.string().optional(),
        lastIndexCompletedAt: z.string().optional(),
        lastError: z.string().optional(),
        fileCount: z.number().int().min(0),
        symbolCount: z.number().int().min(0),
        referenceCount: z.number().int().min(0),
        dirtyCount: z.number().int().min(0),
      }),
    },
    async ({ projectRoot }) => {
      try {
        const context = await loadProjectContext({
          projectRoot,
          ensureRuntime: false,
        })
        const output = await getIndexStatusSummary({
          projectRoot: context.projectRoot,
          databasePath: context.paths.cacheDbPath,
        })

        return {
          content: [
            {
              type: "text" as const,
              text: [
                `generation: ${output.indexGeneration}`,
                `status: ${output.status}`,
                `files: ${output.fileCount}`,
                `symbols: ${output.symbolCount}`,
                `references: ${output.referenceCount}`,
                `dirty: ${output.dirtyCount}`,
              ].join("\n"),
            },
          ],
          structuredContent: output,
        }
      } catch (error) {
        return asToolError(error)
      }
    },
  )

  return server
}
