# Pnpm Lefthook Knowledge Router ExecPlan

## Status

- Completed.
- This document records the migration to Corepack-managed pnpm, Lefthook, and the router-style knowledge base.
- Current plan routing lives in `plans/ACTIVE.md`.

# Goal

Move the repository from npm to Corepack-managed pnpm, enforce validation on commit/push through Lefthook, and replace the single-file AGENTS guidance with a router-style knowledge base under `.agents/knowledge/`.

# Current State

- The repository still uses `package-lock.json`, npm-based docs, and npm-based CI commands.
- There is no Git hook manager installed.
- `AGENTS.md` is a single document and there is no `.agents/knowledge/` tree.
- The requested external reference repo (`army` / `꿀빨자닷컴`) has not yet been located locally, so the sync target must stay configurable until the exact path is provided.

# Scope and Non-goals

- In scope:
  - Corepack + pnpm adoption
  - pnpm lockfile generation
  - Lefthook install/configuration
  - CI and docs migration from npm to pnpm
  - Router-style AGENTS + `.agents/knowledge/` structure
  - Knowledge docs for indexing, caching, querying, validation, and sync workflow
- Out of scope:
  - New product features
  - Silent assumptions about the missing external repo path
  - Destructive sync operations against another repository

# Design

- Pin pnpm through `packageManager` in `package.json`.
- Add `prepare` so installs re-install Lefthook automatically.
- Use fast validation on `pre-commit` and full validation on `pre-push`.
- Turn root `AGENTS.md` into a concise router that points to `.agents/knowledge/`.
- Keep source-repo sync explicit through a documented path and a small checked-in sync command.

# Milestones

1. Package manager migration
   - Add Corepack/pnpm metadata.
   - Generate `pnpm-lock.yaml`.
   - Remove `package-lock.json`.
   - Validation: install succeeds with pnpm, `pnpm run validate`, `pnpm run build`.

2. Hook and CI migration
   - Add Lefthook config and install path.
   - Switch CI to pnpm.
   - Validation: `pnpm exec lefthook install`, `pnpm exec lefthook run pre-commit`, `pnpm exec lefthook run pre-push`.

3. Knowledge router migration
   - Replace root AGENTS with router guidance.
   - Add `.agents/knowledge/` docs for architecture, business logic, validation, project map, and sync instructions.
   - Validation: document tree exists, AGENTS points to the right files, knowledge files reflect current code.

4. Final verification
   - Re-run validation and inspect document structure.
   - Validation: `pnpm run validate`, `pnpm run build`, knowledge tree listing.

# Validation

- `pnpm install`
- `pnpm run doctor`
- `pnpm run lint`
- `pnpm run typecheck`
- `pnpm run test`
- `pnpm run test:coverage`
- `pnpm run build`
- `pnpm exec lefthook install`
- `pnpm exec lefthook run pre-commit`
- `pnpm exec lefthook run pre-push`

# Progress Log

- 2026-04-10: Created execution plan. External `army` repo path still unresolved.
- 2026-04-10: Switched the repository to Corepack-managed pnpm and generated `pnpm-lock.yaml`.
- 2026-04-10: Added Lefthook with `pre-commit` and `pre-push` validation gates.
- 2026-04-10: Replaced the root AGENTS file with a router and added `.agents/knowledge/` docs for project map, architecture, business logic, validation, and source sync.
- 2026-04-10: Added `knowledge:sync` and `docs:validate` scripts.
- 2026-04-10: Validation passed with `pnpm run validate`, `pnpm run build`, `pnpm exec lefthook run pre-commit --force --all-files`, and `pnpm exec lefthook run pre-push`.

# Decision Log

- 2026-04-10: Keep the external knowledge-source sync target configurable until the user provides the exact local path.
- 2026-04-10: Use router-style root AGENTS plus dedicated `.agents/knowledge/` docs instead of expanding a single large AGENTS file.
- 2026-04-10: Exclude `src/scripts/**` from coverage thresholds because they are CLI entrypoints; keep the business-logic modules inside coverage.

# Follow-ups

- Wire the exact `army` repo path into the sync flow after the user provides the location.
