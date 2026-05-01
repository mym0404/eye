# eye-mcp

[![codecov](https://codecov.io/gh/mym0404/eye/branch/main/graph/badge.svg)](https://codecov.io/gh/mym0404/eye)

`eye-mcp` is a source-browsing MCP server for coding agents working in large local repositories.

Public docs: [mym0404.github.io/eye](https://mym0404.github.io/eye/)

## What It Does

| Tool | What it does |
| --- | --- |
| `get_project_structure` | Returns a bounded tree and skips generated paths such as `build`, `dist`, `out`, and `.eye`. |
| `read_source_range` | Reads source around a requested line with numbered output. |
| `query_symbol` | Resolves `definition`, `references`, and `context` from `anchor`, `symbolId`, or `symbol`. |
| `refresh_index` | Refreshes the local `.eye` cache for the whole project or a narrowed scope. |
| `get_index_status` | Reports cache generation, counts, and readiness. |

## Quick Start

Requirements:

- Node.js 20+
- `Universal Ctags` on `PATH` as `ctags`
- `ripgrep` on `PATH` as `rg`

Install prerequisites:

- macOS: `brew install universal-ctags ripgrep`
- Ubuntu 24.04: `sudo apt-get update && sudo apt-get install --yes universal-ctags ripgrep`

Run the published package:

```bash
npx -y eye-mcp
```

## Add It To Your Agent

### Codex

```bash
codex mcp add eye -- npx -y eye-mcp
```

### Claude Code

```bash
claude mcp add --scope project eye -- npx -y eye-mcp
```

### Generic `.mcp.json`

```json
{
  "mcpServers": {
    "eye": {
      "command": "npx",
      "args": ["-y", "eye-mcp"]
    }
  }
}
```

## How `query_symbol` Works

`query_symbol` always returns `matches`. When `action` is `context`, it also returns one bounded `context` block for the first match.

Current behavior:

- anchor definitions, anchor references, and `symbolId` references try semantic navigation first
- if semantic resolution throws or returns nothing useful, the query falls back to indexed rows and then lower-confidence text search when needed
- semantic reference results do not infer `symbolId` from usage-site proximity
- when a `symbolId` target resolved successfully, semantic reference matches reuse that requested `symbolId` and indexed symbol name
- merged reference candidates are deduped by `filePath:line:column` before truncation

Typical flow:

1. `get_project_structure`
2. `read_source_range`
3. `query_symbol` with `action: "definition"`
4. reuse the returned `symbolId` for `references` or `context`
5. `refresh_index` when the repository changed or you want a deterministic refresh

Example:

```json
{
  "name": "query_symbol",
  "arguments": {
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

Then follow up with the returned `symbolId`:

```json
{
  "name": "query_symbol",
  "arguments": {
    "target": {
      "by": "symbolId",
      "symbolId": "sym:typescript:src/utils/helper.ts:helper:1"
    },
    "action": "references",
    "includeDeclaration": false
  }
}
```

## Project Root And Cache

`eye` works on one project root at a time.

Root detection order:

1. explicit `projectRoot`
2. nearest ancestor with `.eye/config.json`
3. nearest workspace root such as `.git`, `pnpm-workspace.yaml`, or `turbo.json`
4. nearest project root such as `package.json`, `tsconfig.json`, `jsconfig.json`, `pyproject.toml`, or `setup.py`
5. server process cwd

On the first index-backed operation, `eye` creates `.eye/config.json` and fills `sourceRoots` with inferred relative paths such as `src`, `app`, or `packages/web/src`.

`sourceRoots` only controls indexing. Structure and source reads still work across the whole resolved project root.

## Limitations

- indexing is lazy and query-triggered; there is no watch mode
- name-based lookups can still be ambiguous
- `context` is bounded for navigation, not whole-file dumping
- the persisted index is ctags-backed, so some queries can still fall back to lower-confidence text search
