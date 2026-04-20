# Add Public Fumadocs Site

## TL;DR

Add a separate static-exported Fumadocs site for `eye` under a new workspace docs app, keep English as the only shipped language, style it as a clean documentation-first product site, and deploy it to GitHub Pages as the repository project site.
The finished shape is `README.md` as the GitHub entry surface, `apps/docs` as the web app, `content/docs` as the public MDX source, and GitHub Actions handling Pages artifact upload and deployment without changing the MCP server runtime.

## Context

- The user approved `Public docs only`, so the site must cover public installation, MCP tools, config, usage patterns, and FAQ, but must not publish `/.agents/knowledge/` or `plans/`.
- The repo currently has no web docs app, no GitHub Pages workflow, and no docs-specific build script. The root package is still a server-first TypeScript MCP package.
- `README.md` is already a strong English public-content source and should seed the first docs IA instead of creating a second copy source from scratch.
- The repo already separates public-facing content (`README.md`) from internal evergreen knowledge (`/.agents/knowledge/`) and transient planning (`plans/`). The docs site must preserve that boundary.
- `pnpm-workspace.yaml` currently only includes `"."`, so a dedicated docs app requires an explicit workspace expansion.
- Root validation and hooks are server-centric today: `pre-commit = lint + typecheck + test`, `pre-push = validate + build`, and CI only validates server surfaces.
- Official Fumadocs docs currently support Next.js manual installation, static export, and static built-in search. Official GitHub Pages docs require `actions/configure-pages`, `actions/upload-pages-artifact`, `actions/deploy-pages`, plus `pages: write` and `id-token: write` permissions. Official Next.js docs support static export for GitHub Pages-class static hosting.
- No further interview was needed after the user chose the public-only scope. The remaining decisions are internal implementation defaults, not unresolved user-visible product choices.

## Goal

Ship a public GitHub Pages documentation site for `eye` that is English-first, static-exported, visually polished, and clearly separated from internal agent-maintenance documentation.

## Non-Goals

- publishing `/.agents/knowledge/` as end-user docs
- publishing `plans/` or bundle evidence on the public site
- shipping multilingual routing or non-English content in the first release
- changing MCP tool contracts, server behavior, or package publish behavior
- replacing `README.md` as the repository landing page
- introducing a permanent docs-only validator that exists only for markdown hygiene

## Constraints

- Keep the MCP server runtime and root package publish surface intact.
- Add the docs site as a separate workspace app instead of folding Next/Fumadocs into the root server package.
- Keep `README.md` as the GitHub-facing entry document, but link it to the public docs site prominently.
- Use Fumadocs with Next.js static export and GitHub Pages-compatible output.
- Default language is `en`, with no extra locale routing in the first release.
- Support the GitHub Pages project-site subpath for `mym0404/eye`.
- Keep the existing root lockfile and workspace-install contract in CI and Pages jobs unless the bundle explicitly introduces a different installer boundary.
- Preserve the public/internal content boundary: `content/docs` may draw from `README.md`, but it must not expose internal knowledge or plan files.
- Follow a documentation-first UI system: light-mode-first, high readability, restrained accent usage, clean grid, responsive layout, clear code typography, visible focus states, and no decorative clutter.

## Commands

- Existing repo commands:
  - `pnpm install`
  - `pnpm run lint`
  - `pnpm run typecheck`
  - `pnpm run validate`
  - `pnpm run build`
- New root commands to add:
  - `pnpm docs:dev`
  - `pnpm docs:build`
  - `pnpm docs:check`
- App-local commands to expose through the workspace package:
  - `pnpm --filter eye-docs dev`
  - `pnpm --filter eye-docs build`
  - `pnpm --filter eye-docs typecheck`
- Static preview command for Pages-like verification:
  - `rm -rf .tmp-pages-preview && mkdir -p .tmp-pages-preview/eye && cp -R apps/docs/out/. .tmp-pages-preview/eye`
  - `python3 -m http.server 4300 --directory .tmp-pages-preview`

## Project Structure

- Current root:
  - `/src`: shipped MCP server runtime
  - `/tests`: server-focused fixtures and integration coverage
  - `/README.md`: public product documentation source
  - `/.agents/knowledge`: internal evergreen knowledge
  - `/.github/workflows`: CI and real-fixture verification only
- Target additions:
  - `/apps/docs`: Next.js + Fumadocs web app package
  - `/content/docs`: public MDX source for the docs site
  - `/.github/workflows/docs-pages.yml`: GitHub Pages deploy workflow
- Target repo integration:
  - workspace expansion in `/pnpm-workspace.yaml`
  - root docs commands in `/package.json`
  - ignore rules for `.next` and docs export output
  - repo-maintenance docs updates in `README.md`, `AGENTS.md`, and `/.agents/knowledge/operations/validation-and-hooks.md`
- Public IA contract:
  - top navigation exposes `Home`, `Docs`, and `GitHub`
  - home sections are `Hero`, `Quick Start`, `Core Tools`, `Client Setup`, and `FAQ`
  - docs sidebar groups are `Getting Started`, `Usage`, `Reference`, `Integrations`, and `FAQ`
  - the primary first-click path is `Get Started` -> first getting-started page -> tool reference page -> FAQ

## Testing Strategy

- Keep existing server validation intact.
- Add docs-app build verification without folding it into the server `build` script.
- Use a docs-specific root check command for the web app surface.
- Verify two browser paths:
  - local dev path on `/`
  - mounted static export preview path on `/eye/`
- Verify one happy-path IA flow and one failure-boundary flow:
  - happy path: home -> getting started -> tool reference -> FAQ
  - boundary path: confirm no internal `/.agents/knowledge` or `plans/` content appears in navigation or generated routes
- Verify the docs UX with concrete accessibility and interaction checks:
  - one visible `h1` per page, visible skip link, and visible keyboard focus on at least a nav link and the search trigger
  - search opens and closes by keyboard, mobile nav closes without trapping focus, and long code blocks stay readable without clipping content
- Treat GitHub Pages deployment as branch- and settings-sensitive:
  - if GitHub Pages source is configured for Actions and the workflow runs on `main`, deployment URL evidence is required
  - if that external setting is missing, stop and return with the exact missing setting instead of pretending deployment completed

## Success Criteria

- A public docs site exists under a dedicated docs workspace app and builds as a static export.
- The site ships only English public docs pages.
- The site visually reads as a polished documentation product, not a raw README mirror.
- Public IA covers install, project-root behavior, MCP client setup, core tools, prompt patterns, and FAQ.
- The root repo keeps its current server package and validation surface without hidden behavior changes.
- GitHub Actions can deploy the static docs artifact to GitHub Pages for the repository project site.

## Open Questions

- None

## Work Objectives

- establish a separate docs app boundary that does not contaminate the server package
- scaffold a Fumadocs + Next.js static-export app that is Pages-compatible from the start
- turn the current README into a structured public docs IA
- apply a clean documentation-first visual system and responsive layout
- wire repo-native scripts, ignore rules, hooks, and knowledge docs around the new docs surface
- add a dedicated GitHub Pages deployment workflow and final deployment proof path

## Verification Strategy

- Prefer narrow docs-app verification before broad repo verification.
- Do not overload the root `build` script with docs responsibilities; keep docs build on explicit docs commands.
- Use `pnpm --filter eye-docs build` as the first meaningful proof that the app, content source, and static export are wired correctly.
- Use browser checks only when the app is already bootable, and make them deterministic with explicit route, viewport, and success signals.
- Use existing `pnpm run validate` unchanged as the server broad gate unless a task explicitly changes that contract.
- Use `pnpm docs:check` as the docs broad gate after the docs scripts exist.
- Keep deployment verification split:
  - local/static preview proves Pages-compatible output under `/eye/`
  - CI proof confirms the docs validation step is wired into normal repository checks
  - GitHub Pages workflow proof confirms artifact upload and deploy behavior

## Execution Strategy

- Start by creating the workspace boundary and docs app shell before touching full public content.
- Build the public content IA after the shell exists so route ownership and content ownership do not overlap.
- Add visual polish and static search only after the docs source and route tree exist.
- Integrate repo scripts and maintenance docs after the docs app is stable enough to build consistently.
- Add GitHub Actions deployment only after local static export and root integration paths are already deterministic.
- End with a final validation wave that proves server safety, docs build health, Pages-like preview correctness, and deployment readiness.

## Parallel Waves

- Wave 1:
  - `T1` only. Workspace boundary and artifact policy must exist before the app package can land cleanly.
- Wave 2:
  - `T2` only. The shell owns app scaffolding, source loader, and the minimal buildable docs surface.
- Wave 3:
  - `T3` after `T2`.
- Wave 4:
  - `CP1` after `T3`.
- Wave 5:
  - `T4` after `CP1`.
- Wave 6:
  - `T5` after `T4`.
- Wave 7:
  - `T6` after `T5`.
- Wave 8:
  - `CP2` after `T4`, `T5`, and `T6`.
- Wave 9:
  - `T7` final verification after `CP2`.

## Artifact Graph

- `T1`
  - `requires`: None
  - `unlocks`: `T2`
  - `blocked_by`: None
  - `ready_when`: workspace expansion path and ignore policy are not yet present
- `T2`
  - `requires`: `T1`
  - `unlocks`: `T3`
  - `blocked_by`: missing workspace boundary
  - `ready_when`: `T1` is done and no docs app exists yet
- `T3`
  - `requires`: `T2`
  - `unlocks`: `CP1`
  - `blocked_by`: missing docs shell and route foundation
  - `ready_when`: `T2` is done and the public docs source tree still does not cover the approved public-docs scope
- `CP1`
  - `requires`: `T2`, `T3`
  - `unlocks`: `T4`
  - `blocked_by`: incomplete docs app shell or public IA
  - `ready_when`: both the app shell and public content tree build together
- `T4`
  - `requires`: `CP1`
  - `unlocks`: `T5`
  - `blocked_by`: unstable content/layout foundation
  - `ready_when`: docs routes and content exist and visual work can land on real pages
- `T5`
  - `requires`: `T4`
  - `unlocks`: `T6`
  - `blocked_by`: docs app still lacks stable build commands and product-facing repo integration points
  - `ready_when`: the docs app builds locally and the repo integration contract can be updated around it
- `T6`
  - `requires`: `T5`
  - `unlocks`: `CP2`
  - `blocked_by`: docs scripts and static export path not yet stable
  - `ready_when`: local docs build is deterministic enough to be consumed by CI and Pages deployment
- `CP2`
  - `requires`: `T4`, `T5`, `T6`
  - `unlocks`: `T7`
  - `blocked_by`: incomplete repo integration or deployment automation
  - `ready_when`: UI, root integration, and Pages workflow all exist in one carried-forward diff
- `T7`
  - `requires`: `CP2`
  - `unlocks`: bundle completion
  - `blocked_by`: unresolved checkpoint findings
  - `ready_when`: the full docs/app/workflow diff is stable enough for broad validation and deployment proof

## Checkpoint Plan

- `CP1` checks that the docs workspace, app shell, and public IA are aligned before visual design and repo integration begin.
- `CP2` checks that the finished docs UX, repo command surface, and GitHub Pages automation all describe the same shipped contract before final verification.

## Final Verification Wave

- Run existing server broad validation:
  - `pnpm run validate`
- Run docs broad validation:
  - `pnpm docs:check`
- Run local dev browser verification:
  - start `pnpm docs:dev`
  - open `http://127.0.0.1:3000/`
  - verify the `Home` hero and `Quick Start` sections, one getting-started page, one tool-reference page, one FAQ page, visible skip link, search open/close by keyboard, mobile nav close behavior, and no internal-doc leakage
- Run Pages-like static preview verification:
  - build docs with the GitHub Pages base path
  - copy `apps/docs/out` into `.tmp-pages-preview/eye`
  - serve `.tmp-pages-preview` through `python3 -m http.server`
  - open `http://127.0.0.1:4300/eye/`
  - verify route loading, asset loading, home-logo navigation, and static search behavior under the repo subpath
- Run deployment verification:
  - confirm the normal `ci` workflow includes and runs the docs validation step, or record the exact blocker if no remote run exists yet
  - if GitHub Pages source is set to Actions and the workflow is running from `main`, confirm a successful `docs-pages` workflow run and capture the deployed URL
  - if the repo setting or branch state blocks deployment, stop and return with the exact external blocker recorded in evidence

## Sync/Reconcile Rules

- During execution, the executor may only mutate source files needed by the active task, `notes.md`, bundle-local `evidence/`, and the top `Status Board` plus task `Status` and `Evidence` fields in `tasks.md`.
- If real repo state contradicts the task contract, the executor must record the mismatch in `notes.md`, return the same bundle for planner repair, and continue from the repaired bundle instead of improvising.
- After every task state change, reread `tasks.md`, recompute the ready set, and continue in the same turn unless the bundle is complete or a real blocker remains.
- Do not widen public scope from `Public docs only` during execution. Deep technical docs remain out of scope unless the bundle is explicitly replanned.
