# Architecture

## Tool Surface

- `src/index.ts` boots `createEyeServer`.
- `src/mcp/server.ts` registers five tools:
  - `get_project_structure`
  - `read_source_range`
  - `query_symbol`
  - `refresh_index`
  - `get_index_status`

## Runtime Boundaries

- Project root selection order is: explicit `projectRoot` -> nearest `.eye/config.json` -> nearest workspace marker -> nearest project marker -> server `cwd`.
- `loadProjectContext({ ensureRuntime: false })` resolves the root, config, and ignore matcher without creating `.eye/`.
- `withDatabase` uses `loadProjectContext({ ensureRuntime: true })`, then opens `EyeDatabase` for index-backed operations.
- First index-backed use can create `.eye/config.json` with inferred `sourceRoots` and always refreshes `.eye/runtime.json`.

## Read-Only Flow

- `get_project_structure` walks the resolved project root with bounded depth and entry count.
- `read_source_range` reads a clamped line window under the resolved root and rejects binary content.
- `get_index_status` stays read-only: it opens `cache.db` only when it already exists and otherwise returns an idle zero-value summary.
- Root auto-detection works for all three read-only paths without requiring a pre-existing `.eye/` directory.

## Index-Backed Flow

- `refresh_index` and `query_symbol` both go through `withDatabase`.
- `refreshProjectIndex` discovers candidate files only under `config.sourceRoots`, then filters by supported source extensions and ignore rules before writing DB rows and blob payloads.
- `scopePath` narrows work by intersecting the requested path with configured `sourceRoots`; it never widens search outside those roots.

## Query Strategy

- `query_symbol` accepts `target.by = "anchor" | "symbolId" | "symbol"`.
- `definition` resolves indexed candidates first, then heuristic fallback definitions.
- `references` resolves indexed rows first, then ripgrep fallback search.
- `context` reuses definition resolution, keeps the full `matches` list, and attaches one bounded snippet for the best definition candidate.
- The response strategy stays honest about the winning path: `index` or `fallback`.

## Indexing And Fallbacks

- `src/indexing/parser.ts`: Universal Ctags JSON extraction plus lightweight dependency heuristics during indexing.
- `src/lang/ts/service.ts` and `src/lang/python/pyright-client.ts`: legacy adapters no longer used in the shipped query path.
- `src/lang/tree-sitter/`: legacy extraction code no longer used in the shipped persisted index path.
- `src/fallback/ripgrep.ts`: file discovery and low-confidence text-search fallback.
