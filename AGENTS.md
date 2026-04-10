# eye

## Overview
- `eye` is a public TypeScript MCP server for source-code browsing in large repositories.
- The current implementation uses lazy `.eye/` cache creation, tree-sitter structural indexing, TS/JS semantic navigation, Python semantic navigation, and ripgrep fallback.
- Keep docs and status reports honest. Do not describe planned work as shipped behavior.

## ExecPlans
- For non-trivial features, refactors, or sequencing-sensitive work, read `PLANS.md` first.
- Put active execution plans in `plans/`.
- ExecPlans must remain restartable from only the repository tree and the plan document.
- Update plan progress and validation notes while work is in flight.

## Validation
- Results are not acceptable unless they have been validated.
- Expected gates for implementation work:
  - `npm run doctor`
  - `npm run lint`
  - `npm run typecheck`
  - `npm run test`
- Expected gates before claiming feature-complete work:
  - `npm run test:coverage`
  - `npm run build`
- Prefer `npm run validate` when the change is broad.
- Do not say work is done if `lint`, `typecheck`, or `vitest` validation has not passed.

## Working Style
- Keep traversal, indexing, storage, semantic adapters, and fallback search separated.
- Prefer stable, restartable changes over shallow scaffolding.
- Preserve `.eye/config.json` as the portable config surface and keep runtime/cache artifacts local.
- Respect generated-path exclusions such as `build`, `dist`, `out`, `.eye`, and similar configured paths.

## Fixtures
- The committed test fixtures are small CI-friendly integration corpora.
- Large OSS-derived fixture expansion belongs in the active ExecPlan and must be documented honestly if still pending.
