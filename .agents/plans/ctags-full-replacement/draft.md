# Draft: Replace semantic indexing with ctags

## What This Plan Changes

This plan replaces the current `tree-sitter + TS/Python semantic` indexing model with a `ctags`-first indexing model across the shipped MCP server.
The MCP tool surface stays centered on the existing five tools, but the internals, ranking rules, persistence model, tests, and docs are rewritten around the assumption that no LSP-style semantic backend remains.
The plan treats this as a product-level behavior change, not a parser swap, because current `query_symbol` quality, `symbolId` stability, and strategy semantics are all tied to the existing semantic/index split.

## What Will Change

### 1. `query_symbol` no longer has true semantic resolution
- `Now`: `query_symbol` resolves `definition` and `references` through `semantic -> index -> fallback`, and TS/Python anchor lookups are expected to return `semantic` strategy results.
- `After`: `query_symbol` resolves through a `ctags`-backed persisted index plus fallback search, with no LSP-backed semantic layer remaining.
- `Why this change`: The requested direction is a full replacement, not a hybrid system.
- `Impact`: Anchor-based navigation quality and some definition/reference precision will drop, and current semantic-heavy tests and docs must be rewritten around index-first behavior.

### 2. The persisted index source changes from tree-sitter records to ctags records
- `Now`: indexing normalizes `tree-sitter` extraction output into `.eye/cache.db` and `.eye/blobs`, and storage/query ranking explicitly treats `tree-sitter` as the main indexed source.
- `After`: indexing normalizes `ctags` output into the same runtime surfaces, with schema, source taxonomy, and ranking rules updated to remove `tree-sitter` as the persisted truth.
- `Why this change`: A full ctags replacement cannot stop at the parser layer because storage, lookup ordering, and cache semantics currently encode `tree-sitter`.
- `Impact`: `src/indexing`, `src/storage`, `src/query`, `.agents/knowledge`, and migration behavior all become part of the change surface.

### 3. `symbolId` and index behavior remain product-critical even after semantic removal
- `Now`: semantic results are mapped back to indexed symbol rows so the agent can reuse stable `symbolId` values across later calls.
- `After`: `symbolId` must be generated from ctags-backed indexed rows alone, and unchanged reindex stability must remain an explicit invariant unless the plan deliberately resets that contract.
- `Why this change`: The server is still meant to be better than broad text search, and stable follow-up navigation is a core part of that value.
- `Impact`: The plan must preserve or explicitly redefine `symbolId` rules, cache migration handling, and index lifecycle tests before implementation starts.

### 4. The public MCP surface stays small, but user-visible behavior shifts
- `Now`: the server documentation and tests present five tools with `query_symbol` as the main navigation contract, and the tool output contract still allows `semantic | index | fallback`.
- `After`: the same five-tool surface remains, but `query_symbol` behavior, docs, and validation are rewritten to describe a ctags-first server where `semantic` results no longer exist as a live path.
- `Why this change`: The request is to replace the engine while preserving the efficient MCP surface as much as possible.
- `Impact`: MCP tool names and general flow remain familiar, but README, server instructions, E2E expectations, and possibly output taxonomy need coordinated updates.

## Included Scope

- remove TS/JS and Python semantic navigation backends from the shipped indexing/query path
- replace `tree-sitter`-centered persisted index extraction with `ctags`-centered extraction
- redefine storage schema, source taxonomy, ranking, and cache behavior for the new index source
- keep the five shipped MCP tools as the public surface unless the final plan calls out a forced exception
- rewrite tests, docs, and knowledge files to match the new ctags-first behavior
- define verification gates for ctags toolchain readiness, index lifecycle, MCP E2E behavior, and real-fixture coverage

## Excluded Scope

- adding new language backends
- keeping any LSP-backed semantic path alive as a fallback
- multi-root support
- watch mode
- unrelated tool-surface expansion beyond the current five MCP tools

## What We Know

- The shipped server is currently positioned as a bounded code-navigation MCP server for large local repos, not a generic grep wrapper. `query_symbol` and `symbolId` reuse are central to that value.
- The current public MCP surface is fixed around five tools: `get_project_structure`, `read_source_range`, `query_symbol`, `refresh_index`, and `get_index_status`.
- Current query behavior is documented and implemented as `semantic -> index -> fallback`, and the TS/Python semantic backends are verified in unit tests and MCP E2E tests.
- Current persisted index records are built from `tree-sitter` extraction, and storage types, DB ordering, and docs all assume `tree-sitter` is the primary indexed source.
- `ctags` is not part of the shipped runtime today. Historical plans mention it only as optional later enrichment.
- There is no existing planning bundle or partial implementation for a ctags-first rewrite. This bundle is effectively a new replacement-direction plan.
- The repository already has strong invariants around read-only tool behavior, lazy `.eye` creation, `symbolId` stability across unchanged reindex runs, and stdio MCP E2E coverage.
- The repository verification surface is layered: `doctor`, `lint`, `typecheck`, `test`, `test:e2e`, `test:coverage`, `build`, plus separate `test:fixtures:real`. Real-fixture checks are not part of the default local fast path.
- `doctor` does not currently validate any ctags binary, version, or setup requirement.
- The user has now fixed the direction: remove LSP-style behavior entirely and perform a full ctags replacement.

## Open Questions

- None

## Human Review Comments

- None yet.

## Planner Notes

- This direction is intentionally more disruptive than a hybrid plan.
- The final bundle must treat semantic removal as a user-visible contract change and spell out the exact consequences in tests, docs, and cache semantics.
