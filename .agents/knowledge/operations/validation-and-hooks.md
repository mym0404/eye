# Validation and Hooks

## Package Manager

- Use Corepack-managed pnpm only.
- The repository is pinned through `packageManager` in `package.json`.
- If Corepack is missing on the machine, install it first, then enable it.

## Standard Commands

- `pnpm install`
- `pnpm run doctor`
- `pnpm run lint`
- `pnpm run typecheck`
- `pnpm run test`
- `pnpm run test:e2e`
- `pnpm run test:coverage`
- `pnpm run docs:validate`
- `pnpm run build`
- `pnpm run validate`

## Lefthook

- `prepare` installs hooks automatically on dependency install.
- `pnpm exec lefthook install` restores hooks when needed.
- `pre-commit` runs the fast gate:
  - lint
  - typecheck
  - test
  - docs structure validation
- `pre-push` runs the full gate:
  - validate
  - build

## CI

- GitHub Actions uses Node 25.
- CI enables Corepack, installs `ripgrep`, installs with `pnpm install --frozen-lockfile`, then runs doctor, lint, typecheck, test, explicit MCP E2E, coverage, docs validation, and build.
- CI uploads the coverage artifact and sends `coverage/lcov.info` to Codecov.

## Acceptance Rule

- Do not report completion unless the relevant pnpm commands have passed.
