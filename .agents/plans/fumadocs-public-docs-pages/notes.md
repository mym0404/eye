# Add Public Fumadocs Site

## Discoveries

- [2026-04-20 04:42Z] Discovery: The repo has no root-level web docs app, no GitHub Pages workflow, and no docs-specific validation script. Sources: `/Users/mj/projects/eye/package.json`, `/Users/mj/projects/eye/.github/workflows/ci.yml`, `/Users/mj/projects/eye/.github/workflows/real-fixtures.yml`.
- [2026-04-20 04:45Z] Discovery: Public docs and internal docs are already split: `README.md` is the public-facing source, while `/.agents/knowledge/` is the evergreen internal knowledge tree and `plans/` is transient. Sources: `/Users/mj/projects/eye/README.md`, `/Users/mj/projects/eye/.agents/knowledge/README.md`, `/Users/mj/projects/eye/plans/ACTIVE.md`.
- [2026-04-20 04:48Z] Discovery: The current workspace only includes `"."`, so a separate docs app requires an explicit workspace expansion. Source: `/Users/mj/projects/eye/pnpm-workspace.yaml`.
- [2026-04-20 04:50Z] Discovery: Root hooks and CI are server-first today. `pre-commit` runs `lint + typecheck + test`, `pre-push` runs `validate + build`, and CI validates only the server surface. Sources: `/Users/mj/projects/eye/lefthook.yml`, `/Users/mj/projects/eye/.github/workflows/ci.yml`.
- [2026-04-20 04:53Z] Discovery: The current `.gitignore` does not ignore `.next` or static-export output, so the docs app introduces new artifact policy immediately. Source: `/Users/mj/projects/eye/.gitignore`.
- [2026-04-20 04:56Z] Discovery: The closest in-repo Fumadocs reference lives inside the pinned Next.js real-fixture docs app and shows the expected split between `source.config.ts`, a loader in `lib/source.ts`, and an App Router catch-all docs page. Sources: `/Users/mj/projects/eye/tests/fixtures/real/nextjs/apps/docs/package.json`, `/Users/mj/projects/eye/tests/fixtures/real/nextjs/apps/docs/source.config.ts`, `/Users/mj/projects/eye/tests/fixtures/real/nextjs/apps/docs/lib/source.ts`, `/Users/mj/projects/eye/tests/fixtures/real/nextjs/apps/docs/app/docs/[[...slug]]/page.tsx`.
- [2026-04-20 05:00Z] Discovery: Official Fumadocs docs currently support Next.js manual installation, static export, and static built-in search for exported sites. Sources: `https://www.fumadocs.dev/docs/manual-installation/next`, `https://www.fumadocs.dev/docs/deploying/static`, `https://v14.fumadocs.dev/docs/headless/search/orama`.
- [2026-04-20 05:03Z] Discovery: Official GitHub Pages docs require `actions/upload-pages-artifact`, `actions/deploy-pages`, `pages: write`, and `id-token: write` for custom-workflow deployment, and recommend GitHub Actions as the publishing source. Sources: `https://docs.github.com/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site`, `https://docs.github.com/enterprise-cloud%40latest/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages`.
- [2026-04-20 05:05Z] Discovery: Official Next.js docs support static export for GitHub Pages-class static hosting and warn against server-only patterns when `output: 'export'` is enabled. Sources: `https://nextjs.org/docs/pages/guides/static-exports`, `https://nextjs.org/docs/messages/gssp-export`.

## Decisions

- [2026-04-20 05:08Z] Decision: The docs site will be a separate workspace app under `apps/docs`, not a root-package fold-in. Rationale: this preserves the root server package, avoids mixing publish surfaces, and matches the repo’s existing package boundary better.
- [2026-04-20 05:10Z] Decision: Public docs source will live under `content/docs`, while `README.md` remains the GitHub landing page and seeds the initial IA. Rationale: this keeps the public docs source explicit without reclassifying internal knowledge files as product pages.
- [2026-04-20 05:12Z] Decision: The first shipped docs scope is English-only with no multilingual routing. Rationale: the user explicitly chose public docs only and default language `en`, and extra i18n infrastructure would add non-requested complexity to static export and Pages deployment.
- [2026-04-20 05:15Z] Decision: The design system is light-mode-first, Swiss/minimal, and documentation-led, with restrained slate/blue tones and mono typography reserved for code accents. Rationale: readability and scanability matter more here than a dark default developer-tool aesthetic.
- [2026-04-20 05:18Z] Decision: Static search is allowed only if it uses Fumadocs’ static-export-compatible path. Rationale: the site must stay GitHub Pages-compatible from the first shipped deployment.
- [2026-04-20 05:22Z] Decision: Root `build` stays the server build. Docs build gets separate root commands instead of redefining the existing server contract. Rationale: existing hooks, CI, and package semantics already treat `build` as the server artifact gate.
- [2026-04-20 05:25Z] Decision: Docs build verification will be added to normal CI, while actual Pages artifact upload and deployment live in a dedicated `docs-pages` workflow. Rationale: validation and deployment are distinct concerns in the current repo and should stay that way.
- [2026-04-20 06:11Z] Decision: `T2` and `T3` will execute sequentially, not in parallel. Rationale: the shell task owns the minimal buildable surface first, then the IA task expands real public content without overlapping file ownership.
- [2026-04-20 06:13Z] Decision: `README.md` public-site entry ownership stays in `T3`, while `T5` owns `AGENTS.md` plus maintenance-doc alignment. Rationale: this keeps public entry copy with the IA task and keeps repo-contract updates with repo integration.
- [2026-04-20 06:15Z] Decision: Search must remain static-export-compatible, with no `app/api` route in scope. Rationale: GitHub Pages deployment and `output: 'export'` are first-order constraints, so search must use static Fumadocs or build-time client indexing only.
- [2026-04-20 06:18Z] Decision: Local Pages-like preview will mount the exported site under `.tmp-pages-preview/eye` and verify `http://127.0.0.1:4300/eye/`. Rationale: this is the simplest deterministic way to test the project-site subpath contract without adding a permanent preview server.
- [2026-04-20 06:20Z] Decision: The Pages workflow will keep the existing root workspace install contract unless execution explicitly introduces a narrower installer boundary. Rationale: the current repo has a single lockfile and workspace-root install model, so assuming a docs-only install path would be a hidden infrastructure change.

## Risks

- [2026-04-20 05:28Z] Risk: The workspace expansion can accidentally drag the docs app into root server type/build semantics if package scripts and TypeScript boundaries are not kept separate.
- [2026-04-20 05:31Z] Risk: GitHub Pages project-site deployment will break asset paths if base-path handling is missing or only tested in local root-path dev mode.
- [2026-04-20 05:33Z] Risk: The docs app can silently expose internal maintenance material if content sourcing or navigation generation is allowed to read from `/.agents/knowledge/` or `plans/`.
- [2026-04-20 05:35Z] Risk: A visually ambitious docs homepage could drift away from documentation usability and make the first docs release feel like a landing-page gimmick instead of a docs product.
- [2026-04-20 05:38Z] Risk: Deployment proof depends on GitHub Pages settings and branch state, which are external to the local repo and need an explicit stop-and-return branch in the execution contract.

## Revision Notes

- [2026-04-20 05:40Z] Revision Note: The approved draft locked the user-visible scope to `Public docs only`, which removed the need for a second interview round about internal architecture pages.
- [2026-04-20 05:43Z] Revision Note: The plan intentionally reuses `README.md` as the primary public-content source and treats `/.agents/knowledge/` as internal maintenance material, even though both are English documents.
- [2026-04-20 05:46Z] Revision Note: The bundle uses a dedicated docs workflow rather than overloading the existing CI or root `build` contract, because the current repo has strong server-first validation expectations.
- [2026-04-20 06:24Z] Revision Note: Review pass repairs tightened task ownership, moved Wave 2 from parallel to sequential, added AGENTS alignment, and replaced the ambiguous root-path static preview with an explicit `/eye/` mount flow.
- [2026-04-20 06:27Z] Revision Note: Review pass repairs also made browser validation more concrete by fixing required IA sections, keyboard/focus checks, and CI docs-step evidence requirements.
- [2026-04-20 06:33Z] Revision Note: Final re-review passed after removing the last `T2`/`T3` file-ownership overlap, and the approval-only `draft.md` file was removed so the bundle now contains only live planning artifacts.
- [2026-04-20 12:21Z] Revision Note: During T3 execution, the task file list omitted `content/docs/usage/*.mdx` even though the implementation notes, plan, and verification contract all require a visible `Usage` section. Execution follows the verification-aligned interpretation and records the extra public-content path here instead of silently dropping the section.
- [2026-04-20 12:54Z] Revision Note: T4 verification exposed two more bundle-scope gaps: the docs route layout file `apps/docs/app/docs/layout.tsx` still needed responsive layout controls even though it is not named in the T4 file list, and the carried-forward reference content still needed code blocks for the stated long-reference verification. Execution keeps both fixes on the same public-docs surface and records the scope repair here.
- [2026-04-20 13:18Z] Revision Note: T5 verification exposed another repo-contract gap: generated docs artifacts under `apps/docs/.next`, `apps/docs/out`, and the temporary Pages preview were not excluded from Biome, so `pnpm run lint` failed immediately after `pnpm docs:check`. The repair keeps validation truthful by excluding generated docs outputs instead of weakening the docs build gate.

## Retrospective

- [2026-04-20 05:47Z] Revision Note: None yet. Execution has not started.
