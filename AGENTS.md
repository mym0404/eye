# eye Agent Router

## Project Overview

`eye` is a source-browsing MCP server for large local repositories. Root `AGENTS.md` stays short and routes durable project knowledge into `.agents/knowledge/`.

## Always-On Rules

- Treat the root `AGENTS.md` as a router, not the main knowledge store.
- Keep docs honest: update the relevant knowledge files when verified repository behavior changes.
- Keep traversal, indexing, cache storage, semantic adapters, and fallback search concerns separated.
- Preserve `.eye/config.json` as the portable config surface and respect generated-path exclusions such as `build`, `dist`, `out`, and `.eye`.
- Keep `plans/ACTIVE.md` current when a multi-step execution plan opens or changes status.

## Validation Commands

- Use Corepack-managed pnpm only.
- Standard gate: `pnpm run doctor`, `pnpm run lint`, `pnpm run typecheck`, `pnpm run test`, `pnpm run test:e2e`
- Broad changes: `pnpm run validate`
- Feature-complete or release-facing changes: `pnpm run test:coverage`, `pnpm run build`
- Do not report completion if `pnpm run lint`, `pnpm run typecheck`, or `pnpm run test` is failing.

## Knowledge Routing

Read these files before non-trivial changes:

1. `.agents/knowledge/README.md`
2. `.agents/knowledge/project-map.md`
3. `.agents/knowledge/architecture.md`
4. `.agents/knowledge/business-logic/indexing-cache-query.md`
5. `.agents/knowledge/operations/validation-and-hooks.md`
6. `PLANS.md`
7. `plans/ACTIVE.md`

Update these docs when relevant:

- traversal, indexing, storage, semantic lookup, fallback search, or MCP tool behavior: `.agents/knowledge/business-logic/indexing-cache-query.md`
- project layout or module ownership: `.agents/knowledge/project-map.md`
- validation, CI, hooks, or package-manager flow: `.agents/knowledge/operations/validation-and-hooks.md`

## Knowledge Sync Contract

- `.agents/knowledge/` is the default home for evergreen project knowledge.
- Root `AGENTS.md` must stay synchronized with the deeper knowledge base.
- When repository behavior changes, update the relevant knowledge docs with it.
- Consolidate stale or duplicated guidance instead of letting multiple copies drift.
- Do not add dedicated knowledge-only validators, CI gates, or sync machinery as the default workflow.
