# eye

[![codecov](https://codecov.io/gh/mym0404/eye/branch/main/graph/badge.svg)](https://codecov.io/gh/mym0404/eye)

`eye` is a source-browsing MCP server for large local repositories. It is built for coding agents that need to move through unfamiliar codebases without repeatedly re-scanning the filesystem by hand.

[!IMPORTANT]
This project is still under active development. Tool behavior, cache details, and setup guidance may change as the server matures.

Use `eye` when you want an agent to:

- map the project structure before touching code
- read source around an exact line
- resolve a symbol once from an anchor, then reuse `symbolId`
- follow references without broad text-search fanout
- read bounded definition context instead of whole files
- reuse a lazy local cache instead of re-doing expensive repo scans

The project matters only if it does more than wrap `grep`. The current design aims to give agents a single symbol-query API that:

- disambiguates which symbol the agent means
- returns exact definition/reference candidates before large file reads
- reuses project-local index state across repeated queries
- keeps generated paths and cache state out of normal navigation

## What `eye` Does

| Tool | Current behavior |
| --- | --- |
| `get_project_structure` | Returns a bounded tree and skips generated paths such as `build`, `dist`, `out`, `.eye`, and similar defaults. |
| `read_source_range` | Reads a file around a requested line with numbered output. |
| `query_symbol` | One symbol-query surface for `definition`, `references`, and `context`. It accepts `target.by = "anchor" | "symbolId" | "symbol"`, always returns `matches`, and adds a bounded `context` block for the best definition when `action` is `context`. Resolution can come from semantic, indexed, or ripgrep-backed paths depending on query shape and backend coverage. |
| `refresh_index` | Refreshes the `.eye` cache for the whole root or a narrowed scope. |
| `get_index_status` | Reports generation, counts, and cache state. |

## Current Scope

- Single project root only.
- Lazy `.eye/` initialization under the target repository.
- Persistent cache in `.eye/cache.db`.
- Content-addressed sidecar blobs in `.eye/blobs/`.
- Structural indexing with `web-tree-sitter` + wasm grammars.
- TS/JS semantic navigation through the TypeScript language service.
- Python navigation through a `pyright-langserver`-backed adapter, with some real-repository name lookups currently resolving through the index strategy.
- `ripgrep` for file discovery and fallback search.

## Install the Server

Requirements:

- Node.js 20+
- Corepack
- `rg` on `PATH`

Build `eye` once:

```bash
corepack enable
corepack use pnpm@10
pnpm install
pnpm run build
```

Optional health check:

```bash
pnpm run doctor
```

The stdio entrypoint is:

```bash
node /absolute/path/to/eye/dist/index.js
```

`eye` expects `EYE_ALLOWED_ROOTS` so the client can limit which repositories may be browsed. Each `projectRoot` must be absolute; if a client omits it, `eye` falls back to `EYE_WORKSPACE_ROOT` or the server process cwd.

## Add `eye` to Agents

### Codex

`codex mcp add` accepts a local stdio server command. On Unix-like shells, this form works:

```bash
codex mcp add eye -- env EYE_ALLOWED_ROOTS=/absolute/path/to/repos node /absolute/path/to/eye/dist/index.js
```

The local Codex installation on this machine uses the `codex mcp add <name> -- <command>` pattern for stdio MCP servers.

### Claude Code

Claude Code documents local stdio MCP servers with `claude mcp add <name> <command> [args...]`. A project-scoped setup for `eye` looks like this:

```bash
claude mcp add --scope project --env EYE_ALLOWED_ROOTS=/absolute/path/to/repos eye -- node /absolute/path/to/eye/dist/index.js
```

After adding it:

```bash
claude mcp list
claude mcp get eye
```

### Generic `.mcp.json` Clients

Many MCP-aware agents and SDKs accept a JSON stdio configuration shaped like this:

```json
{
  "mcpServers": {
    "eye": {
      "command": "node",
      "args": ["/absolute/path/to/eye/dist/index.js"],
      "env": {
        "EYE_ALLOWED_ROOTS": "/absolute/path/to/repos"
      }
    }
  }
}
```

## How to Use `eye` Well

`eye` works best when the prompt tells the agent how to navigate:

1. Start with structure when the repo is unfamiliar.
2. Read source before making claims about behavior.
3. Use `query_symbol` with an `anchor` first, then reuse `symbolId`.
4. Use `scopePath` when the repo is large and the target area is known.
5. Call `refresh_index` when the repo changed or when you want a deterministic index pass before deeper navigation.

### Good Prompt Patterns

Use prompts like:

- `Use eye to inspect this repository before answering. Start with get_project_structure at depth 2, then read the relevant files before you summarize the architecture.`
- `Use eye to inspect this repository before answering. Resolve createProgram with query_symbol from an anchor or symbol name, then follow references using symbolId and summarize the main call sites.`
- `Use eye only inside packages/next/src/server. Refresh the index for that scope, then use query_symbol for definition and references of loadConfig.`
- `Read the source around django/core/handlers/wsgi.py before explaining the request path. Do not answer from memory.`
- `Use eye to map the repo, identify the ownership boundary for this feature, and list the exact files I should inspect next.`

### Prompts to Avoid

Avoid vague prompts like:

- `Explain this repo.`
- `Find where this is used.` without giving a symbol, file, or scope.
- `Read everything and summarize.` on very large repositories.

Those prompts force broad scans and make it harder for the agent to pick the right tool sequence.

## `query_symbol` Patterns

Resolve from the code you are currently looking at:

```json
{
  "name": "query_symbol",
  "arguments": {
    "projectRoot": "/repo",
    "target": {
      "by": "anchor",
      "filePath": "src/main.ts",
      "line": 42,
      "column": 17
    },
    "action": "definition"
  }
}
```

Then reuse the returned `symbolId`:

```json
{
  "name": "query_symbol",
  "arguments": {
    "projectRoot": "/repo",
    "target": {
      "by": "symbolId",
      "symbolId": "sym:typescript:src/utils/helper.ts:helper:1"
    },
    "action": "references",
    "includeDeclaration": false
  }
}
```

Read bounded definition context without opening the whole file:

```json
{
  "name": "query_symbol",
  "arguments": {
    "projectRoot": "/repo",
    "target": {
      "by": "symbolId",
      "symbolId": "sym:typescript:src/utils/helper.ts:helper:1"
    },
    "action": "context",
    "includeBody": true,
    "before": 0,
    "after": 0,
    "maxLines": 80
  }
}
```

`query_symbol` always returns `matches`. When `action` is `context`, the response also includes a `context` object for the first match.

## Recommended Agent Flow

For a fresh repository, the most reliable sequence is:

1. `get_project_structure`
2. `read_source_range`
3. `query_symbol` with `action: "definition"`
4. `query_symbol` with `action: "references"` or `action: "context"`
5. `get_index_status` or `refresh_index` when needed

Two operational notes matter:

- `get_project_structure`, `read_source_range`, and `get_index_status` are read-only.
- `get_index_status` returns an idle zero-value summary when no cache exists yet.
- `query_symbol` and `refresh_index` may create or update the local `.eye/` cache.

## `.eye/` Layout

```text
.eye/
  config.json
  runtime.json
  cache.db
  blobs/
  tmp/
  logs/
```

- `config.json`: portable ignore and indexing settings.
- `runtime.json`: machine-local metadata written by the server.
- `cache.db` and `blobs/`: generated cache state, ignored from git.

## Tests and Fixtures

- The default local validation flow stays lightweight.
- Four committed fixtures support CI-speed integration tests: `ts-app`, `js-app`, `python-app`, and `mixed-app`.
- `tests/fixtures/real/` contains pinned git submodules for `microsoft/TypeScript`, `vercel/next.js`, `pallets/flask`, and `django/django`.
- `pnpm run test:fixtures:real` is the heavy real-repository suite.
- The real-fixture suite reads structure and source from all four pinned repositories, checks scoped large-repo indexing on Next.js and Django, and runs definition/reference symbol flow on Flask.
- The heavy suite is intentionally separate from the default local `validate` flow and runs in its own GitHub Actions workflow.

## Limitations

- Semantic coverage is currently limited to TS/JS and Python.
- Indexing is lazy and query-triggered; there is no watch mode or background daemon.
- Name-based lookups can still be ambiguous and may return multiple candidates.
- `context` is bounded and optimized for agent navigation, not for dumping entire long definitions.
- The structural index is tree-sitter based, but not yet a language-complete semantic graph.
- The committed in-repo fixtures are small integration corpora; large OSS coverage lives in `tests/fixtures/real/` submodules.

## For Maintainers

Standard maintainer flow:

```bash
pnpm run doctor
pnpm run lint
pnpm run typecheck
pnpm run test
pnpm run test:e2e
pnpm run test:coverage
pnpm run docs:validate
pnpm run build
```

Heavy real-repository validation is separate:

```bash
pnpm run test:fixtures:real
```
