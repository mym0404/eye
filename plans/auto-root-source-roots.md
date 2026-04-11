# Auto Root And Source Roots

## Goal

Remove env-based root selection, infer the project root from `cwd` when `projectRoot` is omitted, and bootstrap `.eye/config.json` with editable relative `sourceRoots`.

## Current State

- Root resolution previously depended on `EYE_ALLOWED_ROOTS` and `EYE_WORKSPACE_ROOT`.
- `.eye/config.json` only stored ignore and indexing settings.
- Index discovery always scanned the whole project root unless narrowed by `scopePath`.

## Scope And Non-goals

- In scope: root auto-detection, `sourceRoots` config bootstrap, indexing scope updates, MCP/runtime test updates, README and knowledge doc updates.
- Out of scope: multi-project runtime state, background indexing, or multi-root storage schema changes.

## Design

- Keep `projectRoot` as an optional explicit override on MCP tools.
- When `projectRoot` is omitted, walk upward from `cwd` and prefer `.eye/config.json`, workspace markers, then project markers.
- Add top-level `sourceRoots: string[]` to `.eye/config.json`.
- Infer `sourceRoots` from common layouts and write them on first runtime init.
- Limit indexing and ripgrep-backed fallback discovery to `sourceRoots`, but keep direct structure/source reads scoped to the resolved project root.

## Validation

- `pnpm run lint`
- `pnpm run typecheck`
- `pnpm run test`
- `pnpm run test:e2e`
- `pnpm run docs:validate`

## Progress Log

- Added root auto-detection from `cwd` with explicit `projectRoot` override.
- Added `sourceRoots` inference, config bootstrap, and search-root resolution.
- Updated indexing and fallback search to respect `sourceRoots`.
- Added fixture coverage for monorepo and root-level source layouts.
- Updated README and knowledge docs for the new contract.

## Decision Log

- `sourceRoots` stays as top-level config instead of an `indexing.includePaths` field.
- Workspace markers win over nested package markers during auto root detection.
- Existing read-only tools continue to work across the whole project root even when indexing is narrowed by `sourceRoots`.
