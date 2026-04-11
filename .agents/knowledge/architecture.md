# Architecture

## Top-Down Flow

1. `src/index.ts` boots the stdio MCP server.
2. `createEyeServer` in `src/mcp/server.ts` registers five tools:
   - `get_project_structure`
   - `read_source_range`
   - `query_symbol`
   - `refresh_index`
   - `get_index_status`
3. Project root resolution uses an explicit `projectRoot` when provided, otherwise walks upward from server `cwd` and prefers `.eye/config.json`, workspace markers, then project markers.
4. Read-only structure/source paths resolve project context without forcing `.eye` runtime creation.
5. `loadProjectContext` loads `.eye/config.json` when present and infers `sourceRoots` when it is missing.
6. Index-backed tools may write `.eye/config.json` on first runtime init so the inferred `sourceRoots` become user-editable.
7. Index-backed tools go through `withDatabase`, which:
   - resolves the project root
   - ensures `.eye/` runtime layout exists
   - opens `EyeDatabase`
8. `query_symbol` calls `refreshProjectIndex` lazily before answering.
9. `query_symbol` then branches by action:
   - `definition`: semantic lookup -> indexed rows -> heuristic fallback
   - `references`: semantic lookup -> indexed rows -> ripgrep fallback
   - `context`: resolve definitions first, keep the full `matches` list, then attach one bounded `context` block for the best definition
10. `get_index_status` stays on a read-only status path:
   - resolves the project root without forcing `.eye/`
   - opens the DB only if `cache.db` already exists
   - returns an idle zero-value summary when no cache exists yet
11. The real MCP runtime path is enforced by both `tests/mcp-server.e2e.ts` and `tests/mcp-server.real-fixtures.e2e.ts`, which speak stdio MCP over newline-delimited JSON.

## Direct Read Path

- `get_project_structure` walks the filesystem with bounded depth and entry count.
- `read_source_range` resolves a file under the project root, rejects binary data, and returns a clamped line window.
- `get_index_status` shares the same read-only posture and never creates runtime layout just to answer status.
- Root auto-detection can serve read-only tools without requiring a pre-existing `.eye/` directory.

## Index-Backed Path

- `refresh_index` explicitly refreshes the project-local `.eye` cache for the whole root or a narrowed `scopePath`.
- Index discovery is limited to `config.sourceRoots`, while read-only tools still see the whole resolved project root.
- `query_symbol` also refreshes lazily.

## Semantic Adapters

- TS/JS: `src/lang/ts/service.ts` builds a TypeScript language service keyed by index generation.
- Python: `src/lang/python/pyright-client.ts` keeps a Pyright stdio client keyed by index generation.
- Tree-sitter: `src/indexing/parser.ts` and `src/lang/tree-sitter/` provide structural extraction for indexed symbols, references, and dependencies.

## Fallback Path

- `src/fallback/ripgrep.ts` handles source discovery and low-confidence text search when semantic/index hits are not enough.
