import Link from "next/link"

const quickStart = [
  {
    step: "01",
    title: "Install the local runtime",
    body: "Prepare Node.js, Corepack, Universal Ctags, and ripgrep before wiring the MCP server.",
  },
  {
    step: "02",
    title: "Build the stdio entrypoint",
    body: "Run pnpm install and pnpm run build once, then point your client at the dist entry.",
  },
  {
    step: "03",
    title: "Navigate with bounded reads",
    body: "Start with structure, read exact source ranges, then reuse symbolId for follow-up lookups.",
  },
]

const tools = [
  [
    "get_project_structure",
    "Map a repository without walking every folder by hand.",
  ],
  [
    "read_source_range",
    "Read exact line-centered context with numbered output.",
  ],
  [
    "query_symbol",
    "Resolve definitions, references, and bounded context through one surface.",
  ],
  [
    "refresh_index",
    "Refresh the local cache for the whole root or a narrow scope.",
  ],
  [
    "get_index_status",
    "Inspect cache generation, counts, and readiness without writes.",
  ],
]

const clients = [
  {
    name: "Codex",
    command: "codex mcp add eye -- node /absolute/path/to/eye/dist/index.js",
  },
  {
    name: "Claude Code",
    command:
      "claude mcp add --scope project eye -- node /absolute/path/to/eye/dist/index.js",
  },
  {
    name: "Generic .mcp.json",
    command:
      '"command": "node", "args": ["/absolute/path/to/eye/dist/index.js"]',
  },
]

const faqs = [
  "One project root at a time, resolved automatically or with projectRoot.",
  "Lazy local indexing instead of a background daemon.",
  "Index-first symbol lookup with explicit fallback search when needed.",
]

export default function HomePage() {
  return (
    <main id="content" className="min-h-screen">
      <section className="border-b border-[color:var(--border-soft)]">
        <div className="mx-auto flex min-h-[calc(100svh-1px)] w-full max-w-6xl flex-col px-6 py-6 sm:px-8 lg:px-10">
          <header className="flex items-center justify-between gap-6 border-b border-[color:var(--border-soft)] pb-5">
            <div>
              <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.3em] text-[color:var(--accent-strong)]">
                source browsing mcp
              </p>
              <p className="mt-2 text-sm text-slate-600">
                Read less, resolve faster, keep context tight.
              </p>
            </div>
            <nav className="flex items-center gap-3">
              <Link className="home-link" href="/docs">
                Docs
              </Link>
              <a className="home-link" href="https://github.com/mym0404/eye">
                GitHub
              </a>
            </nav>
          </header>

          <div className="grid flex-1 gap-10 py-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)] lg:items-end">
            <div className="max-w-3xl">
              <p className="section-label">Public docs</p>
              <h1 className="mt-4 max-w-3xl text-5xl font-semibold tracking-[-0.06em] text-slate-950 sm:text-6xl lg:text-[4.5rem]">
                Use `eye` when an agent needs exact code navigation, not more
                file churn.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-650">
                The docs site focuses on setup, client wiring, bounded
                navigation patterns, and the five MCP tools that keep large
                repositories inspectable.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  className="primary-action"
                  href="/docs/getting-started/install"
                >
                  Get Started
                </Link>
                <Link
                  className="secondary-action"
                  href="/docs/reference/core-tools"
                >
                  Tool Reference
                </Link>
              </div>
            </div>

            <aside className="border-l border-[color:var(--border-soft)] pl-0 lg:pl-8">
              <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
                <div className="stat-block">
                  <p className="stat-label">Exact reads</p>
                  <p className="stat-copy">
                    Structure maps and line-centered source reads before broad
                    scans.
                  </p>
                </div>
                <div className="stat-block">
                  <p className="stat-label">Symbol follow-up</p>
                  <p className="stat-copy">
                    Anchor once, then reuse `symbolId` for references and
                    context.
                  </p>
                </div>
                <div className="stat-block">
                  <p className="stat-label">Local cache</p>
                  <p className="stat-copy">
                    Keep expensive repository indexing local and lazy.
                  </p>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>

      <section className="home-section">
        <div className="home-grid">
          <div>
            <p className="section-label">Quick Start</p>
            <h2 className="section-title">
              Move from install to first useful query in one pass.
            </h2>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            {quickStart.map((item) => (
              <article key={item.step} className="surface-panel">
                <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.24em] text-[color:var(--accent-strong)]">
                  {item.step}
                </p>
                <h3 className="mt-3 text-lg font-semibold text-slate-950">
                  {item.title}
                </h3>
                <p className="mt-3 text-sm leading-7 text-slate-650">
                  {item.body}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="home-section">
        <div className="home-grid">
          <div>
            <p className="section-label">Core Tools</p>
            <h2 className="section-title">
              A compact MCP surface with clear job boundaries.
            </h2>
          </div>
          <div className="divide-y divide-[color:var(--border-soft)] border-y border-[color:var(--border-soft)]">
            {tools.map(([name, body]) => (
              <div
                key={name}
                className="grid gap-3 py-5 lg:grid-cols-[minmax(0,16rem)_minmax(0,1fr)] lg:items-start"
              >
                <code className="text-sm font-medium text-slate-950">
                  {name}
                </code>
                <p className="text-sm leading-7 text-slate-650">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="home-section">
        <div className="home-grid">
          <div>
            <p className="section-label">Client Setup</p>
            <h2 className="section-title">
              Keep the entrypoint boring so the docs can stay precise.
            </h2>
          </div>
          <div className="grid gap-4">
            {clients.map((client) => (
              <article key={client.name} className="surface-panel">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-lg font-semibold text-slate-950">
                    {client.name}
                  </h3>
                  <Link
                    className="text-sm font-medium text-[color:var(--accent-strong)]"
                    href="/docs/integrations/agent-clients"
                  >
                    Open integration guide
                  </Link>
                </div>
                <pre className="mt-4">
                  <code>{client.command}</code>
                </pre>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="home-section pb-16">
        <div className="home-grid">
          <div>
            <p className="section-label">FAQ</p>
            <h2 className="section-title">
              Current product limits are part of the public contract.
            </h2>
          </div>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
            <div className="grid gap-3">
              {faqs.map((item) => (
                <div
                  key={item}
                  className="surface-panel text-sm leading-7 text-slate-650"
                >
                  {item}
                </div>
              ))}
            </div>
            <div className="surface-panel lg:min-w-64">
              <p className="text-sm uppercase tracking-[0.2em] text-slate-500">
                Need the full path?
              </p>
              <p className="mt-3 text-sm leading-7 text-slate-650">
                Walk from install through prompt patterns, then use the tool
                reference and FAQ as the stable public contract.
              </p>
              <Link
                className="primary-action mt-6 inline-flex"
                href="/docs/faq"
              >
                Read the FAQ
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
