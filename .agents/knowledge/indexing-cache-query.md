# Indexing, Cache, Query

## Core Contracts

- `get_project_structure`, `read_source_range`, and `get_index_status` must not create `.eye/` runtime state.
- `query_symbol` and `refresh_index` may initialize `.eye/` lazily; semantic definitions may map locations back onto indexed symbols, while semantic reference matches do not infer nearest-symbol metadata and only carry the requested `symbolId` and indexed symbol name when a `symbolId` target resolved successfully. Index data still powers fallback and exact follow-up targeting.
- `query_symbol` accepts MCP-boundary symbol-name shorthands and normalizes them before query logic runs.
- `scopePath` only narrows within configured `sourceRoots`; it never widens indexing or fallback search outside them.

## Tool To Flow Mapping

- `get_project_structure`: filesystem walk only, no `EyeDatabase`, no forced `.eye/`.
- `read_source_range`: direct file read only, no index.
- `refresh_index`: `withDatabase` -> `refreshProjectIndex`.
- `get_index_status`: `loadProjectContext({ ensureRuntime: false })` -> `EyeDatabase.openExistingReadOnly()` -> current status or an idle zero-value summary.
- `query_symbol`:
  - `action: definition` -> refresh -> semantic lookup for anchor targets -> indexed lookup -> heuristic fallback definitions.
  - `action: references` -> refresh -> semantic lookup for anchor and `symbolId` targets -> indexed lookup -> ripgrep fallback.
  - `action: context` -> refresh -> definition resolution -> one bounded source snippet around the best definition.

## Indexing Flow

`refreshProjectIndex` is the entry point.

1. Load tracked files from `EyeDatabase`.
2. Resolve active search roots from `config.sourceRoots` and optional `scopePath`.
3. Discover current candidate files with ripgrep `--files`.
4. Filter by supported source extensions and configured ignore rules.
5. Compare current `size` and `mtimeMs` against tracked file rows.
6. Split files into changed, reused, and removed sets.
7. For changed files, read text and call `indexFileContent`.
8. Parse with Universal Ctags JSON output when possible; otherwise persist `fallback-text` records.
9. Hash the blob payload and persist it through `EyeBlobStore`.
10. Commit files, symbols, references, dependencies, and project status through `EyeDatabase.commitIndexRun`.

## Search Root And Config Behavior

- `sourceRoots` is a sorted relative-path list stored in `.eye/config.json`.
- Missing `sourceRoots` are inferred from common layouts such as `src`, `app`, and `packages/*/src`.
- First runtime init writes inferred `sourceRoots` back to `.eye/config.json` so the config becomes user-editable.
- If a configured source root is `.`, any nested `scopePath` can be searched.
- Otherwise `scopePath` must overlap a configured source root to produce active search roots.
- Read-only structure and source tools still operate over the whole resolved project root instead of `sourceRoots`; `get_project_structure` only uses `sourceRoots` to order source directories before siblings.

## Cache Layout

### Filesystem

- `.eye/config.json`: portable `sourceRoots`, ignore, and indexing config.
- `.eye/.gitignore`: generated runtime ignore file that exposes `config.json` and hides local cache state.
- `.eye/fixtures-manifest.json`: committed only for repository-owned fixture projects.
- `.eye/runtime.json`: machine-local runtime metadata.
- `.eye/cache.db`: SQLite cache.
- `.eye/blobs/<hash>.json`: content-addressed index payload.
- `.eye/tmp/`, `.eye/logs/`: local runtime support directories.
- When `schema_meta.version` changes, the writable open path invalidates the existing cache instead of migrating it in place; the next index-backed refresh rebuilds both DB rows and blob payloads.

### SQLite Tables

- `projects`: per-root generation and last-run status.
- `files`: tracked files, hashes, parse source, counts, and generations.
- `symbols`: indexed symbol rows with stable `symbol_id`.
- `references_idx`: indexed reference rows.
- `dependencies`: extracted dependency edges.
- `dirty_files`: queued changed or removed paths.
- `schema_meta`: schema version.

## Parse Sources

- `ctags`: preferred persisted index source.
- `fallback-text`: used when ctags extraction fails or the file is unsupported.

## Query Strategy Details

### Unified Symbol Query

- `target.by = "anchor"` starts from the source location the agent is already reading.
- `target.by = "symbolId"` is the preferred exact follow-up target after a successful first resolve.
- `target.by = "symbol"` is the lowest-confidence entry path and relies more heavily on indexed and fallback matching.
- `target: "Name"`, `{ name: "Name" }`, and `{ by: "name", name: "Name" }` are accepted as MCP input shorthands for `{ by: "symbol", symbol: "Name" }`.

### Definition

- Anchor lookups try semantic resolution first for TypeScript/JavaScript and Python.
- Semantic locations are matched back onto indexed symbols through `findNearestSymbol` when possible so `symbolId` stays usable.
- Plain-symbol and `symbolId` lookups stay on indexed symbol rows.
- Remaining low-confidence coverage comes from heuristic fallback definitions.

### References

- Anchor lookups try semantic resolution first for TypeScript/JavaScript and Python.
- `symbolId` lookups resolve the indexed definition row once to obtain the semantic anchor location; if semantic references return no matches or throw, the query falls back to indexed references by symbol name and then to ripgrep. It does not retry semantic resolution from indexed reference locations.
- Indexed references come from `references_idx`, fallback candidates come from ripgrep text search, semantic reference candidates only echo the requested `symbolId` and indexed symbol name when available, and the merged candidate list is deduped by `filePath:line:column` before truncation.
- Remaining budget uses ripgrep with `fixedStrings: true`, `wordMatch: true`, configured ignore globs, and search roots resolved from `sourceRoots` plus `scopePath`.

### Context

- `context` reuses the same definition resolution path as `definition`.
- The best definition candidate becomes the canonical context location.
- The response still returns the full `matches` list and then adds one bounded snippet from `read_source_range`.
- When `includeBody` is true and the best match has `endLine`, the snippet window expands to cover the full definition body within `maxLines`.
- Fallback-only context stays honest: it may return a definition match with no body range.

## Stable Identity

- `symbol_id` is the canonical internal identity for indexed navigation.
- Stability across unchanged reindex runs is an explicit repository invariant covered by `tests/indexing-and-status.test.ts`.

## Files To Revisit When Logic Changes

- `src/project/context.ts`
- `src/project/root.ts`
- `src/project/source-roots.ts`
- `src/project/ignore.ts`
- `src/indexing/indexer.ts`
- `src/indexing/parser.ts`
- `src/query/symbol.ts`
- `src/query/definitions.ts`
- `src/query/references.ts`
- `src/query/status.ts`
- `src/storage/schema.ts`
- `src/storage/database.ts`
- `src/storage/blob-store.ts`
