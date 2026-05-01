# eye Knowledge Base

## Start Here

- [Project map](project-map.md)
- [Architecture](architecture.md)
- [Indexing, cache, query](indexing-cache-query.md)
- [Validation and hooks](validation-and-hooks.md)
- [Design](design.md)
- [ExecPlan format](../../PLANS.md)
- [Active plans](../../plans/ACTIVE.md)

## What Lives Here

- This tree holds durable repository facts that change implementation or verification decisions.
- `plans/` holds transient execution plans and status routing, not evergreen knowledge.
- Keep one canonical explanation per topic and update it when verified behavior changes.

## Canonical Topics

- [project-map.md](project-map.md): module ownership, runtime/config surfaces, and test map.
- [architecture.md](architecture.md): tool surface, read-only versus index-backed flows, and runtime boundaries.
- [indexing-cache-query.md](indexing-cache-query.md): `.eye` layout, indexing lifecycle, query strategy, and fallback rules.
- [validation-and-hooks.md](validation-and-hooks.md): pnpm commands, Lefthook, CI, docs gates, and completion rules.
- [design.md](design.md): public docs UI surfaces, theme tokens, and browser validation expectations.

## Update Triggers

- layout, ownership, or repo-local dogfooding entrypoint changes: [project-map.md](project-map.md)
- root resolution, `.eye` lifecycle, indexing, `scopePath`, or query behavior changes: [architecture.md](architecture.md) and [indexing-cache-query.md](indexing-cache-query.md)
- validation flow, package manager, hooks, or CI changes: [validation-and-hooks.md](validation-and-hooks.md)
- docs app structure, public docs content routing, public docs UI, or docs command changes: [project-map.md](project-map.md), [design.md](design.md), and [validation-and-hooks.md](validation-and-hooks.md)
