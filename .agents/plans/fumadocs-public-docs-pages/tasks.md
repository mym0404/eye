# Add Public Fumadocs Site

This file is the only live progress record for this bundle.

## Status Board

- `Doing`: None
- `Ready Now`: None
- `Blocked`: None
- `Todo`: None
- `Done`: T1 - Expand the workspace boundary for a docs app; T2 - Scaffold the Fumadocs app shell; T3 - Author the public docs IA and MDX source; CP1 - Reconcile the app shell and public IA; T4 - Apply the documentation-first visual system; T5 - Integrate root scripts, hooks, and maintenance docs; T6 - Add GitHub Pages automation; CP2 - Reconcile the shipped docs contract; T7 - Run the final validation and deployment wave

## Tasks

### T1 - Expand the workspace boundary for a docs app
- `ID`: T1
- `Slice`: Workspace boundary
- `Status`: Done
- `Depends On`: None
- `Start When`: The repo still has a single-package workspace and no docs-app artifact policy.
- `Files`: primary: `pnpm-workspace.yaml`, `.gitignore`; generated/incidental: N/A
- `Context`: The docs app must become a separate workspace surface before any Next/Fumadocs package can land without colliding with the root server package.
- `Produces`: Workspace inclusion rules for the docs app and ignore rules for Next/static-export artifacts.
- `Must Do`: Keep the root server package as a first-class workspace member; ignore `.next` and static export output without hiding committed content sources.
- `Must Not Do`: Do not change root `build`, `validate`, or package publish semantics in this task; do not add app scaffolding files yet.
- `Implementation Notes`: Expand the workspace to include a dedicated docs app package path, keep the root package included explicitly, and add ignore entries for docs build outputs such as `apps/docs/.next` and `apps/docs/out`.
- `Verification Strategy`: 1. Re-read `pnpm-workspace.yaml` and confirm both `"."` and the docs app path are declared. 2. Re-read `.gitignore` and confirm the new entries cover only generated docs artifacts such as `apps/docs/.next` and `apps/docs/out`. 3. Search for the added paths with `rg -n "apps/docs|\\.next|out" pnpm-workspace.yaml .gitignore`. 4. If the files change but the workspace still only declares `"."` or the ignore rules hide source content, treat the task as incomplete. 5. Record the resulting workspace and ignore diff in `evidence/t1-workspace-boundary.txt`.
- `Acceptance Criteria`: The repo can host a separate docs package without polluting tracked generated artifacts or redefining the root server package.
- `Definition of Done`: Workspace boundary verification passes, evidence is recorded, task `Status` becomes `Done`, the top `Status Board` is refreshed, and `tasks.md` reread confirms persistence.
- `Evidence`: evidence/t1-workspace-boundary.txt
- `Reopen When`: The docs app path moves or new generated docs artifacts appear outside the ignored surface.
- `Size`: S

### T2 - Scaffold the Fumadocs app shell
- `ID`: T2
- `Slice`: Docs app core
- `Status`: Done
- `Depends On`: T1
- `Start When`: T1 is `Done` and there is still no buildable docs workspace package.
- `Files`: primary: `apps/docs/package.json`, `apps/docs/tsconfig.json`, `apps/docs/next.config.mjs`, `apps/docs/postcss.config.mjs`, `apps/docs/source.config.ts`, `apps/docs/lib/source.ts`, `apps/docs/app/layout.tsx`, `apps/docs/app/page.tsx`, `apps/docs/app/docs/layout.tsx`, `apps/docs/app/docs/[[...slug]]/page.tsx`, `apps/docs/app/global.css`, `pnpm-lock.yaml`; generated/incidental: `apps/docs/.next/**`, `apps/docs/out/**`
- `Context`: The repo needs a separate, buildable Next.js + Fumadocs shell before public content, design polish, and deployment automation can be layered on top.
- `Produces`: A buildable docs app with static export enabled, repo-subpath-aware base path handling, English root layout, and a minimal docs route shell ready to consume public content.
- `Must Do`: Follow the official Fumadocs manual-install shape for Next.js, use static export, set `html lang="en"`, and wire the app so GitHub Pages project-site paths are supported from the start.
- `Must Not Do`: Do not import internal `/.agents/knowledge/` or `plans/` content; do not wire deployment workflow files here; do not add product-level visual polish beyond a clean shell.
- `Implementation Notes`: Use `apps/docs` as the app package and `content/docs` as the future MDX source root, but keep public-content authoring out of this task. Configure `output: 'export'`, Pages-compatible base path handling, and the Fumadocs source loader. Keep the home page and docs route shell minimal but real enough for `T3` to attach the public IA cleanly.
- `Verification Strategy`: 1. Run `pnpm --filter eye-docs build`. 2. Success signal: the command exits `0`, `apps/docs/out` is emitted, and the exported shell includes the site home plus a reachable docs route shell. 3. Start `pnpm --filter eye-docs dev -- --hostname 127.0.0.1 --port 3000`. 4. Open `http://127.0.0.1:3000/` at `1440x900`. 5. Verify the home page renders, the docs route shell is reachable, and the root HTML still declares `lang="en"`. 6. If the build exits `0` but `out` is missing or the docs route shell returns `404`, treat the task as incomplete. 7. Store logs and one home screenshot in `evidence/t2-app-shell/`.
- `Acceptance Criteria`: A separate English docs app builds as a static export and serves a real home page plus docs-route shell locally.
- `Definition of Done`: App-shell verification passes, evidence is recorded, task `Status` becomes `Done`, the top `Status Board` is refreshed, and `tasks.md` reread confirms persistence.
- `Evidence`: evidence/t2-app-shell/
- `Reopen When`: Static export, base-path handling, or root English layout stops working.
- `Size`: M

### T3 - Author the public docs IA and MDX source
- `ID`: T3
- `Slice`: Public content
- `Status`: Done
- `Depends On`: T2
- `Start When`: T2 is `Done` and the public docs source tree still does not cover the approved public-docs scope.
- `Files`: primary: `content/docs/meta.json`, `content/docs/index.mdx`, `content/docs/getting-started/*.mdx`, `content/docs/reference/*.mdx`, `content/docs/integrations/*.mdx`, `content/docs/faq.mdx`, `README.md`; generated/incidental: N/A
- `Context`: The approved scope is public docs only, so the site needs a real user-facing IA built from the current README without leaking internal maintenance material.
- `Produces`: Structured MDX pages for install, root detection/config, tool reference, client integration, prompt patterns, and FAQ, plus a README entry link to the site.
- `Must Do`: Reuse and reshape public content from `README.md`; keep copy in English; make the page tree explicit in `meta.json`; keep README as the GitHub landing page but add a prominent docs-site link.
- `Must Not Do`: Do not publish deep internal architecture, indexing internals, CI internals, or plan/bundle content; do not duplicate the README verbatim page-for-page when a more navigable split is available.
- `Implementation Notes`: Break the public content into a compact IA: `Getting Started`, `Usage`, `Reference`, `Integrations`, `FAQ`. The home page should expose `Hero`, `Quick Start`, `Core Tools`, `Client Setup`, and `FAQ` entry points, and the primary click path should be `Get Started` -> first getting-started page -> tool reference -> FAQ. Use the README as the source of truth for public explanations and convert long sections into shorter task-oriented pages.
- `Verification Strategy`: 1. Run `pnpm --filter eye-docs build`. 2. Start `pnpm --filter eye-docs dev -- --hostname 127.0.0.1 --port 3000`. 3. Open `http://127.0.0.1:3000/docs` at `1440x900`. 4. Navigate to one page from each IA section and confirm the nav tree shows `Getting Started`, `Usage`, `Reference`, `Integrations`, and `FAQ`. 5. Re-read `README.md` and confirm a prominent docs-site entry link is present. 6. Search the generated route tree and navigation for `knowledge`, `.agents`, and `plans`; success signal is that none of those internal surfaces are user-visible routes. 7. If the build exits `0` but a required IA section is missing, the README entry link is absent, or an internal route appears, keep the task open. 8. Save route, nav, and README-link evidence to `evidence/t3-public-ia/`.
- `Acceptance Criteria`: The docs site exposes a complete public-only IA derived from current public content, and README points users to the site.
- `Definition of Done`: Public-content verification passes, evidence is recorded, task `Status` becomes `Done`, the top `Status Board` is refreshed, and `tasks.md` reread confirms persistence.
- `Evidence`: evidence/t3-public-ia/
- `Reopen When`: Public scope changes, internal content leaks into the site, or README and site entry guidance drift apart.
- `Size`: M

### CP1 - Reconcile the app shell and public IA
- `ID`: CP1
- `Slice`: Checkpoint
- `Status`: Done
- `Depends On`: T2, T3
- `Start When`: T2 and T3 are both `Done`.
- `Files`: primary: `pnpm-workspace.yaml`, `.gitignore`, `apps/docs/**`, `content/docs/**`, `README.md`, `pnpm-lock.yaml`; generated/incidental: `apps/docs/out/**`, `apps/docs/.next/**`
- `Context`: Before visual work starts, the docs app shell and the public IA must already agree on scope, route structure, and static-export behavior.
- `Produces`: A reconciled docs foundation and updated notes.
- `Must Do`: Confirm the app shell still builds after real public content is added; confirm public-only scope remains intact.
- `Must Not Do`: Do not introduce new product scope or deployment work during the checkpoint.
- `Implementation Notes`: Re-read the carried-forward diff, then verify one home route, one docs route, and one internal-leak boundary.
- `Verification Strategy`: 1. Run `pnpm --filter eye-docs build`. 2. Start `pnpm --filter eye-docs dev -- --hostname 127.0.0.1 --port 3000`. 3. Open `http://127.0.0.1:3000/` at `1440x900`. 4. Visit the home page and one page under `/docs`. 5. Success signal: both routes render, the nav tree shows only public sections, and the README entry link still points users into the same public IA. 6. If the app still builds but the IA now contradicts the approved public scope, treat the checkpoint as incomplete. 7. Save the checkpoint log and screenshots under `evidence/cp1-foundation/`.
- `Acceptance Criteria`: The docs foundation is stable enough for visual customization without reopening content or scope decisions.
- `Definition of Done`: Checkpoint verification passes, evidence is recorded, task `Status` becomes `Done`, the top `Status Board` is refreshed, and `tasks.md` reread confirms persistence.
- `Evidence`: evidence/cp1-foundation/
- `Reopen When`: Later work breaks static export, route shape, or the public-only scope boundary.
- `Size`: S

### T4 - Apply the documentation-first visual system
- `ID`: T4
- `Slice`: UI and UX
- `Status`: Done
- `Depends On`: CP1
- `Start When`: CP1 is `Done` and the docs app still lacks the approved documentation-first visual system.
- `Files`: primary: `apps/docs/app/global.css`, `apps/docs/app/layout.tsx`, `apps/docs/app/page.tsx`, `apps/docs/app/layout.config.tsx`, `apps/docs/components/**`, `apps/docs/public/**`; generated/incidental: `apps/docs/out/**`, `apps/docs/.next/**`, `.tmp-pages-preview/**`
- `Context`: The content structure now exists, so the next task is to make the site feel like a polished product docs experience rather than a placeholder scaffold.
- `Produces`: A clean Swiss/minimal docs UI, responsive home page, readable docs layout, typography system, accent color system, visible focus states, and static-search wiring that works with export.
- `Must Do`: Use a restrained docs-first design system: light-mode-first, neutral background, single blue accent, `IBM Plex Sans` for UI/body, `JetBrains Mono` for code accents only, max readable content width, restrained border radius, subtle border-first surfaces, visible keyboard focus, visible skip link, and static-export-compatible search if search is shipped.
- `Must Not Do`: Do not default to an OLED dark theme; do not add decorative gradients, oversized hero gimmicks, or cyberpunk styling; do not rely on server-only search; do not add `app/api` search routes.
- `Implementation Notes`: Follow a Swiss/minimal layout with strong spacing and hierarchy. Keep the home page intentional but restrained: concise hero, quick-start cards, tool-reference entry points, and FAQ/support CTA. Use Fumadocs static search mode or a build-time generated client index if search is enabled so Pages deployment stays static.
- `Verification Strategy`: 1. Start `pnpm --filter eye-docs dev -- --hostname 127.0.0.1 --port 3000`. 2. Open the home page at `1440x900` and confirm `Hero`, `Quick Start`, `Core Tools`, `Client Setup`, and `FAQ` sections all render. 3. Open a long reference page at `1440x900` and confirm the docs nav, TOC, and code blocks remain readable without horizontal clipping of the main layout. 4. Open a docs page at `768x1024` and confirm collapsed navigation, search access, and current-page highlighting remain usable. 5. Open a docs page at `390x844` and confirm the mobile nav drawer opens and closes, long code blocks scroll safely, and the sticky header does not cover the page title. 6. Verify one visible `h1`, a visible skip link, visible focus on both a nav link and the search trigger, and keyboard open/close behavior for search. 7. Run `pnpm --filter eye-docs build`. 8. Create `.tmp-pages-preview/eye` from `apps/docs/out`, serve `.tmp-pages-preview` with `python3 -m http.server 4300 --directory .tmp-pages-preview`, and open `http://127.0.0.1:4300/eye/`. 9. Confirm CSS and JS assets load under `/eye/`, home-logo navigation works, and the visual shell matches the dev build closely enough to preserve readability and interaction affordances. 10. If the visual design looks right in dev but breaks under export, the `/eye/` asset paths fail, or keyboard focus and skip-link behavior are missing, keep the task open. 11. Save screenshots for desktop home, desktop reference, tablet docs, mobile docs, and the `/eye/` export preview in `evidence/t4-visual-system/`.
- `Acceptance Criteria`: The site looks like a clean public docs product across desktop and mobile, and the shipped visual features survive static export.
- `Definition of Done`: Visual verification passes, evidence is recorded, task `Status` becomes `Done`, the top `Status Board` is refreshed, and `tasks.md` reread confirms persistence.
- `Evidence`: evidence/t4-visual-system/
- `Reopen When`: Later changes regress readability, responsive behavior, focus visibility, or static-search/export compatibility.
- `Size`: M

### T5 - Integrate root scripts, hooks, and maintenance docs
- `ID`: T5
- `Slice`: Repo integration
- `Status`: Done
- `Depends On`: T4
- `Start When`: T4 is `Done` and the repo still has no stable docs commands or maintenance guidance for the new surface.
- `Files`: primary: `package.json`, `lefthook.yml`, `AGENTS.md`, `.agents/knowledge/project-map.md`, `.agents/knowledge/operations/validation-and-hooks.md`, `.agents/knowledge/README.md`; generated/incidental: `pnpm-lock.yaml`
- `Context`: Once the docs UX is stable, the root repo needs explicit commands and maintenance guidance so the new surface is not a hidden sidecar.
- `Produces`: Root docs scripts, hook integration, and updated AGENTS plus evergreen maintenance docs that explain the new docs app surface and its validation contract.
- `Must Do`: Add root docs commands without redefining the root server `build` script; add `docs:check` as the repo-native docs gate; update hook policy only where the docs surface truly needs protection; keep AGENTS and evergreen maintenance docs aligned with the new docs validation surface.
- `Must Not Do`: Do not move server validation responsibilities into docs commands; do not expose internal knowledge pages publicly; do not add a docs-only permanent validator that exists only for markdown linting.
- `Implementation Notes`: Add `docs:dev`, `docs:build`, and `docs:check` at the root. Keep `build` as the server build. Extend `pre-push` with the docs gate, but leave `pre-commit` lightweight. Update `AGENTS.md` and the knowledge docs so the repo map and validation guide all describe the docs app accurately.
- `Verification Strategy`: 1. Run `pnpm docs:check`. 2. Run `pnpm run lint`. 3. Review `lefthook.yml` and confirm pre-push now covers the docs gate without changing pre-commit scope. 4. Re-read `AGENTS.md` and the knowledge docs and confirm the docs validation contract matches the real root commands. 5. If `docs:check` passes but the root commands still hide docs build behavior or the maintenance docs contradict the real setup, treat the task as incomplete. 6. Save logs and command output under `evidence/t5-repo-integration/`.
- `Acceptance Criteria`: The docs app has explicit root commands and the repo’s agent-facing plus evergreen maintenance docs accurately describe the new surface.
- `Definition of Done`: Repo-integration verification passes, evidence is recorded, task `Status` becomes `Done`, the top `Status Board` is refreshed, and `tasks.md` reread confirms persistence.
- `Evidence`: evidence/t5-repo-integration/
- `Reopen When`: Root docs commands drift from the actual app behavior or maintenance docs stop matching the repo.
- `Size`: M

### T6 - Add GitHub Pages automation
- `ID`: T6
- `Slice`: Deployment automation
- `Status`: Done
- `Depends On`: T5
- `Start When`: T5 is `Done` and there is still no GitHub Pages workflow for the docs export.
- `Files`: primary: `.github/workflows/docs-pages.yml`, `.github/workflows/ci.yml`, `apps/docs/next.config.mjs`, `package.json`; generated/incidental: `apps/docs/out/**`, `coverage/**` if CI artifacts are refreshed
- `Context`: Local docs build and repo commands are now stable, so deployment automation can be added without guessing at the app’s output contract.
- `Produces`: A GitHub Pages workflow that builds the docs app, uploads the static artifact, and deploys it from `main`, plus CI coverage for the docs build path.
- `Must Do`: Use `actions/configure-pages`, `actions/upload-pages-artifact`, and `actions/deploy-pages`; declare `pages: write` and `id-token: write`; build the docs app with the repo subpath enabled; keep docs build verification in normal CI as a separate step from server validation; keep the Pages job aligned with the existing root lockfile and workspace install contract unless the bundle explicitly changes that installer boundary.
- `Must Not Do`: Do not fold Pages deployment into `ci.yml`; do not invent a hidden docs-only install path without documenting it; do not assume Pages settings are already configured correctly.
- `Implementation Notes`: Add a dedicated `docs-pages.yml` workflow triggered from `main` and `workflow_dispatch`. Keep `ci.yml` responsible for validating that docs build still works, but reserve artifact upload and deploy for the Pages workflow. Build with the GitHub Pages base path so the exported artifact matches the project-site URL shape. Unless the bundle explicitly changes installer scope, the Pages workflow should install the workspace the same way the root repo already does.
- `Verification Strategy`: 1. Run `pnpm docs:build` locally with the GitHub Pages base-path mode enabled. 2. Confirm `apps/docs/out` contains the repo-subpath-aware output. 3. Inspect the workflow YAML for `pages: write`, `id-token: write`, `github-pages` environment, artifact upload, deploy sequencing, and the install command used by the Pages job. 4. Inspect `ci.yml` and confirm a named docs validation step exists with the same command surface used locally. 5. Reproduce that CI docs command locally and record the command parity in evidence. 6. If working on `main` with Pages source configured for Actions, run or observe both the `ci` docs validation step and the `docs-pages` workflow and confirm successful artifact upload and deploy. 7. If the workflow is correct but repo settings, branch state, or lack of a remote run blocks deployment or CI proof, stop and return with that exact blocker captured in evidence. 8. Save workflow evidence under `evidence/t6-pages-workflow/`.
- `Acceptance Criteria`: The repo contains a complete GitHub Pages deployment path for the docs site and normal CI also validates the docs build.
- `Definition of Done`: Deployment-automation verification passes or an external Pages setting blocker is recorded explicitly, evidence is recorded, task `Status` becomes `Done`, the top `Status Board` is refreshed, and `tasks.md` reread confirms persistence.
- `Evidence`: evidence/t6-pages-workflow/
- `Reopen When`: The exported docs output path, Pages permissions, or CI/docs build contract changes.
- `Size`: M

### CP2 - Reconcile the shipped docs contract
- `ID`: CP2
- `Slice`: Checkpoint
- `Status`: Done
- `Depends On`: T4, T5, T6
- `Start When`: T4, T5, and T6 are all `Done`.
- `Files`: primary: `pnpm-workspace.yaml`, `.gitignore`, `package.json`, `README.md`, `lefthook.yml`, `AGENTS.md`, `.github/workflows/ci.yml`, `.github/workflows/docs-pages.yml`, `apps/docs/**`, `content/docs/**`, `.agents/knowledge/README.md`, `.agents/knowledge/project-map.md`, `.agents/knowledge/operations/validation-and-hooks.md`, `pnpm-lock.yaml`; generated/incidental: `apps/docs/out/**`, `apps/docs/.next/**`
- `Context`: Before the final wave, the docs UX, root integration, and deployment automation must all describe the same shipped product surface.
- `Produces`: A reconciled full diff and updated notes confirming the public-docs contract is coherent.
- `Must Do`: Re-read the full carried-forward docs surface; confirm the public/internal boundary still holds; confirm root commands, CI, and Pages workflow align with the actual docs app.
- `Must Not Do`: Do not add new pages, new design scope, or new deployment surfaces during the checkpoint.
- `Implementation Notes`: Treat this as the last contract sanity pass before final verification. The point is alignment, not new feature work.
- `Verification Strategy`: 1. Run `pnpm docs:check`. 2. Run `pnpm run lint`. 3. Review the full carried-forward diff named in `Files`. 4. Success signal: docs build passes, the root integration text matches the repo, `AGENTS.md` matches the docs validation surface, and the Pages workflow still targets the same artifact shape the local export produces. 5. If commands pass but the maintenance docs or workflow assumptions still contradict the app, keep the checkpoint open. 6. Store the reconciliation notes in `evidence/cp2-shipped-contract/`.
- `Acceptance Criteria`: The shipped docs UX, repo command surface, and deployment automation are internally consistent.
- `Definition of Done`: Checkpoint verification passes, evidence is recorded, task `Status` becomes `Done`, the top `Status Board` is refreshed, and `tasks.md` reread confirms persistence.
- `Evidence`: evidence/cp2-shipped-contract/
- `Reopen When`: Later work makes the docs app, root commands, or Pages workflow disagree again.
- `Size`: S

### T7 - Run the final validation and deployment wave
- `ID`: T7
- `Slice`: Final verification
- `Status`: Done
- `Depends On`: CP2
- `Start When`: CP2 is `Done` and the full docs/workflow diff is stable.
- `Files`: primary: `package.json`, `README.md`, `lefthook.yml`, `AGENTS.md`, `.github/workflows/ci.yml`, `.github/workflows/docs-pages.yml`, `apps/docs/**`, `content/docs/**`, `.agents/knowledge/README.md`, `.agents/knowledge/project-map.md`, `.agents/knowledge/operations/validation-and-hooks.md`, `pnpm-workspace.yaml`, `.gitignore`, `pnpm-lock.yaml`; generated/incidental: `apps/docs/out/**`, `apps/docs/.next/**`, `.tmp-pages-preview/**`, `coverage/**`
- `Context`: Bundle completion requires proof that the docs site, repo integration, and deployment path all work together without regressing the existing server validation contract.
- `Produces`: Final validation evidence for the public docs site and GitHub Pages deployment path.
- `Must Do`: Run both the existing server broad gate and the new docs broad gate; verify dev and Pages-like browser flows; capture a real deployment outcome if GitHub settings and branch state allow it.
- `Must Not Do`: Do not report deployment complete if the Pages workflow never ran or GitHub Pages source is not configured for Actions; do not skip the static preview path just because local dev works.
- `Implementation Notes`: Final success is server validation + docs validation + dev browser proof + mounted `/eye/` export preview + CI docs-step proof + deployment proof. If external GitHub settings or branch state block the last step, record that blocker explicitly and stop instead of inventing success.
- `Verification Strategy`: 1. Run `pnpm run validate`. 2. Run `pnpm docs:check`. 3. Start `pnpm docs:dev`, open `http://127.0.0.1:3000/` at `1440x900`, visit the home page and confirm `Hero`, `Quick Start`, `Core Tools`, `Client Setup`, and `FAQ`. 4. From the same dev server, follow the primary path `Get Started` -> first getting-started page -> tool reference -> FAQ and confirm the expected route loads at each step. 5. Open a docs page at `390x844` and confirm mobile nav open/close, visible skip link, visible focus on a nav link and search trigger, one visible `h1`, and safe long-code-block scrolling. 6. Build the Pages artifact with the repo subpath enabled, copy `apps/docs/out` into `.tmp-pages-preview/eye`, serve `.tmp-pages-preview` via `python3 -m http.server 4300 --directory .tmp-pages-preview`, open `http://127.0.0.1:4300/eye/`, and verify route loading, asset loading, home-logo navigation, and static search. 7. Confirm the normal `ci` workflow includes and runs the docs validation step, or store the exact blocker if no remote `ci` run exists yet. 8. If on `main` with GitHub Pages configured for Actions, confirm a successful `docs-pages` workflow run and capture the deployed URL. 9. If deployment or CI proof is blocked by repo settings, branch state, or lack of a remote run, store that exact blocker and leave the bundle at explicit stop-and-return rather than silent success. 10. Save all logs and screenshots under `evidence/final-validation/`.
- `Acceptance Criteria`: Existing server validation still passes, the docs site passes local and static-preview verification, and GitHub Pages deployment either succeeds with evidence or stops with a concrete external blocker.
- `Definition of Done`: Final verification passes or a concrete external deployment blocker is recorded, evidence is recorded, task `Status` becomes `Done`, the top `Status Board` is refreshed, and `tasks.md` reread confirms persistence.
- `Evidence`: evidence/final-validation/
- `Reopen When`: Any server broad gate fails again, exported docs drift from local dev behavior, or the deployed Pages site regresses.
- `Size`: M
