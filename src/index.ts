#!/usr/bin/env node

import { McpServer, StdioServerTransport } from "@modelcontextprotocol/server"
import * as z from "zod/v4"

import { resolveProjectRoot } from "./config.js"
import {
  findSymbolDefinitions,
  formatDefinitionSearch,
  type DefinitionMatch,
} from "./definitions.js"
import { searchReferences, formatReferenceSearch } from "./references.js"
import type { SearchMatch } from "./ripgrep.js"
import { readSourceRange, formatSourceRange, type SourceLine } from "./source.js"
import { getProjectStructure, formatProjectStructure, type TreeEntry } from "./structure.js"

const serverVersion = "0.1.0"

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

const searchMatchSchema = z.object({
  path: z.string(),
  line: z.number().int().nonnegative(),
  column: z.number().int().positive(),
  text: z.string(),
})

const definitionMatchSchema = searchMatchSchema.extend({
  provider: z.enum(["tags-file", "ripgrep-heuristic"]),
  confidence: z.enum(["high", "medium"]),
  kind: z.string().optional(),
})

const sourceLineSchema = z.object({
  number: z.number().int().positive(),
  text: z.string(),
})

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
      "Use bounded repository reads. Prefer scopePath for narrow searches. Definitions are stronger with a local tags file, otherwise the server uses ripgrep heuristics.",
  },
)

server.registerTool(
  "get_project_structure",
  {
    title: "Get Project Structure",
    description: "Return a bounded directory tree for a source repository.",
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
    inputSchema: z.object({
      projectRoot: z.string().optional(),
      depth: z.number().int().min(0).max(8).optional(),
      maxEntries: z.number().int().min(1).max(1000).optional(),
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
      const resolvedRoot = await resolveProjectRoot({ projectRoot })
      const output = await getProjectStructure({
        projectRoot: resolvedRoot,
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
    description: "Read a file around a requested line and return numbered lines.",
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
      const resolvedRoot = await resolveProjectRoot({ projectRoot })
      const output = await readSourceRange({
        projectRoot: resolvedRoot,
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
      "Find likely symbol definition locations. Uses a local tags file when available and ripgrep heuristics otherwise.",
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
    inputSchema: z.object({
      projectRoot: z.string().optional(),
      symbol: z.string().min(1),
      scopePath: z.string().optional(),
      maxResults: z.number().int().min(1).max(100).optional(),
    }),
    outputSchema: z.object({
      projectRoot: z.string(),
      symbol: z.string(),
      provider: z.enum(["tags-file", "ripgrep-heuristic"]),
      truncated: z.boolean(),
      matches: z.array(definitionMatchSchema),
    }),
  },
  async ({ projectRoot, symbol, scopePath, maxResults }) => {
    try {
      const resolvedRoot = await resolveProjectRoot({ projectRoot })
      const output = await findSymbolDefinitions({
        projectRoot: resolvedRoot,
        symbol,
        scopePath,
        maxResults: maxResults ?? 20,
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
  "search_references",
  {
    title: "Search References",
    description:
      "Search for literal or regex references with ripgrep, optionally narrowed to a file or subdirectory.",
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
    inputSchema: z.object({
      projectRoot: z.string().optional(),
      query: z.string().min(1),
      scopePath: z.string().optional(),
      mode: z.enum(["literal", "regex"]).optional(),
      wordMatch: z.boolean().optional(),
      caseSensitive: z.boolean().optional(),
      maxResults: z.number().int().min(1).max(500).optional(),
    }),
    outputSchema: z.object({
      projectRoot: z.string(),
      query: z.string(),
      mode: z.enum(["literal", "regex"]),
      wordMatch: z.boolean(),
      truncated: z.boolean(),
      matches: z.array(searchMatchSchema),
    }),
  },
  async ({ projectRoot, query, scopePath, mode, wordMatch, caseSensitive, maxResults }) => {
    try {
      const resolvedRoot = await resolveProjectRoot({ projectRoot })
      const output = await searchReferences({
        projectRoot: resolvedRoot,
        query,
        scopePath,
        mode: mode ?? "literal",
        wordMatch: wordMatch ?? true,
        caseSensitive: caseSensitive ?? false,
        maxResults: maxResults ?? 50,
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

const main = async () => {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error(`eye MCP server running on stdio (${serverVersion})`)
}

main().catch((error) => {
  console.error("Fatal error in eye MCP server:", error)
  process.exit(1)
})
