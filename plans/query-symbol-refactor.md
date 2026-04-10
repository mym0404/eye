# Query Symbol Refactor ExecPlan

## 1. Goal

Refactor `eye` so its code-navigation surface is meaningfully better than `grep` for coding agents:

- replace split definition/reference MCP tools with a single `query_symbol` tool
- let `query_symbol` resolve from an `anchor`, `symbolId`, or plain `symbol`
- support three actions:
  - `definition`
  - `references`
  - `context`
- make `context` return the exact definition candidate plus useful code body/snippet data so agents can avoid whole-file reads
- keep structure/source/index lifecycle tools, but make symbol navigation center on one contract

The end result should make the main agent flow:

1. resolve from an anchor once
2. reuse `symbolId`
3. ask for references or context without repeating broad text search

## 2. Current State

- `src/mcp/server.ts` currently exposes six tools, including separate `find_symbol_definitions` and `find_references`.
- `src/query/definitions.ts` and `src/query/references.ts` already share the same inputs conceptually (`anchor`, `symbolId`, `symbol`, `scopePath`) but expose separate entry points and separate result contracts.
- `read_source_range` exists, but the current navigation path still pushes agents toward extra file reads for definition body/context.
- README, docs validation, and E2E tests all encode the old split tool surface.

## 3. Scope and Non-goals

### In scope

- replace split symbol-query MCP tools with `query_symbol`
- add a unified query result contract that can express definition, references, and context
- preserve lazy indexing and current TS/JS + Python semantic backends
- reuse current indexed and ripgrep fallback paths
- add context assembly that returns a bounded snippet/body around the resolved definition
- rewrite tests and docs around the new tool surface
- update durable knowledge docs to describe the new query flow

### Non-goals

- adding new language backends
- generic language-adapter abstraction changes
- changing project structure or source-range tool semantics
- background watch mode
- multi-root support

## 4. Design

### 4.1 MCP surface

Keep these MCP tools:

- `get_project_structure`
- `read_source_range`
- `query_symbol`
- `refresh_index`
- `get_index_status`

Remove:

- `find_symbol_definitions`
- `find_references`

`query_symbol` input:

- `projectRoot?`
- `target`
  - `{ by: "anchor", filePath, line, column }`
  - `{ by: "symbolId", symbolId }`
  - `{ by: "symbol", symbol }`
- `action`
  - `"definition"`
  - `"references"`
  - `"context"`
- `scopePath?`
- `maxResults?`
- `includeDeclaration?` for `references`
- `includeBody?`, `before?`, `after?`, `maxLines?` for `context`

### 4.2 Query layering

- add a new unified query module under `src/query/symbol.ts`
- keep lower-level definition/reference resolution logic factored so `query_symbol` can delegate without duplicating semantic/index/fallback rules
- move shared target-resolution logic into the query layer so `anchor` -> symbol token -> symbol identity is owned centrally

### 4.3 Context behavior

`action: "context"` should:

1. resolve the best definition candidate from the target
2. return that definition candidate as the canonical symbol location
3. attach:
   - `symbolId`
   - `containerName`
   - `signatureLine`
   - `bodyStartLine`
   - `bodyEndLine`
   - `snippetStartLine`
   - `snippetEndLine`
   - numbered `snippetLines`
4. keep the snippet bounded so the tool is still agent-efficient

For now the definition span comes from semantic/index output already stored in the DB. The context path must be honest about missing body range data when only fallback matches exist.

### 4.4 Strategy semantics

The unified output should still explain how the answer was produced:

- `strategy`: `semantic | index | fallback`
- `indexedGeneration`
- `truncated`

`definition` and `references` results return `candidates`.

`context` returns:

- `definition`
- `context`

If a target cannot be resolved, return empty candidates or an undefined definition instead of inventing a fake context.

## 5. Files and Modules Expected to Change

- `src/mcp/server.ts`
- `src/query/definitions.ts`
- `src/query/references.ts`
- `src/query/source.ts`
- `src/query/symbol.ts` (new)
- `src/scripts/validate-doc-structure.ts`
- `tests/ts-navigation.test.ts`
- `tests/python-navigation.test.ts`
- `tests/mcp-server.e2e.ts`
- `tests/mcp-server.real-fixtures.e2e.ts`
- `README.md`
- `.agents/knowledge/architecture.md`
- `.agents/knowledge/project-map.md`
- `.agents/knowledge/business-logic/indexing-cache-query.md`

## 6. Milestones

### Milestone 1: plan and contract

- add this ExecPlan
- lock the new `query_symbol` input/output contract
- validation:
  - plan is self-contained
  - tool contract is consistent with the agreed user decisions

### Milestone 2: unified query implementation

- add `src/query/symbol.ts`
- refactor shared resolution helpers out of split modules as needed
- replace MCP registration with `query_symbol`
- validation:
  - unit tests cover TS and Python definition/reference/context flows

### Milestone 3: docs and protocol tests

- rewrite stdio MCP E2E tests to use `query_symbol`
- rewrite README to present the new query flow
- update docs validator and knowledge docs
- validation:
  - `pnpm run test:e2e`
  - `pnpm run docs:validate`

### Milestone 4: full revalidation

- run the normal repository gates
- run heavy real-fixture MCP validation
- validation:
  - `pnpm run doctor`
  - `pnpm run lint`
  - `pnpm run typecheck`
  - `pnpm run test`
  - `pnpm run test:e2e`
  - `pnpm run test:coverage`
  - `pnpm run docs:validate`
  - `pnpm run build`
  - `pnpm run test:fixtures:real`

## 7. Validation

- use Corepack-managed pnpm
- do not report completion unless the new MCP surface, updated docs, and the relevant validation commands all pass
- keep generated-path exclusions intact during the refactor

## 8. Progress Log

- 2026-04-10: Read router docs, current plans, MCP surface, query modules, validation script, tests, and README.
- 2026-04-10: User fixed the new direction:
  - no compatibility wrappers
  - one `query_symbol` tool
  - `context` must include body/snippet data
- 2026-04-10: Added `src/query/symbol.ts`, replaced the MCP surface with `query_symbol`, and rewrote unit/E2E coverage for `definition`, `references`, and `context`.
- 2026-04-10: Synced the external knowledge source with `pnpm run knowledge:sync` before updating durable knowledge docs.
- 2026-04-10: Passed `pnpm run validate`, `pnpm run build`, and the adjusted `pnpm run test:fixtures:real` suite.

## 9. Decision Log

- 2026-04-10: Treat the previous split definition/reference surface as disposable because the project is still in development.
- 2026-04-10: Optimize for agent query ergonomics over backward compatibility.
- 2026-04-10: Keep real-repository validation practical by using narrow index scopes and one semantic-heavy case, instead of forcing repository-wide semantic queries on very large repos.

## 10. Follow-ups

- Add stronger semantic context extraction when fallback-only matches need better body range support.
- Consider a future read-only `resolve_symbol` helper only if real agent usage shows `query_symbol` is still too broad.
