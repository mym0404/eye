# Project Map

## Top Level

- `.mcp.json`: repo-local stdio MCP config for dogfooding `eye` from this checkout.
- `apps/docs/`: public Next.js + Fumadocs site exported for GitHub Pages-style hosting.
- `content/docs/`: public MDX source consumed by the docs app.
- `src/index.ts`: stdio bootstrap.
- `src/mcp/`: MCP tool registration, schemas, and formatted text output.
- `src/project/`: project-root detection, `sourceRoots` inference, ignore rules, and `.eye` path layout.
- `src/indexing/`: discovery, dirty detection, parse orchestration, token lookup, and symbol-id generation.
- `src/lang/`: legacy tree-sitter extraction and TS/Python semantic adapters kept outside the shipped query path.
- `src/query/`: structure/source reads, unified symbol query flow, and index status summaries.
- `src/storage/`: SQLite schema, DB helpers, and blob persistence.
- `src/fallback/`: ripgrep-backed search and heuristic definition fallback.
- `src/util/`: shared concurrency, hashing, path, and package-bin helpers.
- `src/scripts/`: maintenance commands such as `doctor`.
- `tests/`: fixture-backed unit, integration, and stdio MCP E2E coverage.
- `.github/workflows/`: CI and heavy real-fixture validation.
- `.agents/knowledge/`: evergreen repository knowledge.
- `plans/`: transient ExecPlans and active-plan routing.

## Tool Ownership

- `src/mcp/server.ts`: shipped five-tool MCP surface.
- `src/query/structure.ts` and `src/query/source.ts`: read-only filesystem responses.
- `src/query/symbol.ts`: `query_symbol` contract and `context` payload assembly.
- `src/query/definitions.ts` and `src/query/references.ts`: index-first plus fallback resolution strategy.
- `src/query/status.ts`: read-only `get_index_status` path when `cache.db` may not exist yet.
- `src/indexing/indexer.ts`: refresh lifecycle and dirty-file coordination.

## Runtime And Config Surface

- `.eye/config.json`: committed portable config; in this repo it seeds dogfooding with `src` and `tests`.
- `.eye/fixtures-manifest.json`: tracked fixture metadata for repository-owned real fixtures.
- `.eye/cache.db`, `.eye/blobs/`, `.eye/runtime.json`, `.eye/tmp/`, and `.eye/logs/`: local runtime state ignored by Git.
- `apps/docs/next.config.mjs`: static-export docs configuration, including optional GitHub Pages base-path support.
- `apps/docs/app/` and `apps/docs/components/`: public docs UI shell, layout, and client-side search dialog.
- `content/docs/`: public-only documentation content; internal agent knowledge stays under `.agents/knowledge/` and `plans/`.
- `lefthook.yml`: local `pre-commit` and `pre-push` gates.

## Tests

- `tests/structure-and-source.test.ts`: read-only tool paths and runtime-free behavior.
- `tests/project-context.test.ts`: root auto-detection, config bootstrap, and `sourceRoots` inference.
- `tests/indexing-and-status.test.ts`: incremental refresh, status summaries, and `symbol_id` stability.
- `tests/ts-navigation.test.ts` and `tests/python-navigation.test.ts`: language-specific index-first navigation.
- `tests/mcp-server.e2e.ts`: stdio MCP surface, lazy runtime creation, scoped queries, and persisted cache behavior.
- `tests/mcp-server.real-fixtures.e2e.ts`: pinned real-repository coverage for structure, source, status, and selected index-first symbol flows.
