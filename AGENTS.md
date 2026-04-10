# eye

## Overview
- `eye` is a public TypeScript MCP server for source-code browsing in large repositories.
- The current MVP focuses on bounded structure listing, source reading around a line, symbol definition lookup, and reference search.
- Keep documentation honest about what is implemented now versus what is planned later.

## Working Style
- Prefer small, credible changes over broad but shallow scaffolding.
- Keep filesystem traversal, ripgrep-backed search, and definition-provider logic separated so stronger index backends can be added later.
- Do not claim semantic navigation, persistent indexing, or language coverage that the code does not actually provide.

## ExecPlans
- For complex features, significant refactors, or work with uncertain sequencing, write an ExecPlan using `PLANS.md` before editing code.
- The ExecPlan must stay self-contained and restartable: a new agent should be able to continue from only the plan and the current tree.
- Keep progress, decisions, and validation notes updated inside the plan while work is in flight.
- When implementing from an ExecPlan, continue milestone by milestone unless blocked by a real ambiguity.

## Validation
- Run the narrowest meaningful validation for the files you changed.
- Prefer `npm run typecheck` and `npm run build` once dependencies are installed.
