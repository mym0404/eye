# Replace semantic indexing with ctags

This file is the only live progress record for this bundle.

## Status Board

- `Doing`: None
- `Ready Now`: None
- `Blocked`: None
- `Todo`: None
- `Done`: T1 - Codify the ctags runtime contract; T2 - Replace persisted index extraction with ctags; T3 - Rewrite query flow to index-first; CP1 - Reconcile the core rewrite invariants; T4 - Rewrite the MCP contract and stdio E2E; T5 - Update docs, knowledge, and real-fixture expectations; CP2 - Reconcile the shipped contract; T6 - Run the final validation wave

## Tasks

### T1 - Codify the ctags runtime contract
- `ID`: T1
- `Slice`: Runtime prerequisites
- `Status`: Done
- `Depends On`: None
- `Start When`: The repo still treats `tree-sitter` and `pyright` as shipped runtime prerequisites and does not validate `ctags` readiness.
- `Files`: primary: `package.json`, `src/scripts/doctor.ts`, `.github/workflows/ci.yml`, `.github/workflows/real-fixtures.yml`, `README.md`; generated/incidental: `pnpm-lock.yaml`
- `Context`: The replacement direction is not executable until runtime tooling, local checks, and CI all agree that `Universal Ctags` is now required and the semantic toolchain is no longer required by the shipped query path.
- `Produces`: Updated runtime dependency contract, ctags-aware `doctor`, and workflow setup that installs or validates ctags in both standard CI and real-fixture CI.
- `Must Do`: Require `Universal Ctags` specifically, not a vague generic `ctags`; keep `rg` as a required dependency; remove shipped-runtime claims that still describe `pyright` or `tree-sitter` as active navigation prerequisites.
- `Must Not Do`: Do not rename MCP tools; do not rewrite query behavior in this task; do not rewrite README behavior/contract sections that still describe the currently shipped semantic behavior; do not leave CI assuming a tool the local `doctor` no longer checks.
- `Implementation Notes`: Add a concrete ctags readiness check to `doctor`, update only prerequisite/install/runtime setup text in docs, and align CI workflow setup with the same prerequisite. If compatibility with the current environment requires a named package or installation step, encode that exact choice in the workflow files and prerequisite docs. Leave user-facing behavior rewrites for later tasks.
- `Verification Strategy`: 1. Run `pnpm run doctor`. 2. Success signal: the command exits `0` and the output path proves ctags readiness is checked instead of the old semantic runtime requirements. 3. If the command exits `0` but still allows the old semantic prerequisite path or never checks ctags, treat the task as incomplete. 4. Review the workflow diff to confirm both CI workflows now provision or validate ctags consistently with `doctor`, and record the exact Ubuntu install command plus the binary name `doctor` expects in the evidence.
- `Acceptance Criteria`: Local runtime validation and CI setup both treat `Universal Ctags` as the required navigation prerequisite, prerequisite/install docs are aligned with that requirement, and README behavior sections are not prematurely rewritten before the engine actually changes.
- `Definition of Done`: `pnpm run doctor` passes, the workflow setup is aligned with the new prerequisite, evidence is recorded, task `Status` becomes `Done`, the top `Status Board` is refreshed, and `tasks.md` reread confirms persistence.
- `Evidence`: evidence/t1-doctor-and-ci.txt
- `Reopen When`: Runtime prerequisites, CI setup, or installation guidance drift back out of sync.
- `Size`: M

### T2 - Replace persisted index extraction with ctags
- `ID`: T2
- `Slice`: Index and storage core
- `Status`: Done
- `Depends On`: T1
- `Start When`: T1 is `Done` and the persisted index still depends on `tree-sitter` extraction or `tree-sitter`-specific source taxonomy.
- `Files`: primary: `src/indexing/parser.ts`, `src/indexing/indexer.ts`, `src/indexing/types.ts`, `src/storage/schema.ts`, `src/storage/database.ts`; generated/incidental: `.eye/cache.db`, `.eye/blobs/`
- `Context`: The ctags-first design needs a new persisted index truth before the query layer can be rewritten safely.
- `Produces`: A ctags-backed per-file indexing path, updated file/source taxonomy, storage ordering that no longer privileges `tree-sitter`, and a committed-generation model that still supports stable `symbolId` follow-up.
- `Must Do`: Keep `.eye` generation and status bookkeeping intact; preserve bounded worker-pool behavior; keep `symbolId` generation in shared indexing/storage code rather than embedding identity rules inside a ctags wrapper.
- `Must Not Do`: Do not leave `tree-sitter`-specific enum values, SQL ordering, or blob semantics as shipped truth after the task; do not rewrite MCP E2E or docs here; do not silently read old semantic/tree-sitter `.eye` state as if it were compatible.
- `Implementation Notes`: Replace the `tree-sitter` extraction path with a ctags-backed normalized record builder. Keep `parseSource` on file rows ctags-aware, simplify symbol/reference source ordering so the persisted index is the main truth without a `tree-sitter` branch, and keep fallback text records explicit. Preserve cache generation updates and dirty-file behavior. For existing `.eye/cache.db` and `.eye/blobs/`, use explicit invalidation plus rebuild under the new schema instead of in-place migration; if invalidation or first rebuild fails, stop and return rather than leaving a mixed old/new cache.
- `Verification Strategy`: 1. Run `pnpm exec vitest run tests/indexing-and-status.test.ts`. 2. Success signal: the suite exits `0` and still proves index creation, `sourceRoots` scoping, and unchanged-reindex `symbolId` stability under the new ctags-backed index. 3. Then verify a workspace with pre-existing `.eye/cache.db`/`.eye/blobs/` is invalidated and rebuilt safely on the next index-backed operation such as `refresh_index`, and capture before/after cache state in the evidence. 4. If the suite passes but the storage layer still contains `tree-sitter` as the shipped persisted truth, treat the task as incomplete. 5. If stale cache artifacts interfere, use explicit invalidation and rerun; if rebuild still fails, stop and return with the failure captured in evidence.
- `Acceptance Criteria`: The persisted index is built from ctags-backed records, storage/query ordering no longer assumes `tree-sitter`, old `.eye` cache state is invalidated instead of misread as compatible state, and index lifecycle tests pass with stable `symbolId` behavior intact.
- `Definition of Done`: Focused index lifecycle tests pass, evidence is recorded, task `Status` becomes `Done`, the top `Status Board` is refreshed, and `tasks.md` reread confirms persistence.
- `Evidence`: evidence/t2-index-lifecycle.txt
- `Reopen When`: File-source taxonomy, schema ordering, or `symbolId` stability regresses.
- `Size`: L

### T3 - Rewrite query flow to index-first
- `ID`: T3
- `Slice`: Query behavior
- `Status`: Done
- `Depends On`: T2
- `Start When`: T2 is `Done` and `query_symbol` still routes definition or reference resolution through semantic backends.
- `Files`: primary: `src/query/`, `src/lang/ts/`, `src/lang/python/`, `tests/ts-navigation.test.ts`, `tests/python-navigation.test.ts`; generated/incidental: N/A
- `Context`: The product contract changes only become real after `query_symbol` stops using shipped semantic backends and the focused navigation tests are rewritten to reflect index-first behavior.
- `Produces`: An index-first `query_symbol` flow, removed or disconnected semantic runtime paths, and updated local navigation tests for TS/Python under the new contract.
- `Must Do`: Keep `target.by = "anchor" | "symbolId" | "symbol"` intact; keep `context` as a bounded definition-context response; preserve `symbolId`-based follow-up; make fallback behavior explicit rather than masquerading as semantic certainty.
- `Must Not Do`: Do not reintroduce a hidden language-service escape hatch; do not leave `semantic` as a live runtime result if the backend is gone; do not weaken `symbolId` reuse into a plain text-search-only flow.
- `Implementation Notes`: Rewrite definitions and references to resolve through ctags-backed indexed rows first, then fallback search. Remove shipped reliance on the TS/Python semantic backends from the query path. Rewrite the focused navigation tests so they validate index-first behavior and any accepted precision loss intentionally. The representative query outcomes are: `anchor` resolves to the best indexed definition or falls back explicitly, `symbolId` remains the exact follow-up path, and plain `symbol` remains a ranked name entry point.
- `Verification Strategy`: 1. Run `pnpm exec vitest run tests/ts-navigation.test.ts tests/python-navigation.test.ts`. 2. Success signal: both files exit `0` and assert the new ctags-first contract rather than semantic expectations. 3. Confirm the updated tests still prove one representative `anchor`, one representative `symbolId`, and one representative plain `symbol` path instead of reducing to hollow smoke checks. 4. If the tests pass only because they no longer check meaningful navigation behavior, treat the task as incomplete and rewrite them to prove exact bounded outcomes. 5. If old semantic modules still participate in the call path, record that mismatch and keep the task open.
- `Acceptance Criteria`: `query_symbol` no longer depends on shipped semantic backends, TS/Python navigation tests pass against the new index-first behavior, and `symbolId`-based follow-up still works.
- `Definition of Done`: Focused query tests pass, evidence is recorded, task `Status` becomes `Done`, the top `Status Board` is refreshed, and `tasks.md` reread confirms persistence.
- `Evidence`: evidence/t3-query-tests.txt
- `Reopen When`: Query resolution reintroduces semantic-only paths or loses meaningful `symbolId` follow-up.
- `Size`: L

### CP1 - Reconcile the core rewrite invariants
- `ID`: CP1
- `Slice`: Checkpoint
- `Status`: Done
- `Depends On`: T3
- `Start When`: T1, T2, and T3 are all `Done`.
- `Files`: primary: `package.json`, `src/scripts/doctor.ts`, `.github/workflows/ci.yml`, `.github/workflows/real-fixtures.yml`, `src/indexing/`, `src/storage/`, `src/query/`, `src/lang/ts/`, `src/lang/python/`, `tests/indexing-and-status.test.ts`, `tests/ts-navigation.test.ts`, `tests/python-navigation.test.ts`; generated/incidental: `pnpm-lock.yaml`, `.eye/cache.db`, `.eye/blobs/`
- `Context`: Before rewriting the shipped MCP contract, the core runtime, index, and local query invariants must agree with each other.
- `Produces`: A reconciled core diff, updated notes, and confidence that the repo is ready for MCP-surface rewrites.
- `Must Do`: Re-read the full carried-forward diff; confirm ctags is the required runtime path; confirm `symbolId` stability is still enforced; confirm no read-only tool behavior changed incidentally.
- `Must Not Do`: Do not add new feature scope during the checkpoint; do not rewrite MCP E2E or docs in this step.
- `Implementation Notes`: Use this checkpoint to catch hidden contradictions between the runtime contract, the persisted index, and the local query behavior before public-contract tests are touched.
- `Verification Strategy`: 1. Run `pnpm run doctor`. 2. Run `pnpm run typecheck`. 3. Run `pnpm exec vitest run tests/indexing-and-status.test.ts tests/ts-navigation.test.ts tests/python-navigation.test.ts`. 4. Verify one workspace with pre-existing `.eye` state can still run `refresh_index` and then `get_index_status` safely under the new invalidation policy. 5. Success signal: all commands exit `0`, stale cache state is invalidated and rebuilt cleanly, the carried-forward diff stays within the declared surface, and the local contract is coherently index-first. 6. If a command exits `0` but the diff still leaves semantic runtime remnants or `tree-sitter` as shipped truth, treat the checkpoint as incomplete.
- `Acceptance Criteria`: The runtime contract, persisted index, and focused navigation behavior are aligned and ready for public-contract rewrites.
- `Definition of Done`: The checkpoint verification passes, evidence is recorded, task `Status` becomes `Done`, the top `Status Board` is refreshed, and `tasks.md` reread confirms persistence.
- `Evidence`: evidence/cp1-core-reconcile.txt
- `Reopen When`: Later work reintroduces contradictions between runtime setup, index persistence, and local query behavior.
- `Size`: S

### T4 - Rewrite the MCP contract and stdio E2E
- `ID`: T4
- `Slice`: MCP surface
- `Status`: Done
- `Depends On`: CP1
- `Start When`: CP1 is `Done` and stdio MCP tests or server schemas still encode the old semantic-first contract.
- `Files`: primary: `src/mcp/server.ts`, `src/query/status.ts`, `tests/mcp-server.e2e.ts`; generated/incidental: `.eye/cache.db`, `.eye/blobs/`
- `Context`: Once the core engine is index-first, the shipped MCP schemas and stdio E2E expectations must be rewritten to describe that reality.
- `Produces`: Updated tool schemas and stdio MCP E2E tests for the five shipped tools under the ctags-first contract.
- `Must Do`: Keep the five-tool surface intact; keep read-only annotations accurate; keep `query_symbol` target forms intact; make `strategy` and match-source semantics reflect the removal of semantic runtime behavior.
- `Must Not Do`: Do not quietly change tool names; do not let MCP E2E rely on stale semantic expectations; do not widen side effects for read-only tools.
- `Implementation Notes`: Rewrite the MCP-facing output contract so it no longer promises live semantic results. The shipped decision is explicit: `query_symbol.strategy` and per-match `source` become `index | fallback`, and `semantic` is removed from the MCP schema instead of preserved as a dead compatibility value. Update `get_index_status` semantics only in ways consistent with the new ctags-backed persistence model. Keep read-only/runtime-free behavior for structure, source, and status paths, and check `get_project_structure`, `read_source_range`, and `get_index_status` separately for no unintended side effects.
- `Verification Strategy`: 1. Run `pnpm exec vitest run tests/mcp-server.e2e.ts`. 2. Success signal: the suite exits `0` and proves the five shipped tools still work under the rewritten ctags-first contract, including lazy `.eye` creation and read-only behavior. 3. Confirm the suite still checks `get_project_structure`, `read_source_range`, and `get_index_status` individually for read-only/runtime-free behavior, and checks that `query_symbol` now emits `index | fallback` semantics only. 4. If the suite passes only because it stopped checking meaningful `query_symbol` behavior, treat the task as incomplete.
- `Acceptance Criteria`: MCP schemas, stdio E2E coverage, and runtime side-effect annotations all match the new ctags-first product contract while preserving the five-tool surface, and `query_symbol` no longer advertises `semantic` as a possible output strategy/source.
- `Definition of Done`: MCP E2E passes, evidence is recorded, task `Status` becomes `Done`, the top `Status Board` is refreshed, and `tasks.md` reread confirms persistence.
- `Evidence`: evidence/t4-mcp-e2e.txt
- `Reopen When`: MCP schemas drift away from the shipped engine or read-only tool behavior changes.
- `Size`: M

### T5 - Update docs, knowledge, and real-fixture expectations
- `ID`: T5
- `Slice`: Product contract docs
- `Status`: Done
- `Depends On`: T4
- `Start When`: T4 is `Done` and README, durable knowledge, or real-fixture tests still describe the removed semantic/tree-sitter contract.
- `Files`: primary: `README.md`, `.agents/knowledge/`, `tests/mcp-server.real-fixtures.e2e.ts`; generated/incidental: N/A
- `Context`: The product contract is not fully replaced until the docs and heavy validation surfaces stop describing the old engine.
- `Produces`: Updated README, durable knowledge docs, and real-fixture tests that reflect ctags-first behavior and the removed semantic runtime path.
- `Must Do`: Update canonical knowledge docs, not just README prose; describe ctags as the required runtime prerequisite; document the cache invalidation plus rebuild policy for old `.eye` state; rewrite real-fixture expectations so they validate the new contract instead of the removed semantic one.
- `Must Not Do`: Do not leave contradictory documentation between README and `.agents/knowledge/`; do not leave real-fixture tests asserting a semantic strategy that no longer exists.
- `Implementation Notes`: Treat README and `.agents/knowledge/` as shipped product docs. Update only the docs whose topic actually changed: architecture, indexing/cache/query behavior, project map if ownership changed, and validation docs if runtime prerequisites changed.
- `Verification Strategy`: 1. Run `pnpm exec vitest run --config vitest.real-fixtures.config.ts`. 2. If the run fails because real fixtures are missing, submodules are not initialized, git history is too shallow for the fixture expectation, or fixture workspaces are dirty, repair only with repo-native steps such as `git submodule update --init --recursive` and cleanup that restores only tracked fixture files to the checked-in state, then rerun. 3. If repo-native repair does not restore a runnable fixture state, stop and return rather than improvising a new fixture setup. 4. Success signal: the suite exits `0`, the real-fixture expectations match the new ctags-first contract, and representative output fields show `index | fallback` behavior instead of `semantic`. 5. Then review the final doc diff to confirm README and durable knowledge describe the same product behavior. 6. If the test passes but docs still describe semantic/tree-sitter runtime behavior, treat the task as incomplete.
- `Acceptance Criteria`: Heavy real-fixture coverage passes against the new contract, and README plus durable knowledge docs consistently describe the ctags-first server.
- `Definition of Done`: Real-fixture verification passes, docs are reconciled, evidence is recorded, task `Status` becomes `Done`, the top `Status Board` is refreshed, and `tasks.md` reread confirms persistence.
- `Evidence`: evidence/t5-real-fixtures-and-docs.txt
- `Reopen When`: README, knowledge docs, or real-fixture expectations drift apart.
- `Size`: M

### CP2 - Reconcile the shipped contract
- `ID`: CP2
- `Slice`: Checkpoint
- `Status`: Done
- `Depends On`: T5
- `Start When`: T4 and T5 are both `Done`.
- `Files`: primary: `package.json`, `src/scripts/doctor.ts`, `.github/workflows/ci.yml`, `.github/workflows/real-fixtures.yml`, `src/indexing/`, `src/storage/`, `src/query/`, `src/mcp/server.ts`, `src/query/status.ts`, `src/lang/ts/`, `src/lang/python/`, `README.md`, `.agents/knowledge/`, `tests/indexing-and-status.test.ts`, `tests/ts-navigation.test.ts`, `tests/python-navigation.test.ts`, `tests/mcp-server.e2e.ts`, `tests/mcp-server.real-fixtures.e2e.ts`; generated/incidental: `pnpm-lock.yaml`, `.eye/cache.db`, `.eye/blobs/`
- `Context`: Before the final broad validation wave, the complete shipped contract must be coherent across runtime setup, index behavior, MCP schemas, docs, and heavy tests.
- `Produces`: A reconciled full diff and updated notes confirming the ctags-first contract is internally consistent.
- `Must Do`: Re-read the full carried-forward diff; confirm the five-tool surface is intact; confirm docs, E2E, and real-fixture tests describe the same product behavior; confirm removed semantic modules are not still required by workflows or docs.
- `Must Not Do`: Do not add new feature work; do not skip the full carried-forward diff review.
- `Implementation Notes`: This checkpoint is the last place to catch contradictions between code, tests, and docs before the expensive final validation wave.
- `Verification Strategy`: 1. Run `pnpm run lint`. 2. Run `pnpm run typecheck`. 3. Run `pnpm run test`. 4. Run `pnpm run test:e2e`. 5. Success signal: all commands exit `0`, and the carried-forward diff still matches the declared contract surface. 6. If commands pass but docs or test expectations still contradict the code, keep the checkpoint open.
- `Acceptance Criteria`: The full shipped contract is consistent and ready for the final validation wave.
- `Definition of Done`: The checkpoint verification passes, evidence is recorded, task `Status` becomes `Done`, the top `Status Board` is refreshed, and `tasks.md` reread confirms persistence.
- `Evidence`: evidence/cp2-shipped-contract.txt
- `Reopen When`: Later changes make code, tests, and docs disagree again.
- `Size`: S

### T6 - Run the final validation wave
- `ID`: T6
- `Slice`: Final verification
- `Status`: Done
- `Depends On`: CP2
- `Start When`: CP2 is `Done` and the full diff surface is stable enough for broad validation.
- `Files`: primary: `package.json`, `src/scripts/doctor.ts`, `.github/workflows/ci.yml`, `.github/workflows/real-fixtures.yml`, `src/indexing/`, `src/storage/`, `src/query/`, `src/mcp/server.ts`, `src/query/status.ts`, `src/lang/ts/`, `src/lang/python/`, `README.md`, `.agents/knowledge/`, `tests/indexing-and-status.test.ts`, `tests/ts-navigation.test.ts`, `tests/python-navigation.test.ts`, `tests/mcp-server.e2e.ts`, `tests/mcp-server.real-fixtures.e2e.ts`; generated/incidental: `pnpm-lock.yaml`, `.eye/cache.db`, `.eye/blobs/`, `coverage/`, `coverage/lcov.info`
- `Context`: The final wave proves the rewritten ctags-first server satisfies the repository’s broad validation standards and heavy real-fixture expectations together.
- `Produces`: Final validation evidence for the complete ctags-first replacement.
- `Must Do`: Run both the standard validation wave and the separate heavy real-fixture wave; record any environment repair step if the heavy suite needs fixture refresh or workspace cleanup first.
- `Must Not Do`: Do not report completion on partial validation; do not skip the heavy suite because earlier focused tests passed.
- `Implementation Notes`: `validate` remains the standard broad gate even though it does not include real fixtures. The heavy real-fixture suite is an additional required gate for this bundle because the product contract is changing at the core navigation layer. Allowed repair scope is limited to repo-native fixture setup or cleanup, not ad-hoc fixture rewriting.
- `Verification Strategy`: 1. Run `pnpm run validate`. 2. Run `pnpm run test:fixtures:real`. 3. Success signal: both commands exit `0` and no final diff reconciliation issue remains. 4. If `validate` exits `0` but the heavy real-fixture suite fails, keep the task open. 5. If the heavy suite is blocked by fixture environment drift, repair the environment using only repo-native fixture setup or cleanup, rerun, and record that branch in evidence. 6. Record final evidence under concrete paths such as `evidence/final-validation/validate.txt`, `evidence/final-validation/real-fixtures.txt`, and `evidence/final-validation/cache-transition.txt`.
- `Acceptance Criteria`: The standard repository validation gate and the heavy real-fixture gate both pass for the ctags-first replacement.
- `Definition of Done`: Final verification passes, evidence is recorded, task `Status` becomes `Done`, the top `Status Board` is refreshed, and `tasks.md` reread confirms persistence.
- `Evidence`: evidence/final-validation/summary.txt
- `Reopen When`: Any broad repo validation or heavy real-fixture regression appears after completion.
- `Size`: M
