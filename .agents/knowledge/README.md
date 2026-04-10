# eye Knowledge Base

## Read First

- `project-map.md`
- `architecture.md`
- `business-logic/indexing-cache-query.md`
- `operations/validation-and-hooks.md`
- `operations/source-sync.md`

## Purpose

- Keep durable project knowledge out of the root `AGENTS.md`.
- Make indexing, caching, querying, validation, and operational rules easy to locate.
- Keep docs aligned with the actual codebase, not planned behavior.

## Update Rules

- Update `project-map.md` when module ownership or directory roles change.
- Update `architecture.md` when the top-down request flow changes.
- Update `business-logic/indexing-cache-query.md` when indexing, cache schema, storage layout, or query strategy changes.
- Update `operations/validation-and-hooks.md` when package-manager, CI, or hook flow changes.
- Run `pnpm run docs:validate` after editing knowledge docs.

## External Guide Source

- The reference guide source is synchronized through `pnpm run knowledge:sync`.
- Local path wiring is intentionally machine-local via `.agents/knowledge/source-repo.local.json`.
- The committed template is `.agents/knowledge/source-repo.template.json`.
