# Validation And Hooks

## Package Manager

- Use Corepack-managed pnpm only.
- The repository pins pnpm through `packageManager` in `package.json`.
- If Corepack is missing on the machine, install it first and then enable it.
- This package-manager requirement is for repository development and release work, not for end users launching `eye-mcp` through `npx`.

## Command Triggers

- `pnpm install` after `package.json`, `pnpm-lock.yaml`, or runtime dependency changes.
- `pnpm run doctor` after runtime boot, external binary assumptions (`rg`, `ctags`), TypeScript/Pyright semantic adapter assumptions, storage schema entrypoints, or server startup wiring changes.
- `pnpm docs:check` after edits in `apps/docs`, `content/docs`, docs workflows, or public docs routing/export behavior.
- `pnpm run lint` after TypeScript, JSON, YAML, or config edits that should satisfy Biome.
- `pnpm run typecheck` after public type, Zod schema, MCP contract, or cross-module API changes.
- `pnpm run test` after indexing, query, storage, project resolution, fallback search, or shared utility changes.
- `pnpm run test:e2e` after MCP tool registration, stdio runtime wiring, lazy `.eye` behavior, or scoped query behavior changes.
- `pnpm run test:fixtures:real` after index extraction, query behavior, or MCP contract changes that could drift on large real repositories.
- `pnpm run test:coverage` before release-facing handoff when code paths changed broadly.
- `pnpm run build` after entrypoint, package surface, or export changes and before release-facing handoff.
- `pnpm run validate` before broad handoff when a change spans multiple layers.
- `pnpm run validate && pnpm docs:check` before broad handoff or release-facing changes that should include the public docs export.
- `pnpm run release:npm:check` before publishing the npm package.
- `pnpm run release:npm` for the actual npm publish flow after local verification and npm auth are ready.

## Lefthook

- `prepare` runs `lefthook install` during dependency install.
- `pnpm exec lefthook install` restores hooks when needed.
- `pre-commit` runs `pnpm run lint`, `pnpm run typecheck`, and `pnpm run test`.
- There is no `pre-push` hook. Push-time validation runs only when invoked explicitly or in CI.

## CI

- `.github/workflows/ci.yml` runs on pushes to `main` and on pull requests.
- CI uses Node 25, enables Corepack, installs `ripgrep` and `universal-ctags`, runs `pnpm install --frozen-lockfile`, then runs `doctor`, `lint`, `typecheck`, `test`, explicit MCP E2E, coverage, `build`, and `docs:check`.
- CI uploads the `coverage/` artifact and sends `coverage/lcov.info` to Codecov with `disable_search: true`.
- `.github/workflows/real-fixtures.yml` is the heavy validation job. It checks out submodules recursively and runs `pnpm run test:fixtures:real`.

## Docs-Only Changes

- Public docs live in `apps/docs` and `content/docs`; internal evergreen knowledge lives in `.agents/knowledge/`.
- `README.md` and the public docs are user-facing package onboarding and should assume `npx -y eye-mcp` as the default entrypoint.
- Use `pnpm docs:check` as the repo-native docs gate for the public site.
- There is still no separate permanent validator just for the internal knowledge tree.
- For docs-only edits outside the public docs app, re-read the routed documents, verify important relative links and referenced files, and avoid adding permanent validation tooling just for the knowledge tree.

## Acceptance Rule

- Do not report completion while relevant `pnpm` commands are failing.
