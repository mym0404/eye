# Knowledge Sync Router Refresh ExecPlan

## Status

- Completed.
- This document records the 2026-04-18 refresh of the root router and `.agents/knowledge/` sync.
- Current plan routing lives in `plans/ACTIVE.md`.

## Goal

Refresh the repository knowledge so the root router stays short, the knowledge home is easier to navigate, and the docs match the current shipped behavior.

## Current State

- Root `AGENTS.md` mixed routing, validation, and knowledge-maintenance meta rules.
- `.agents/knowledge/` already existed, but its index was not clickable and several repo-specific seams were not stated directly enough.
- Validation guidance was concrete, but command trigger wording was inconsistent across the router and deeper docs.

## Scope And Non-goals

- In scope: root router trim, clickable knowledge routing, current behavior sync, validation-command trigger cleanup, and `plans/ACTIVE.md` routing update.
- Out of scope: product code changes, README rewrite, and new permanent validators or automation.

## Design

- Keep root `AGENTS.md` short and repo-specific.
- Preserve the existing `.agents/knowledge/` tree instead of introducing a new taxonomy.
- Keep evergreen facts in `.agents/knowledge/` and transient execution state in `plans/`.

## Validation

- Re-read every changed knowledge document after editing.
- Run a one-off local check that referenced markdown links and routed files exist.

## Progress Log

- 2026-04-18: Audited the root router, package scripts, hooks, CI workflows, active plans, and the source files that define root resolution, `.eye` runtime behavior, indexing, and query flow.
- 2026-04-18: Rewrote `AGENTS.md` into a shorter router with repo-specific invariants and command-plus-trigger verification entries.
- 2026-04-18: Refreshed `.agents/knowledge/` docs with clickable routing, updated ownership maps, and current contracts for `.eye`, `sourceRoots`, and `scopePath`.
- 2026-04-18: Revalidated routing and recorded the completed plan in `plans/ACTIVE.md`.

## Decision Log

- 2026-04-18: Preserve the existing `.agents/knowledge/` structure because it already matches the repository shape well enough.
- 2026-04-18: Keep this pass focused on evergreen agent knowledge and plan routing rather than rewriting end-user README content.
