# Indexing, Cache, Query

## Tool to Flow Mapping

- `get_project_structure`: filesystem walk only, no `EyeDatabase`, no forced `.eye` runtime.
- `read_source_range`: direct file read only, no index.
- `query_symbol`:
  - `action: definition` -> `withDatabase` -> `refreshProjectIndex` -> semantic lookup -> indexed lookup -> fallback candidates.
  - `action: references` -> `withDatabase` -> `refreshProjectIndex` -> semantic lookup -> indexed lookup -> `searchWithRipgrep`.
  - `action: context` -> `withDatabase` -> `refreshProjectIndex` -> resolve definitions -> bounded source read around the best definition.
- `refresh_index`: `withDatabase` -> `refreshProjectIndex`.
- `get_index_status`: `loadProjectContext({ ensureRuntime: false })` -> `EyeDatabase.openExistingReadOnly()` -> current status or an idle zero-value summary when no cache exists yet.
- Project root selection: explicit `projectRoot` -> nearest `.eye/config.json` -> nearest workspace marker -> nearest project marker -> server `cwd`.

## Indexing Flow

`refreshProjectIndex` is the entry point.

1. Load tracked files from `EyeDatabase`.
2. Resolve the active search roots from `config.sourceRoots` and optional `scopePath`.
3. Discover current candidate files with ripgrep `--files` under those search roots.
4. Filter by supported source extensions and configured ignore rules.
5. Compare current `size` and `mtimeMs` against tracked file rows.
6. Split files into changed, reused, and removed sets.
7. For changed files:
   - read file text
   - call `indexFileContent`
   - parse with tree-sitter when a grammar exists
   - fall back to text-only empty records when parsing is unavailable or fails
8. Hash `blobPayload` and persist it through `EyeBlobStore`.
9. Commit files, symbols, references, dependencies, and project status through `EyeDatabase.commitIndexRun`.

## Cache Layout

### Filesystem

- `.eye/config.json`: portable `sourceRoots`, ignore, and indexing config.
- `.eye/fixtures-manifest.json`: committed only for repository-owned fixture projects.
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

## Config Behavior

- `sourceRoots` is a sorted relative-path list that limits indexing and ripgrep-backed fallback discovery.
- Missing `sourceRoots` are inferred on load from common source layouts such as `src`, `app`, and `packages/*/src`.
- First runtime init writes the inferred `sourceRoots` back to `.eye/config.json` so users can edit them later.
- `get_project_structure` and `read_source_range` still operate over the whole project root instead of `sourceRoots`.

## Parse Sources

- `tree-sitter`: preferred structural index source.
- `fallback-text`: used when no grammar exists or parsing fails.

## Query Strategy

### Unified Symbol Query

- `query_symbol` accepts three target forms:
  - `anchor`
  - `symbolId`
  - plain `symbol`
- `anchor` is a source location the agent is currently looking at, not necessarily a definition location.
- `symbolId` is the preferred exact follow-up target after the first successful resolve.

### Definition Action

- Anchor-based TS/JS lookups call the TypeScript language service.
- Anchor-based Python lookups call Pyright.
- When semantic lookup fails or the user provides a plain symbol, query `symbols` by name.
- When confidence is still low, use heuristic candidates.

### References Action

- Anchor or `symbolId` lookups prefer semantic references from TS/JS or Python backends.
- Indexed references come from `references_idx`.
- Remaining budget is filled by ripgrep text matches limited to the active `sourceRoots` and `scopePath`.

### Context Action

- `context` first resolves definition candidates with the same logic as `definition`.
- The best candidate becomes the canonical context location.
- The response still returns the full `matches` list, then adds one bounded numbered snippet, signature line when available, and body range metadata for the best match.
- Fallback-only context stays honest: it may return a definition match with no body range.

## Stable Identity

- `symbol_id` is the canonical internal identity for indexed navigation.
- Stability across unchanged reindex runs is an explicit repository invariant and is covered by tests.

## Files to Update When Logic Changes

- `src/indexing/indexer.ts`
- `src/indexing/parser.ts`
- `src/project/context.ts`
- `src/project/root.ts`
- `src/project/source-roots.ts`
- `src/query/symbol.ts`
- `src/query/definitions.ts`
- `src/query/references.ts`
- `src/storage/schema.ts`
- `src/storage/database.ts`
- `src/storage/blob-store.ts`
