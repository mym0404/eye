# Complete Implementation ExecPlan

## 1. Goal

Transform `eye` from the current honest MVP into a production-grade source-browsing MCP server for large local repositories with:

- bounded project structure browsing
- source reading around a line
- full-fidelity definition and reference navigation for `TypeScript/JavaScript` and `Python`
- hybrid fallback behavior for unresolved cases
- persistent incremental indexing stored under `.eye/`
- strict verification gates with `biome`, `tsc`, `vitest`, coverage reporting, Codecov, and GitHub Actions

The final result must let a client query a single local project root without manual initialization, while the server lazily creates and maintains `.eye/` state as needed.

## 2. Current State

- The repository already has a small TypeScript MCP scaffold with read-only tools.
- The current implementation uses filesystem traversal and ripgrep heuristics only.
- There is no persistent cache, no semantic backend, no project-local config, no fixture corpus, and no CI quality gates beyond TypeScript buildability.
- Root `PLANS.md` defines the required ExecPlan format. This document is the active execution plan for the full implementation.

## 3. Scope and Non-goals

### In scope

- Keep the repository as a `single package + layered modules` codebase.
- Use `hybrid` navigation architecture.
- Provide full-fidelity semantic navigation for:
  - `TypeScript/JavaScript`
  - `Python`
- Use `tree-sitter` for shared structural parsing, indexing normalization, and fallback assistance.
- Use `TypeScript compiler API` as the TS/JS semantic backend.
- Use a `Pyright`-based semantic backend for Python.
- Use `SQLite + sidecar files` for persistent incremental cache under `.eye/`.
- Support `single project root` only.
- Use `lazy project init`.
- Make indexing `automatic` for queries, while also exposing:
  - `refresh_index`
  - `get_index_status`
- Treat `symbolId` as the internal identity model for resolved navigation, while allowing name-based inputs as convenience entry points.
- Exclude generated and build-output paths by default, including at least:
  - `build`
  - `dist`
  - `out`
- Put project settings and runtime metadata under `.eye/`.
- Commit project settings and manifests, but ignore cache blobs and transient files.
- Make `ripgrep` a required external dependency.
- Keep `ctags` optional.
- Install and enforce the latest `biome` and `vitest` family tooling that is compatible with the selected runtime and implementation.
- Add Codecov reporting and GitHub Actions enforcement.
- Build four large OSS-derived fixture projects later in the plan, all focused on TS/JS and Python.

### Non-goals for this execution

- Multi-root workspace indexing
- Watch mode
- Go or Rust full-fidelity navigation
- Purely handcrafted large fixtures as the primary corpus strategy
- Committing `.eye` cache databases or blob outputs

## 4. Design

### 4.1 Repository structure

Use a single package with clear layered modules:

```text
src/
  mcp/
  project/
  config/
  storage/
  indexing/
  query/
  fallback/
  lang/
    ts/
    python/
  util/
```

Planned file groups:

- `src/mcp/`: MCP server bootstrap, tool registration, request/response normalization
- `src/project/`: project-root validation, ignore rules, `.eye/` path resolution, lazy init
- `src/config/`: config loading, validation, defaults, config migration
- `src/storage/`: SQLite schema, blob storage, migrations, transaction helpers
- `src/indexing/`: workspace scanning, dirty detection, scheduling, indexing orchestration
- `src/query/`: definitions, references, source snippets, structure browsing, result ranking
- `src/fallback/`: ripgrep integration, optional ctags integration
- `src/lang/ts/`: TS/JS semantic adapter built around TypeScript compiler API
- `src/lang/python/`: Python semantic adapter built around Pyright-backed analysis
- `src/util/`: stable identifiers, hashing, paths, error mapping, concurrency helpers

### 4.2 `.eye/` layout

`.eye/` lives under the target project root that `eye` is indexing, not under the `eye` server repository itself, except for fixture/test projects that are intentionally committed in this repository.

Portable and user-authored when present:

- `.eye/config.json`

Portable and committed only for fixture/test projects owned by this repository:

- `.eye/fixtures-manifest.json`

Server-managed local metadata:

- `.eye/runtime.json`

Ignored generated state:

- `.eye/cache.db`
- `.eye/blobs/`
- `.eye/tmp/`
- `.eye/logs/`

Design rules:

- `config.json` is the portable, user-authored project config surface
- `runtime.json` may contain machine-local paths, tool versions, and compatibility metadata
- cached semantic/index artifacts must stay local
- the server must work even when `.eye/config.json` is absent

### 4.3 External dependencies

Core dependencies to evaluate and adopt in Milestone 1:

- `@modelcontextprotocol/server`
- `typescript`
- `web-tree-sitter`
- `tree-sitter-wasms`
- `better-sqlite3`
- `pyright`
- `zod`

Quality/tooling dependencies:

- `@biomejs/biome`
- `vitest`
- `@vitest/coverage-v8`

External binaries:

- required: `rg`
- optional: `ctags`

Assumptions:

- If the latest official MCP SDK remains alpha-only, use it initially but keep a contingency to pin the latest non-alpha release if integration risk becomes unacceptable during Milestone 1.
- Python semantic integration will use `pyright-langserver` as a subprocess-backed language-service boundary rather than importing unstable internal APIs directly.
- If `rg` is unavailable, server startup must fail fast with an explicit dependency error rather than silently degrading semantic/search behavior.

### 4.4 Tool surface

Core user-facing MCP tools:

- `get_project_structure`
- `read_source_range`
- `find_symbol_definitions`
- `find_references`
- `refresh_index`
- `get_index_status`

Behavior rules:

- `get_project_structure` and `read_source_range` must work without pre-existing `.eye/` cache.
- semantic tools lazily initialize `.eye/` and block until the required indexing scope is ready.
- `find_symbol_definitions` must return stable `symbolId` values whenever a semantic match exists.
- `find_references` must prefer `symbolId` input when available and treat name-based input as a resolve-first convenience path.

Query result semantics:

- definition lookups return ranked candidates, not a forced single answer
- ambiguous name-based lookups may return multiple semantic candidates
- each candidate must include:
  - `symbolId` when resolved
  - confidence
  - source (`semantic` or `fallback`)
  - disambiguation fields such as file path, symbol kind, and container
- fallback matches must never be labeled as semantic matches

Normalized index contract:

- language adapters do not own storage schemas
- adapters must emit canonical records that are normalized before persistence:
  - `NormalizedFileRecord`
  - `NormalizedSymbolRecord`
  - `NormalizedReferenceRecord`
  - `NormalizedDependencyEdge`
- canonical `symbolId` generation is owned by shared indexing/storage code, not by per-language adapters
- ranking and merge logic for semantic and fallback matches is owned by the shared query layer

### 4.5 Indexing pipeline

Pipeline:

1. load config and ignore rules
2. scan workspace snapshot under the selected root/scope
3. exclude generated and build-output paths before expensive work
4. compare snapshot against stored file metadata
5. enqueue `added`, `changed`, and `removed` paths
6. parse/index changed files through a bounded worker pool
7. write symbol/reference/import/dependency results in transactional batches
8. delete or invalidate removed paths and their dependent edges
9. mark scope clean

Scheduler rules:

- bounded worker pool, not unbounded concurrency
- write batching must be DB-safe and memory-bounded
- a single semantic request must block until its required scope is indexed
- background indexing may be introduced later, but correctness cannot depend on it

Committed-generation consistency model:

- queries read only committed index generations
- in-flight workers may prepare records, but those records are invisible until the transaction commits
- each project root maintains a monotonic `index_generation`
- scope readiness is tied to a committed generation, not merely worker completion

### 4.6 Storage model

SQLite stores queryable metadata and relationships:

- `schema_meta`
- `projects`
- `files`
- `symbols`
- `references`
- `imports`
- `dependencies`
- `dirty_files`

Sidecar blobs store heavier per-file artifacts, keyed by content hash:

- parse snapshots
- normalized symbol/reference payloads
- import graph details

Storage rules:

- schema versioning must be explicit
- migrations must be tracked
- DB writes must be transactional
- blob writes must be content-addressed
- cache invalidation must remove or orphan stale blobs safely

### 4.7 Language adapters

#### TS/JS adapter

- use TypeScript compiler API for semantic navigation
- resolve imports, re-exports, aliases, default exports, and type/value space
- emit stable symbol identities for files, declarations, and members
- use tree-sitter only for shared indexing assistance and fallback normalization, not as the source of truth for full-fidelity semantics

#### Python adapter

- use a `pyright-langserver` subprocess-backed semantic layer
- resolve absolute imports, relative imports, package exports, aliases, class/function/module navigation
- produce stable symbol identities where semantic resolution succeeds
- use tree-sitter for shared structural indexing and fallback support
- if semantic resolution is incomplete, emit lower-confidence fallback-ready records instead of pretending to have stable semantic identity

### 4.8 Fallback model

Fallbacks exist to preserve utility outside the full-fidelity happy path:

- `ripgrep` for reference search and bounded structure/file discovery support
- optional `ctags` enrichment later for strong-hybrid expansion

Fallback rule:

- when semantic resolution succeeds, semantic results are authoritative
- fallback results must be clearly marked with lower confidence
- fallback behavior must never silently masquerade as semantic certainty
- fallback runs primarily on semantic miss or partial semantic resolution
- fallback matches are query-time supplements by default, not the primary persisted truth for full-fidelity languages
- if persisted at all for operational reasons, fallback records must remain source-tagged and separable from semantic records

### 4.9 Fixture strategy

The fixture phase is later than the core engine work, but the strategy is already fixed:

- four large fixture projects
- all focused on TS/JS and Python
- each fixture must exceed:
  - `50 files`
  - `50k lines`
- derive structure and patterns from OSS sources
- preferred upstream references:
  - `babel/babel`
  - `typescript-eslint/typescript-eslint`
  - `django/django`
  - `pydantic/pydantic`
- keep the body as curated OSS-derived snapshot material plus targeted overlays for edge cases
- fixture scale requirements must not force premature schema or module changes before Milestone 6 unless a measured bottleneck proves it necessary

## 5. Milestones

### Milestone 1: Rebuild the repository skeleton for the target architecture

Deliverables:

- replace the current flat MVP layout with layered module boundaries
- add `.eye/` config/manifests strategy
- wire `biome`, `vitest`, coverage, and updated scripts
- document mandatory verification policy in repo guidance

Validation:

- dependency install succeeds
- `biome` config loads
- `tsc --noEmit` passes
- `vitest` runs as a smoke baseline

### Milestone 2: Project context, config, ignore rules, and lazy init

Deliverables:

- project root loader
- `.eye/config.json` loader/validator
- build-output and generated-path ignore subsystem
- lazy `.eye/` initialization

Validation:

- config fixtures cover defaults and overrides
- ignored paths are excluded from scan/index/query layers
- read-only tools work without prebuilt cache

### Milestone 3: Storage and incremental indexing core

Deliverables:

- SQLite schema and migrations
- blob storage layout
- workspace scan snapshotting
- dirty detection and removal handling
- bounded worker pool orchestration
- canonical normalized schema
- canonical `symbolId` contract
- query contract for semantic and fallback result labeling
- storage-side support for `refresh_index` and `get_index_status`

Validation:

- repeated scans only reindex changed files
- removed files invalidate dependent rows
- storage tests cover migrations and transaction rollback
- repeated indexing of unchanged input preserves stable `symbolId` output
- committed-generation reads never observe partial writes

### Milestone 4: TS/JS semantic backend

Deliverables:

- TypeScript compiler API project loader
- definition and reference extraction
- import/export and re-export resolution
- stable `symbolId` generation

Validation:

- unit tests on symbol extraction and identity stability
- integration tests on TS/JS mini-corpora
- no fallback-only answers for covered semantic cases

### Milestone 5: Python semantic backend

Deliverables:

- Pyright-backed semantic integration
- import resolution and symbol extraction
- reference extraction and stable `symbolId` mapping

Validation:

- unit tests on Python graph resolution
- integration tests on Python mini-corpora
- covered semantic cases return semantic results, not fallback-only results

### Milestone 6: Query layer and MCP tool completion

Deliverables:

- final tool contracts
- `refresh_index`
- `get_index_status`
- definition/reference query ranking and confidence labeling
- structure/source tool integration against the new project context
- medium-scale golden corpora for contract and query behavior checks

Validation:

- MCP tool contract tests
- lazy init works end-to-end
- semantic queries block until scope readiness and then return stable output
- ambiguous lookups and fallback-labeled results are snapshot-tested

### Milestone 7: Quality gates, coverage, and CI

Deliverables:

- latest `biome` and `vitest` setup
- coverage generation with Codecov upload
- README badge
- GitHub Actions workflows for lint, typecheck, tests, and coverage
- repo guidance updated so unchecked results are unacceptable

Validation:

- canonical local scripts:
  - `npm run doctor`
  - `npm run lint`
  - `npm run typecheck`
  - `npm run test`
  - `npm run test:coverage`
- CI green on the same gates
- Codecov upload configured
- Codecov upload failure is non-blocking if local coverage thresholds and artifact generation succeeded

### Milestone 8: Large fixture corpus and scale validation

Deliverables:

- four large OSS-derived fixture projects
- fixture manifests in `.eye/`
- scale tests for indexing, invalidation, and query behavior

Validation:

- each fixture satisfies the agreed minimum size
- indexing succeeds without touching ignored build outputs
- definition/reference checks pass on curated expectation cases

## 6. Validation

No result is acceptable unless it has been validated by the repo-standard gates appropriate to the change.

Mandatory local gates before accepting implementation work:

- `npm run doctor` must pass
- `npm run lint` must pass
- `npm run typecheck` must pass
- `npm run test` must pass

Mandatory local gates before accepting feature-complete milestones:

- `npm run test:coverage` must pass
- coverage reports must be generated in a format consumable by Codecov

Mandatory CI gates:

- CI must run the exact canonical scripts, not ad hoc equivalents:
  - `npm run doctor`
  - `npm run lint`
  - `npm run typecheck`
  - `npm run test`
  - `npm run test:coverage`
- coverage artifact generation is a hard gate
- Codecov upload is non-blocking after artifact generation succeeds

Coverage policy:

- pure utility, storage, indexing, and query modules should be tested at function granularity
- coverage thresholds should be enforced in Vitest configuration
- do not relax coverage thresholds for convenience; if thresholds are too aggressive, adjust them once with a written rationale rather than per-file exceptions
- use different enforcement classes for:
  - pure core modules
  - adapter/integration modules
- ratchet adapter thresholds upward after fixture stabilization rather than pretending the final target is realistic on day one

Initial enforcement target:

- pure core modules: `95%` lines/functions/statements, `90%` branches
- adapter/integration modules: `85%` lines/functions/statements, `75%` branches
- fixture-heavy end-to-end suites may be excluded from per-file thresholds, but not from required pass/fail execution

Environment and resilience validation:

- `doctor` checks must validate:
  - Node version
  - `rg` availability
  - SQLite binding loadability
  - cache schema compatibility
  - Python backend availability
- tests must cover:
  - migration failure handling
  - interrupted batch writes
  - stale cache invalidation
  - blob/DB mismatch recovery
  - `symbolId` stability across unchanged reindex runs
  - MCP contract snapshots for semantic vs fallback labeling

Performance validation:

- establish baseline measurements before Milestone 8 signoff for:
  - full index time
  - single-file reindex time
  - peak memory on medium and large corpora
- reject unexplained regressions greater than:
  - `20%` full-index time
  - `25%` single-file reindex time
  - `20%` peak memory
- include explicit ignore-path compliance checks under large fixtures

## 7. Progress Log

- `2026-04-10`: gathered and confirmed requirements interactively
- `2026-04-10`: decided on hybrid architecture, persistent incremental cache, single-root scope, lazy init, automatic indexing with explicit operational tools
- `2026-04-10`: decided on TS/JS and Python as the initial full-fidelity languages
- `2026-04-10`: decided on `.eye/` layout, `rg` as required dependency, `ctags` as optional dependency
- `2026-04-10`: created this full implementation ExecPlan
- `2026-04-10`: strengthened the plan after parallel section reviews, clarifying Python integration mode, normalized schema ownership, committed-generation consistency, and validation policy
- `2026-04-10`: replaced the MVP entrypoint with the layered architecture, lazy project context, SQLite/blob cache, wasm tree-sitter indexing, TS semantic backend, and Pyright-backed Python backend
- `2026-04-10`: added repo validation gates with doctor, biome, typecheck, vitest, coverage, Codecov wiring, and GitHub Actions
- `2026-04-10`: committed four CI-friendly fixture projects and recorded the larger OSS-derived corpus as still planned work rather than pretending it is already shipped

## 8. Decision Log

- Keep repo structure as `single package + layered modules`
- Use `SQLite + sidecar files`
- Use `bounded worker pool`
- Use `block until ready` for semantic responses
- Keep config and manifests under `.eye/`
- Keep cache and blob outputs out of git
- Use `symbolId` as the internal identity model
- Use `pyright-langserver` subprocess integration for Python semantics
- Use canonical normalized records and shared `symbolId` ownership
- Treat coverage artifact generation as blocking and Codecov upload itself as non-blocking
- Focus fixtures on TS/JS and Python only
- Defer fixture construction details until after core architecture milestones are underway

## 9. Follow-ups

- Evaluate whether Go and Rust should become strong-hybrid or future full-fidelity targets
- Evaluate whether optional watch mode is worth the operational cost
- Revisit whether MCP SDK alpha risk requires a stable-version pin
- Decide whether optional ctags enrichment is valuable after semantic layers land
