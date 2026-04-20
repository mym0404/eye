# Replace semantic indexing with ctags

## TL;DR

Replace the shipped `tree-sitter + TS/Python semantic` navigation stack with a `Universal Ctags`-first persisted index while keeping the MCP server centered on the existing five tools.
The work must preserve the bounded-read product shape, keep `symbolId` as the follow-up identity contract, and rewrite storage, query behavior, tests, docs, and runtime validation so the server is explicitly index-first rather than semantic-first.
The critical path is runtime/toolchain readiness -> ctags-backed persisted index -> index-first `query_symbol` rewrite -> MCP/E2E/real-fixture contract rewrite -> final validation.

## Context

- Original request: plan a full ctags replacement and remove LSP-style behavior entirely.
- Pre-interview exploration confirmed the current server is shipped as a five-tool MCP surface: `get_project_structure`, `read_source_range`, `query_symbol`, `refresh_index`, and `get_index_status`. The main product loop is still “resolve once, reuse `symbolId`, avoid broad file reads.” Sources: [README.md](/Users/mj/projects/eye/README.md:28), [src/mcp/server.ts](/Users/mj/projects/eye/src/mcp/server.ts:159)
- The user-facing behavior is currently tied to `query_symbol` returning `semantic | index | fallback` strategies, with TS/Python semantic behavior explicitly tested and documented. Sources: [src/mcp/server.ts](/Users/mj/projects/eye/src/mcp/server.ts:291), [tests/ts-navigation.test.ts](/Users/mj/projects/eye/tests/ts-navigation.test.ts:20), [tests/python-navigation.test.ts](/Users/mj/projects/eye/tests/python-navigation.test.ts:20)
- The persisted index is currently built from `tree-sitter` extraction, not ctags. Storage types, DB ordering, and durable docs all encode that assumption. Sources: [src/indexing/parser.ts](/Users/mj/projects/eye/src/indexing/parser.ts:53), [src/indexing/types.ts](/Users/mj/projects/eye/src/indexing/types.ts:18), [src/storage/database.ts](/Users/mj/projects/eye/src/storage/database.ts:695), [.agents/knowledge/business-logic/indexing-cache-query.md](/Users/mj/projects/eye/.agents/knowledge/business-logic/indexing-cache-query.md:61)
- The current system couples indexing, DB persistence, semantic lookup, and `symbolId` enrichment more tightly than a simple parser swap would suggest. Semantic results are mapped back to indexed rows so later `symbolId` follow-up remains exact. Sources: [src/query/definitions.ts](/Users/mj/projects/eye/src/query/definitions.ts:73), [src/query/references.ts](/Users/mj/projects/eye/src/query/references.ts:72)
- `symbolId` stability across unchanged reindex runs is already a repository invariant, and read-only tool behavior plus lazy `.eye` creation are also locked by tests. Sources: [tests/indexing-and-status.test.ts](/Users/mj/projects/eye/tests/indexing-and-status.test.ts:48), [tests/mcp-server.e2e.ts](/Users/mj/projects/eye/tests/mcp-server.e2e.ts:175)
- The repository has no existing `.agents/plans/` bundle for this topic. Historical `ctags` mentions exist only in an older completed plan where ctags was optional later enrichment, not the main engine. Sources: [plans/complete-implementation.md](/Users/mj/projects/eye/plans/complete-implementation.md:54), [plans/ACTIVE.md](/Users/mj/projects/eye/plans/ACTIVE.md:5)
- The required explore pass ran before this bundle draft. The mandatory `Implementation Surface` and `Verification Surface` explorers both completed, plus `Existing Pattern` and `Partial State` explorers for prior-plan and partial-state coverage.
- Interview outcome: the user explicitly selected a full replacement direction. The chosen path is “remove LSP/semantic backends from the shipped navigation path and rewrite the product around ctags-first indexing.”
- No further interview was needed because that choice also fixes the public contract decision: the shipped `query_symbol` schema will stop advertising live `semantic` results, and the output contract will be rewritten to `index | fallback` instead of keeping a dead compatibility enum.
- Deterministic validation passed for bundle structure before the semantic review pass.
- Phase 5 semantic review passed after the bundle was tightened around API consequences, ctags toolchain gates, and verification ordering.

## Goal

Produce a decision-complete execution bundle for replacing the shipped semantic/tree-sitter navigation stack with a ctags-first persisted index while keeping the MCP server useful for large-repository agent navigation.

## Non-Goals

- keeping any LSP-backed or language-service-backed definition/reference path alive in the shipped query flow
- adding new MCP tools beyond the current five-tool surface
- introducing multi-root indexing, watch mode, or background sync
- restoring IDE-grade semantic precision for TS/JS or Python
- expanding unrelated dependency-analysis or import-graph features beyond what the ctags-first rewrite requires

## Constraints

- The public tool surface stays centered on the current five MCP tools.
- `query_symbol` input shapes stay intact: `target.by = "anchor" | "symbolId" | "symbol"`.
- The server remains better than broad text search by preserving bounded reads, lazy cache reuse, and stable `symbolId` follow-up as a required invariant.
- No shipped semantic backend remains in the runtime query path after this rewrite.
- `Universal Ctags` becomes a required external dependency and must be validated in local and CI workflows.
- Read-only tools must remain runtime-free and must not create `.eye/` just to answer.
- Existing `.eye/cache.db` and `.eye/blobs/` are not migrated in place across the engine swap; the replacement policy is explicit invalidation plus reindex under the new schema.
- The bundle must explicitly rewrite tests, docs, and durable knowledge so they match the ctags-first product contract.

## Commands

- `pnpm run doctor`
- `pnpm run lint`
- `pnpm run typecheck`
- `pnpm run test`
- `pnpm run test:e2e`
- `pnpm run test:fixtures:real`
- `pnpm run test:coverage`
- `pnpm run build`
- `pnpm run validate`
- `pnpm exec vitest run tests/indexing-and-status.test.ts`
- `pnpm exec vitest run tests/ts-navigation.test.ts tests/python-navigation.test.ts`
- `pnpm exec vitest run tests/mcp-server.e2e.ts`
- `pnpm exec vitest run --config vitest.real-fixtures.config.ts`

## Project Structure

- `src/mcp/`: tool registration and MCP-facing contract surface
- `src/indexing/`: discovery, dirty detection, and per-file indexing orchestration
- `src/query/`: `query_symbol`, status, definition/reference/context assembly
- `src/storage/`: schema, persistence, lookup ordering, generation bookkeeping
- `src/lang/ts/`, `src/lang/python/`: current semantic backends to be removed from the shipped query path
- `src/scripts/doctor.ts`: runtime/toolchain readiness checks
- `tests/`: index lifecycle, unit navigation, MCP E2E, and real-fixture validation
- `.agents/knowledge/`: canonical docs that must match shipped behavior

## Testing Strategy

- Gate the runtime/toolchain shift first by making `doctor` and workflow assumptions ctags-aware.
- Revalidate index lifecycle and `symbolId` stability before rewriting the MCP contract tests.
- Rewrite TS/Python navigation tests from semantic expectations to index-first expectations only after the query path is ctags-backed.
- Keep stdio MCP E2E as the public-contract authority for the five shipped tools.
- Use the real-fixture suite as the final product-contract check for large-repo behavior after local and MCP E2E tests are already green.

## Success Criteria

- The shipped runtime query path contains no LSP- or language-service-backed definition/reference behavior.
- `query_symbol` remains the main navigation tool and still accepts `anchor`, `symbolId`, and plain `symbol` targets.
- `symbolId` remains stable across unchanged reindex runs under the ctags-backed index.
- `get_project_structure` and `read_source_range` remain runtime-free and bounded.
- `refresh_index` and `get_index_status` continue to report useful generation/cache state under the new index model.
- `query_symbol` output schemas and docs are rewritten to `index | fallback` strategy/source semantics with no live `semantic` branch left in the shipped contract.
- The repository docs, knowledge docs, and tests describe and verify a ctags-first contract instead of a semantic-first contract.
- The full validation wave passes, including real-fixture coverage.

## Open Questions

- None

## Work Objectives

- make `Universal Ctags` a first-class runtime prerequisite and validation target
- replace `tree-sitter`-based persisted index extraction with ctags-backed normalized records
- remove shipped semantic navigation paths and redefine `query_symbol` as index-first plus fallback
- rewrite the MCP-facing `strategy` and match-source contract from `semantic | index | fallback` to `index | fallback`
- preserve or explicitly restate core invariants: five-tool MCP surface, read-only/runtime-free tools, lazy `.eye` creation, stable `symbolId`
- update storage, ranking, status semantics, tests, docs, and knowledge so they all reflect the new engine

## Verification Strategy

- Use repo-native verification commands whenever a task boundary can realistically pass them.
- Keep earlier tasks on focused checks so they do not depend on later contract rewrites.
- Use `doctor` as the runtime prerequisite gate once ctags becomes required.
- Use focused Vitest files for index lifecycle, query behavior, MCP E2E, and real-fixture validation in the order the code changes make them passable.
- Reserve `pnpm run validate` and `pnpm run test:fixtures:real` for the final wave after the local contract and docs are already aligned.
- Treat cache schema semantics, status counts, and `symbolId` stability as first-class verification targets, not incidental side effects.

## Execution Strategy

- Start by codifying the new required runtime/toolchain contract.
- Replace the persisted index source and storage taxonomy before touching the MCP-facing query contract.
- Handle existing `.eye` state through explicit cache invalidation and reindex, not in-place semantic-to-ctags migration.
- Rewrite `query_symbol` and its navigation tests only after the ctags-backed index can produce stable symbol rows.
- Rewrite MCP E2E and docs after the local query contract is settled so the user-facing surface changes only once.
- Finish with real-fixture coverage and full validation so broad regressions are caught after the contract rewrite is complete.

## Parallel Waves

- `Wave 1`: serial core rewrite
  - runtime/toolchain contract
  - ctags-backed persisted index
  - index-first query rewrite
- `Wave 2`: serial contract rewrite
  - MCP/E2E expectations
  - README and durable knowledge updates
- `Wave 3`: final verification
  - broad repo validation
  - real-fixture revalidation

## Artifact Graph

- `T1`
  - `requires`: None
  - `unlocks`: T2
  - `blocked_by`: None
  - `ready_when`: the bundle starts and the repo still assumes `tree-sitter`/`pyright` runtime readiness instead of ctags readiness
- `T2`
  - `requires`: T1
  - `unlocks`: T3
  - `blocked_by`: T1 not done
  - `ready_when`: ctags runtime prerequisites are declared and the index persistence layer still depends on `tree-sitter` extraction without a fixed cache invalidation policy
- `T3`
  - `requires`: T2
  - `unlocks`: CP1
  - `blocked_by`: T2 not done
  - `ready_when`: ctags-backed symbol rows exist and `query_symbol` still routes through semantic backends
- `CP1`
  - `requires`: T3
  - `unlocks`: T4
  - `blocked_by`: T3 not done
  - `ready_when`: the runtime contract, persisted index, local navigation tests, and stale-cache transition behavior have all been rewritten to ctags-first behavior
- `T4`
  - `requires`: CP1
  - `unlocks`: T5
  - `blocked_by`: CP1 not done
  - `ready_when`: local index/query behavior is stable enough to rewrite MCP contract expectations
- `T5`
  - `requires`: T4
  - `unlocks`: CP2
  - `blocked_by`: T4 not done
  - `ready_when`: stdio MCP E2E behavior has been rewritten and the remaining gap is docs plus real-fixture contract coverage
- `CP2`
  - `requires`: T5
  - `unlocks`: T6
  - `blocked_by`: T5 not done
  - `ready_when`: all code, tests, docs, and knowledge changes are in place and only broad reconciliation remains
- `T6`
  - `requires`: CP2
  - `unlocks`: None
  - `blocked_by`: CP2 not done
  - `ready_when`: the full diff surface is stable enough for repo-wide validation and real-fixture revalidation

## Checkpoint Plan

- `CP1` after `T1-T3`: confirm the new prerequisite contract, ctags-backed persistence, and index-first local navigation tests agree before rewriting public-contract tests.
- `CP1` also confirms that a workspace with pre-existing `.eye` state is invalidated and rebuilt safely instead of being read as if the old semantic/tree-sitter cache were still valid.
- `CP2` after `T4-T5`: confirm MCP E2E, docs, knowledge, and real-fixture expectations all describe the same product contract before the final broad validation wave.

## Final Verification Wave

- Run `pnpm run validate`.
- Run `pnpm run test:fixtures:real`.
- Confirm the final diff matches the declared surface across runtime setup, indexing, storage, query, tests, docs, and knowledge.
- Record evidence for the full validation wave under bundle-local paths such as `evidence/final-validation/validate.txt`, `evidence/final-validation/real-fixtures.txt`, and `evidence/final-validation/cache-transition.txt`.

## Sync/Reconcile Rules

- The executor may mutate only source files needed by the active task, bundle-local `evidence/`, `notes.md`, and the allowed `tasks.md` live fields.
- If the actual diff escapes a task’s declared file scope, stop execution, record the mismatch in `notes.md`, and return the same bundle to the planner in the same turn.
- If the repository already differs from the task contract at execution time, reconcile `tasks.md` before new implementation starts.
- After every task state change, reread `tasks.md`, recompute the ready set, and continue in the same turn unless the bundle is complete or a real blocker remains.
