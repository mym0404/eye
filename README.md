# eye

`eye` is a TypeScript MCP server for source-code browsing in large repositories. The current MVP is intentionally small: it gives an MCP client bounded project structure listing, source reading around a line, symbol definition lookup through a pluggable provider layer, and reference search backed by `ripgrep`.

## Current MVP

The server currently provides four read-only tools:

| Tool | What it does now |
| --- | --- |
| `get_project_structure` | Returns a bounded directory tree with truncation controls. |
| `read_source_range` | Reads a file around a requested line and returns numbered lines. |
| `find_symbol_definitions` | Tries a local `tags` file first, then falls back to ripgrep-based definition heuristics. |
| `search_references` | Uses `ripgrep` to find literal or regex references with optional scope narrowing. |

## How it works

- Project structure is built with a bounded filesystem walk. It skips heavyweight directories such as `.git`, `node_modules`, `dist`, and `coverage`.
- Source reading is direct file I/O with line-window clamping.
- Definition lookup uses a provider abstraction. The MVP ships with:
  - a `tags` file provider when a repo already has `tags` or `.tags`
  - a ripgrep heuristic provider for common definition patterns in popular languages
- Reference search uses `ripgrep --json` and stops early once the requested result limit is reached.

## Requirements

- Node.js 20+
- `rg` available on `PATH` for definition fallback and reference search
- Optional: a local `tags` file for better definition lookup, for example:

```bash
ctags -n -R
```

## Setup

```bash
npm install
npm run typecheck
npm run build
```

## Running the server

The server uses stdio transport:

```bash
node dist/index.js
```

Most clients should pass an absolute `projectRoot` argument to the tools. You can also set:

- `EYE_WORKSPACE_ROOT` to define a default repository root
- `EYE_ALLOWED_ROOTS` as a comma-separated list of absolute paths to restrict access

## Example MCP client configuration

```json
{
  "command": "node",
  "args": ["/absolute/path/to/eye/dist/index.js"],
  "env": {
    "EYE_ALLOWED_ROOTS": "/absolute/path/to/repos"
  }
}
```

## Limitations

- This is not a semantic indexer yet. There is no persistent index, tree-sitter integration, or symbol graph.
- The heuristic definition fallback is language-pattern based and can miss or mis-rank definitions.
- Project structure does not yet read `.gitignore`; it uses a built-in ignore list.
- The server currently exposes stdio only.
