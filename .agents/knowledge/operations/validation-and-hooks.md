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
- `pnpm run test:fixtures:real`
- `pnpm run test:coverage`
- `pnpm run build`
- `pnpm run validate`
- Pinned real fixtures under `tests/fixtures/real/**` are excluded from the default root lint/typecheck/test flows and only exercised through `pnpm run test:fixtures:real`.
- Knowledge docs are maintained as normal repository docs, without a dedicated validator or sync script.

## Lefthook

- `prepare` installs hooks automatically on dependency install.
- `pnpm exec lefthook install` restores hooks when needed.
- `pre-commit` runs the fast gate:
  - lint
  - typecheck
  - test
- `pre-push` runs the full gate:
  - validate
  - build

## Git Flow

- Commit or push only when the user explicitly asks for it.
- Do not report completion while leaving behind unreviewed validation failures in files you changed.

## CI

- GitHub Actions uses Node 25.
- CI enables Corepack, installs `ripgrep`, installs with `pnpm install --frozen-lockfile`, then runs doctor, lint, typecheck, test, explicit MCP E2E, coverage, and build.
- The main CI workflow requires the repository secret `CODECOV_TOKEN`.
- CI uploads the coverage artifact and sends `coverage/lcov.info` to Codecov with `disable_search: true`.
- Real-repository fixture validation lives in `.github/workflows/real-fixtures.yml` and runs `pnpm run test:fixtures:real` with recursive submodule checkout.

## Acceptance Rule

- Do not report completion unless the relevant pnpm commands have passed.
