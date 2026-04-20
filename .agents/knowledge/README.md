# eye Knowledge Base

## Start Here

- [Project map](project-map.md)
- [Architecture](architecture.md)
- [Indexing, cache, query](business-logic/indexing-cache-query.md)
- [Validation and hooks](operations/validation-and-hooks.md)
- [ExecPlan format](../../PLANS.md)
- [Active plans](../../plans/ACTIVE.md)

## What Lives Here

- This tree holds durable repository facts that change implementation or verification decisions.
- `plans/` holds transient execution plans and status routing, not evergreen knowledge.
- Keep one canonical explanation per topic and update it when verified behavior changes.

## Canonical Topics

- [project-map.md](project-map.md): module ownership, runtime/config surfaces, and test map.
- [architecture.md](architecture.md): tool surface, read-only versus index-backed flows, and runtime boundaries.
- [business-logic/indexing-cache-query.md](business-logic/indexing-cache-query.md): `.eye` layout, indexing lifecycle, query strategy, and fallback rules.
- [operations/validation-and-hooks.md](operations/validation-and-hooks.md): pnpm commands, Lefthook, CI, docs gates, and completion rules.

## Update Triggers

- layout, ownership, or repo-local dogfooding entrypoint changes: [project-map.md](project-map.md)
- root resolution, `.eye` lifecycle, indexing, `scopePath`, or query behavior changes: [architecture.md](architecture.md) and [business-logic/indexing-cache-query.md](business-logic/indexing-cache-query.md)
- validation flow, package manager, hooks, or CI changes: [operations/validation-and-hooks.md](operations/validation-and-hooks.md)
- docs app structure, public docs content routing, or docs command changes: [project-map.md](project-map.md) and [operations/validation-and-hooks.md](operations/validation-and-hooks.md)
