# Indexing, Cache, Query

## Tool to Flow Mapping

- `get_project_structure`: filesystem walk only, no `EyeDatabase`, no forced `.eye` runtime.
- `read_source_range`: direct file read only, no index.
- `find_symbol_definitions`: `withDatabase` -> `refreshProjectIndex` -> semantic lookup -> indexed lookup -> fallback candidates.
- `find_references`: `withDatabase` -> `refreshProjectIndex` -> semantic lookup -> indexed lookup -> `searchWithRipgrep`.
- `refresh_index`: `withDatabase` -> `refreshProjectIndex`.
- `get_index_status`: `withDatabase` -> `EyeDatabase.getIndexStatus()`.

## Indexing Flow

`refreshProjectIndex` is the entry point.

1. Load tracked files from `EyeDatabase`.
2. Discover current candidate files with ripgrep `--files`.
3. Filter by supported source extensions and configured ignore rules.
4. Compare current `size` and `mtimeMs` against tracked file rows.
5. Split files into changed, reused, and removed sets.
6. For changed files:
   - read file text
   - call `indexFileContent`
   - parse with tree-sitter when a grammar exists
   - fall back to text-only empty records when parsing is unavailable or fails
7. Hash `blobPayload` and persist it through `EyeBlobStore`.
8. Commit files, symbols, references, dependencies, and project status through `EyeDatabase.commitIndexRun`.

## Cache Layout

### Filesystem

- `.eye/config.json`: portable ignore/index config.
- `.eye/runtime.json`: local runtime metadata.
- `.eye/cache.db`: SQLite cache.
- `.eye/blobs/<hash>.json`: content-addressed index payload.
- `.eye/tmp/`, `.eye/logs/`: local runtime support directories.

### SQLite Tables

- `projects`: per-root generation and last run status.
- `files`: tracked files, hashes, parse source, counts, generations.
- `symbols`: indexed symbol rows with stable `symbol_id`.
- `references_idx`: indexed reference rows.
- `dependencies`: extracted dependency edges.
- `dirty_files`: queued paths for changed/removed files.
- `schema_meta`: schema version.

## Parse Sources

- `tree-sitter`: preferred structural index source.
- `fallback-text`: used when no grammar exists or parsing fails.

## Query Strategy

### Definitions

- Anchor-based TS/JS lookups call the TypeScript language service.
- Anchor-based Python lookups call Pyright.
- When semantic lookup fails or the user provides a plain symbol, query `symbols` by name.
- When confidence is still low, use heuristic candidates.

### References

- Anchor or `symbolId` lookups prefer semantic references from TS/JS or Python backends.
- Indexed references come from `references_idx`.
- Remaining budget is filled by ripgrep text matches.

## Stable Identity

- `symbol_id` is the canonical internal identity for indexed navigation.
- Stability across unchanged reindex runs is an explicit repository invariant and is covered by tests.

## Files to Update When Logic Changes

- `src/indexing/indexer.ts`
- `src/indexing/parser.ts`
- `src/query/definitions.ts`
- `src/query/references.ts`
- `src/storage/schema.ts`
- `src/storage/database.ts`
- `src/storage/blob-store.ts`
