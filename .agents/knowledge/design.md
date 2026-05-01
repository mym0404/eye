# Design

## Public Docs Surface

- `apps/docs/app/page.tsx` owns the public home page.
- `apps/docs/app/docs/layout.tsx` wraps documentation pages with Fumadocs `DocsLayout`.
- `apps/docs/app/layout.config.tsx` owns shared navigation, search toggle, theme switch, GitHub link, and docs nav links.
- `apps/docs/components/docs-search-dialog.tsx` owns the custom client-side docs search dialog.
- `apps/docs/components/site-wordmark.tsx` owns the compact wordmark used in the docs shell.
- `apps/docs/app/global.css` owns theme tokens, typography, focus styles, home-page utilities, and prose overrides.

## Current UI Rules

- The docs app uses Fumadocs UI as the shell and keeps custom UI local to `apps/docs`.
- The visual system uses IBM Plex Sans for text and JetBrains Mono for code.
- Theme colors come from CSS variables in `apps/docs/app/global.css`; keep light and dark values in sync.
- The public UI is text-first and setup-focused. Prefer dense, readable documentation screens over decorative marketing sections.
- Preserve the skip link, visible focus states, theme switch, and responsive search behavior when changing layout.
- Do not put internal agent knowledge, plans, or maintenance notes into public UI copy.

## Validation

- Run `pnpm docs:check` after public docs UI, MDX content, docs routing, or docs export changes.
- Use browser validation for meaningful UI changes and save temporary screenshots under `tmp/` when screenshots are useful.
