# eye

[![codecov](https://codecov.io/gh/mym0404/eye/branch/main/graph/badge.svg)](https://codecov.io/gh/mym0404/eye)

`eye` is a TypeScript MCP server for source-code browsing in large local repositories. It combines direct filesystem reads with a lazy `.eye/` cache so simple reads stay cheap and semantic navigation is available when a query needs it.

## Tools

| Tool | Current behavior |
| --- | --- |
| `get_project_structure` | Returns a bounded tree and skips generated paths such as `build`, `dist`, `out`, `.eye`, and similar defaults. |
| `read_source_range` | Reads a file around a requested line with numbered output. |
| `find_symbol_definitions` | Uses lazy indexing, then prefers semantic resolution for TS/JS and Python, then falls back to indexed or ripgrep-backed candidates. |
| `find_references` | Uses semantic references when possible, then supplements with indexed and ripgrep matches. |
| `refresh_index` | Refreshes the `.eye` cache for the whole root or a narrowed scope. |
| `get_index_status` | Reports generation, counts, and cache state. |

## Current Implementation

- Single project root only.
- Lazy `.eye/` initialization under the target repository.
- Persistent cache in `.eye/cache.db`.
- Content-addressed sidecar blobs in `.eye/blobs/`.
- Structural indexing with `web-tree-sitter` + wasm grammars.
- TS/JS semantic navigation through the TypeScript language service.
- Python semantic navigation through `pyright-langserver`.
- `ripgrep` for file discovery and fallback search.

## `.eye/` Layout

```text
.eye/
  config.json
  runtime.json
  cache.db
  blobs/
  tmp/
  logs/
```

- `config.json`: portable ignore and indexing settings.
- `runtime.json`: machine-local metadata written by the server.
- `cache.db` and `blobs/`: generated cache state, ignored from git.

## Requirements

- Node.js 20+
- `rg` on `PATH`

`npm run doctor` verifies:

- Node runtime
- `rg`
- `pyright-langserver`
- `better-sqlite3`
- cache schema version

## Setup

```bash
npm install
npm run doctor
npm run lint
npm run typecheck
npm run test
npm run build
```

Full acceptance gate:

```bash
npm run validate
```

## Running

```bash
node dist/index.js
```

Example MCP client configuration:

```json
{
  "command": "node",
  "args": ["/absolute/path/to/eye/dist/index.js"],
  "env": {
    "EYE_ALLOWED_ROOTS": "/absolute/path/to/repos"
  }
}
```

## Validation Policy

Unchecked results are not acceptable in this repository. Before claiming work is done, the expected local gates are:

- `npm run doctor`
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run test:coverage`

Vitest coverage thresholds are enforced locally, and GitHub Actions uploads `coverage/lcov.info` to Codecov after coverage generation succeeds.

## Tests and Fixtures

- Vitest covers structure reads, source reads, indexing, symbol-id stability, TS navigation, and Python navigation.
- Four committed fixtures support CI-speed integration tests: `ts-app`, `js-app`, `python-app`, and `mixed-app`.
- The larger OSS-derived corpus described in `plans/complete-implementation.md` is still planned work; this repository does not currently claim large-corpus validation.

## Limitations

- Semantic coverage is currently limited to TS/JS and Python.
- Indexing is lazy and query-triggered; there is no watch mode or background daemon.
- Name-based lookups can still be ambiguous and may return multiple candidates.
- The structural index is tree-sitter based, but not yet a language-complete semantic graph.
- The committed fixtures are small integration corpora, not the final large OSS snapshots.
