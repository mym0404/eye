# Architecture

## Top-Down Flow

1. `src/index.ts` boots the stdio MCP server.
2. `createEyeServer` in `src/mcp/server.ts` registers six tools:
   - `get_project_structure`
   - `read_source_range`
   - `find_symbol_definitions`
   - `find_references`
   - `refresh_index`
   - `get_index_status`
3. Read-only structure/source paths resolve project context without forcing `.eye` runtime creation.
4. Index-backed tools go through `withDatabase`, which:
   - resolves the project root
   - ensures `.eye/` runtime layout exists
   - opens `EyeDatabase`
5. Definition/reference queries call `refreshProjectIndex` lazily before answering.
6. Query resolution then prefers semantic backends, then indexed rows, then ripgrep fallback.
7. The real MCP runtime path is enforced by `tests/mcp-server.e2e.ts`, which speaks stdio MCP over newline-delimited JSON.

## Direct Read Path

- `get_project_structure` walks the filesystem with bounded depth and entry count.
- `read_source_range` resolves a file under the project root, rejects binary data, and returns a clamped line window.

## Index-Backed Path

- `refresh_index` explicitly refreshes the project-local `.eye` cache.
- `find_symbol_definitions` and `find_references` also refresh lazily.
- `get_index_status` reads the current DB-backed status summary.

## Semantic Adapters

- TS/JS: `src/lang/ts/service.ts` builds a TypeScript language service keyed by index generation.
- Python: `src/lang/python/pyright-client.ts` keeps a Pyright stdio client keyed by index generation.
- Tree-sitter: `src/indexing/parser.ts` and `src/lang/tree-sitter/` provide structural extraction for indexed symbols, references, and dependencies.

## Fallback Path

- `src/fallback/ripgrep.ts` handles source discovery and low-confidence text search when semantic/index hits are not enough.
