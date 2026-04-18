# eye Agent Router

## Project Overview

`eye` is a source-browsing MCP server for coding agents that need bounded reads, lazy project-local indexing, and symbol-aware navigation inside large local repositories.

## Tech Stacks

- TypeScript ESM on Node.js 20+.
- Corepack-managed pnpm with Biome, Vitest, Lefthook, and GitHub Actions.
- `.eye/` uses SQLite plus JSON blobs; navigation uses tree-sitter, the TypeScript language service, and Pyright.

## Non-Negotiables

- `get_project_structure`, `read_source_range`, and `get_index_status` stay read-only. They must resolve the project root without forcing `.eye/` runtime creation.
- `query_symbol` and `refresh_index` own lazy `.eye/` initialization and must respect `.eye/config.json` `sourceRoots` and ignore rules.
- Keep evergreen repository facts in [`.agents/knowledge/README.md`](.agents/knowledge/README.md). Keep transient execution plans in [`plans/ACTIVE.md`](plans/ACTIVE.md) and the `plans/` directory.

## Verification Commands

- `pnpm run doctor` after runtime boot, toolchain assumptions, `ripgrep`, or project-root detection changes.
- `pnpm run lint && pnpm run typecheck && pnpm run test` after edits in indexing, query, storage, project resolution, fallback search, or shared utilities.
- `pnpm run test:e2e` after MCP tool schema, server wiring, or end-to-end navigation behavior changes.
- `pnpm run test:fixtures:real` after semantic adapter or real-repository navigation behavior changes.
- `pnpm run validate && pnpm run build` before broad handoff or release-facing changes.

## Knowledge Router

Read before non-trivial changes:

- [Knowledge index](.agents/knowledge/README.md)
- [Project map](.agents/knowledge/project-map.md)
- [Architecture](.agents/knowledge/architecture.md)
- [Indexing, cache, query](.agents/knowledge/business-logic/indexing-cache-query.md)
- [Validation and hooks](.agents/knowledge/operations/validation-and-hooks.md)
- [ExecPlan format](PLANS.md)
- [Active plans](plans/ACTIVE.md)

Update when relevant:

- traversal, indexing, storage, semantic lookup, fallback search, or MCP tool behavior: [`.agents/knowledge/business-logic/indexing-cache-query.md`](.agents/knowledge/business-logic/indexing-cache-query.md)
- repository layout, tool ownership, or dogfooding entrypoints: [`.agents/knowledge/project-map.md`](.agents/knowledge/project-map.md)
- validation, hooks, CI, or package-manager flow: [`.agents/knowledge/operations/validation-and-hooks.md`](.agents/knowledge/operations/validation-and-hooks.md)
