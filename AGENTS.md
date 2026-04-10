# eye Agent Router

## Read Order

Read these files in order before making non-trivial changes:

1. `.agents/knowledge/README.md`
2. `.agents/knowledge/project-map.md`
3. `.agents/knowledge/architecture.md`
4. `.agents/knowledge/business-logic/indexing-cache-query.md`
5. `.agents/knowledge/operations/validation-and-hooks.md`
6. `.agents/knowledge/operations/source-sync.md`
7. `PLANS.md`
8. Active plan under `plans/`

## Router Rules

- Root `AGENTS.md` is only a router. Long-lived project knowledge belongs under `.agents/knowledge/`.
- When code changes alter traversal, indexing, storage, semantic lookup, fallback search, or MCP tool behavior, update `.agents/knowledge/business-logic/indexing-cache-query.md`.
- When project layout or module ownership changes, update `.agents/knowledge/project-map.md`.
- When validation, CI, hooks, or package-manager flow changes, update `.agents/knowledge/operations/validation-and-hooks.md`.
- Before changing knowledge docs, sync the configured external guide source with `pnpm run knowledge:sync`. Source-repo setup lives in `.agents/knowledge/source-repo.local.json`; instructions live in `.agents/knowledge/operations/source-sync.md`.

## Validation

- Use Corepack-managed pnpm only.
- Standard implementation gate:
  - `pnpm run doctor`
  - `pnpm run lint`
  - `pnpm run typecheck`
  - `pnpm run test`
  - `pnpm run test:e2e`
- Feature-complete gate:
  - `pnpm run test:coverage`
  - `pnpm run docs:validate`
  - `pnpm run build`
- Broad changes should use `pnpm run validate`.
- Do not claim work is done if `pnpm run lint`, `pnpm run typecheck`, or `pnpm run test` has not passed.

## Working Style

- Keep docs honest. Planned work stays planned.
- Keep traversal, indexing, cache storage, semantic adapters, and fallback search separated.
- Preserve `.eye/config.json` as the portable config surface.
- Respect generated-path exclusions such as `build`, `dist`, `out`, `.eye`, and configured ignore paths.
- If Git hooks are missing, restore them with `pnpm exec lefthook install`.

## Current Scope

- The shipped implementation is a single-root MCP server.
- Semantic navigation is currently implemented for TS/JS and Python.
- Fixtures in-repo are CI-sized integration corpora, not the final large OSS corpus.
