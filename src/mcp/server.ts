import { McpServer } from "@modelcontextprotocol/server"
import * as z from "zod/v4"

import { refreshProjectIndex } from "../indexing/indexer.js"
import { loadProjectContext } from "../project/context.js"
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
import {
  formatSymbolQuery,
  querySymbol,
  type SymbolQueryContext,
  type SymbolQueryMatch,
  type SymbolQueryTarget,
} from "../query/symbol.js"
import { EyeDatabase } from "../storage/database.js"

const serverVersion = "0.3.0"

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

const symbolQueryMatchSchema: z.ZodType<SymbolQueryMatch> = z.object({
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
  context: z.string().optional(),
  confidence: z.enum(["exact", "high", "medium", "low"]),
  source: z.enum(["index", "fallback"]),
})

const symbolQueryContextSchema: z.ZodType<SymbolQueryContext> = z.object({
  bodyAvailable: z.boolean(),
  bodyStartLine: z.number().int().positive().optional(),
  bodyEndLine: z.number().int().positive().optional(),
  snippetStartLine: z.number().int().min(0),
  snippetEndLine: z.number().int().min(0),
  totalLines: z.number().int().min(0),
  clamped: z.boolean(),
  signatureLine: sourceLineSchema.optional(),
  lines: z.array(sourceLineSchema),
})

const symbolQueryTargetSchema: z.ZodType<SymbolQueryTarget> =
  z.discriminatedUnion("by", [
    z.object({
      by: z.literal("anchor"),
      filePath: z.string(),
      line: z.number().int().min(1),
      column: z.number().int().min(1),
    }),
    z.object({
      by: z.literal("symbolId"),
      symbolId: z.string().min(1),
    }),
    z.object({
      by: z.literal("symbol"),
      symbol: z.string().min(1),
    }),
  ])

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
        "Use bounded repository reads. Resolve a symbol once, then reuse symbolId with query_symbol for exact navigation. The server maintains a lazy project-local .eye cache for index-backed and fallback queries.",
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
    "query_symbol",
    {
      title: "Query Symbol",
      description:
        "Resolve symbol definitions, references, or definition context using lazy indexing and fallback search.",
      inputSchema: z.object({
        projectRoot: z.string().optional(),
        target: symbolQueryTargetSchema,
        action: z.enum(["definition", "references", "context"]),
        scopePath: z.string().optional(),
        maxResults: z.number().int().min(1).max(200).optional(),
        includeDeclaration: z.boolean().optional(),
        includeBody: z.boolean().optional(),
        before: z.number().int().min(0).max(400).optional(),
        after: z.number().int().min(0).max(400).optional(),
        maxLines: z.number().int().min(1).max(400).optional(),
      }),
      outputSchema: z.object({
        projectRoot: z.string(),
        action: z.enum(["definition", "references", "context"]),
        strategy: z.enum(["index", "fallback"]),
        indexedGeneration: z.number().int().min(0),
        truncated: z.boolean(),
        matches: z.array(symbolQueryMatchSchema),
        context: symbolQueryContextSchema.optional(),
      }),
    },
    async ({
      projectRoot,
      target,
      action,
      scopePath,
      maxResults,
      includeDeclaration,
      includeBody,
      before,
      after,
      maxLines,
    }) => {
      try {
        const output = await withDatabase({
          projectRoot,
          run: ({ context, database }) =>
            querySymbol({
              context,
              database,
              target,
              action,
              scopePath,
              maxResults: maxResults ?? (action === "references" ? 50 : 20),
              includeDeclaration,
              includeBody,
              before,
              after,
              maxLines,
            }),
        })

        return {
          content: [
            {
              type: "text" as const,
              text: formatSymbolQuery(output),
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
