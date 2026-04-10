# Project Map

## Top Level

- `src/index.ts`: stdio MCP entrypoint.
- `src/mcp/`: MCP tool registration and request wiring.
- `src/project/`: project-root resolution, ignore policy, `.eye` layout.
- `src/indexing/`: discovery, change detection, parsing, symbol/reference extraction.
- `src/lang/`: semantic adapters and parser integrations.
- `src/query/`: structure, source, definition, reference, and status queries.
- `src/storage/`: SQLite schema, DB access, blob storage.
- `src/fallback/`: ripgrep and heuristic fallback paths.
- `src/scripts/`: doctor, knowledge sync, document validation.
- `tests/`: fixture-backed integration tests.
- `tests/fixtures/real/`: pinned git submodules for heavy real-repository validation.
- `.agents/knowledge/`: router-style durable project knowledge.
- `plans/`: active execution plans.

## Query Ownership

- Structure and source reads live in `src/query/structure.ts` and `src/query/source.ts`.
- Index-backed navigation lives in `src/query/definitions.ts` and `src/query/references.ts`.
- Index lifecycle starts in `src/indexing/indexer.ts`.
- MCP tool exposure lives in `src/mcp/server.ts`.

## Storage Ownership

- `.eye/cache.db`: SQLite state for files, symbols, references, dependencies, dirty queue, and project status.
- `.eye/blobs/`: content-addressed JSON payloads from indexing runs.
- `.eye/runtime.json`: machine-local runtime metadata.

## Tests

- `tests/structure-and-source.test.ts`: direct read paths.
- `tests/indexing-and-status.test.ts`: refresh lifecycle and symbol-id stability.
- `tests/ts-navigation.test.ts`: TS/JS semantic definitions and references.
- `tests/python-navigation.test.ts`: Python semantic definitions and references.
- `tests/mcp-server.e2e.ts`: stdio MCP runtime and tool-surface verification.
- `tests/mcp-server.real-fixtures.e2e.ts`: heavy stdio MCP validation against pinned real repositories.
