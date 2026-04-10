# Source Sync

## Purpose

- Keep the external guide-source repository synchronized before changing durable knowledge docs.
- Use that repository as structural reference, not as a place to copy blind text from.

## Local Config

- Copy `.agents/knowledge/source-repo.template.json` to `.agents/knowledge/source-repo.local.json`.
- Fill these fields:
  - `sourcePath`
  - `remote`
  - `branch`

## Sync Command

- `pnpm run knowledge:sync`
- Optional override:
  - `pnpm run knowledge:sync -- --source /absolute/path/to/repo --remote origin --branch main`

## What the Command Does

1. Reads the configured local source repo path.
2. Runs `git fetch <remote> <branch>`.
3. Runs `git pull --ff-only <remote> <branch>`.
4. Writes machine-local sync metadata to `.agents/knowledge/source-sync.local.json`.

## Notes

- The exact source repo path is intentionally local and not committed.
- The current repository has the sync mechanism wired, but the actual `army` source path still needs to be filled in locally.
