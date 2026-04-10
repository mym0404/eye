# Goal

Make the MCP server boot reliably, align tool annotations with real side effects, add real stdio MCP E2E tests for the shipped tools, and enforce those checks through the existing validation workflows.

# Current State

- The server previously failed to boot because the MCP SDK imported a runtime dependency that was not installed.
- Current tests validate internal modules but do not fully prove the stdio MCP boundary.
- Some tool annotations claim read-only/idempotent behavior while the implementation creates or mutates `.eye/`.

# Scope and Non-goals

- In scope:
  - runtime dependency fix
  - doctor/runtime validation improvement
  - tool annotation + read-only status contract fix
  - stdio MCP E2E tests for all shipped tools
  - workflow integration so regressions are caught automatically
- Out of scope:
  - new end-user features
  - large fixture expansion

# Design

- Install the missing runtime dependency instead of relying on transitive behavior.
- Add a server-runtime check to `doctor`.
- Make `get_index_status` truly read-only by avoiding runtime/layout creation when the cache does not exist.
- Remove read-only/idempotent hints from tools that lazily index or explicitly refresh.
- Add a test helper that speaks the line-delimited MCP stdio protocol and exercises initialize, tools/list, and tools/call.

# Milestones

1. Runtime and contract fixes
   - Fix runtime dependency.
   - Fix tool annotation/read-only contract.
   - Validation: `pnpm run doctor`, server process boots.

2. MCP E2E tests
   - Add stdio MCP test client helper.
   - Add E2E tests covering all six tools.
   - Validation: `pnpm run test`, `pnpm run test:coverage`.

3. Workflow enforcement
   - Ensure local/CI workflows run the new checks.
   - Validation: `pnpm exec lefthook run pre-commit --force --all-files`, `pnpm exec lefthook run pre-push`, CI config review.

4. Revalidation
   - Re-run full gates.
   - Collect sub-agent review results.

# Validation

- `pnpm run doctor`
- `pnpm run test`
- `pnpm run test:e2e`
- `pnpm run test:coverage`
- `pnpm run validate`
- `pnpm run build`
- `pnpm exec lefthook run pre-commit --force --all-files`
- `pnpm exec lefthook run pre-push`

# Progress Log

- 2026-04-10: Created plan.

# Decision Log

- 2026-04-10: Prefer real stdio MCP E2E tests over mock transport tests so the runtime boot path is covered.
