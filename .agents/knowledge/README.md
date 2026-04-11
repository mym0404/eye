# eye Knowledge Base

## Read First

- `project-map.md`
- `architecture.md`
- `business-logic/indexing-cache-query.md`
- `operations/validation-and-hooks.md`

## Purpose

- Keep durable project knowledge out of the root `AGENTS.md`.
- Make indexing, caching, querying, validation, and operational rules easy to locate.
- Keep docs aligned with the actual codebase, not planned behavior.
- Keep the knowledge base readable without turning it into a separate enforcement system.

## Update Rules

- Update `project-map.md` when module ownership or directory roles change.
- Update `architecture.md` when the top-down request flow changes.
- Update `business-logic/indexing-cache-query.md` when indexing, cache schema, storage layout, or query strategy changes.
- Update `operations/validation-and-hooks.md` when package-manager, CI, or hook flow changes.
- Prefer one canonical explanation per topic and trim stale duplication when you find it.
- Use lightweight spot checks when helpful, but do not add permanent knowledge-only validators or sync workflows.
