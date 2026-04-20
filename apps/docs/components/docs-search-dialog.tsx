"use client"

import type { SharedProps } from "fumadocs-ui/components/dialog/search"
import {
  SearchDialog,
  SearchDialogClose,
  SearchDialogContent,
  SearchDialogHeader,
  SearchDialogIcon,
  SearchDialogInput,
  SearchDialogOverlay,
} from "fumadocs-ui/components/dialog/search"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"

type SearchEntry = {
  description: string
  section: string
  title: string
  url: string
}

const searchIndex: SearchEntry[] = [
  {
    title: "eye Docs",
    section: "Overview",
    description: "Public setup, usage, and integration guides for eye.",
    url: "/docs",
  },
  {
    title: "Install the Server",
    section: "Getting Started",
    description: "Prepare Node.js, Corepack, Universal Ctags, and ripgrep.",
    url: "/docs/getting-started/install",
  },
  {
    title: "Project Root and Config",
    section: "Getting Started",
    description: "Understand projectRoot detection and .eye/config.json.",
    url: "/docs/getting-started/project-root-and-config",
  },
  {
    title: "Prompt Patterns",
    section: "Usage",
    description:
      "Ask agents to use eye with bounded reads and symbol-aware follow-up.",
    url: "/docs/usage/prompt-patterns",
  },
  {
    title: "Core Tool Reference",
    section: "Reference",
    description: "Review the five shipped MCP tools and the recommended flow.",
    url: "/docs/reference/core-tools",
  },
  {
    title: "Agent Client Integration",
    section: "Integrations",
    description:
      "Connect eye to Codex, Claude Code, or a generic .mcp.json client.",
    url: "/docs/integrations/agent-clients",
  },
  {
    title: "FAQ",
    section: "FAQ",
    description: "Common questions about runtime, indexing, and limits.",
    url: "/docs/faq",
  },
]

export function DocsSearchDialog({ open, onOpenChange }: SharedProps) {
  const router = useRouter()
  const [search, setSearch] = useState("")

  useEffect(() => {
    if (!open) {
      return
    }

    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onOpenChange(false)
      }
    }

    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [open, onOpenChange])

  const results = useMemo(() => {
    const keyword = search.trim().toLowerCase()

    if (keyword.length === 0) {
      return searchIndex
    }

    return searchIndex.filter((entry) =>
      `${entry.title} ${entry.section} ${entry.description}`
        .toLowerCase()
        .includes(keyword),
    )
  }, [search])

  return (
    <SearchDialog
      open={open}
      onOpenChange={onOpenChange}
      search={search}
      onSearchChange={setSearch}
    >
      <SearchDialogOverlay className="bg-[color:var(--search-overlay)] backdrop-blur-[6px]" />
      <SearchDialogContent className="left-1/2 top-16 z-50 w-[min(44rem,calc(100vw-1.5rem))] -translate-x-1/2 border border-[color:var(--border-strong)] bg-[color:var(--surface-raised)] p-0 text-[color:var(--app-fg)] shadow-[0_24px_80px_rgba(15,23,42,0.18)] sm:top-24">
        <SearchDialogHeader className="border-b border-[color:var(--border-soft)]">
          <SearchDialogIcon className="text-[color:var(--muted-fg)]" />
          <SearchDialogInput
            placeholder="Search docs, tools, setup"
            className="h-14 bg-transparent text-base text-[color:var(--app-fg)] placeholder:text-[color:var(--muted-fg)]"
          />
          <SearchDialogClose className="rounded-md border border-[color:var(--border-soft)] bg-[color:var(--surface-raised)] px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-[color:var(--muted-fg)]">
            Close
          </SearchDialogClose>
        </SearchDialogHeader>

        <div className="max-h-[70vh] overflow-y-auto p-3">
          <div className="mb-3 px-2 text-[11px] font-medium uppercase tracking-[0.22em] text-[color:var(--muted-fg)]">
            {search.trim().length === 0 ? "Suggested pages" : "Results"}
          </div>
          <div className="grid gap-2">
            {results.length > 0 ? (
              results.map((entry) => (
                <button
                  key={entry.url}
                  type="button"
                  className="rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] px-4 py-3 text-left transition hover:border-[color:var(--accent-strong)] hover:bg-[color:var(--accent-soft)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--accent-strong)]"
                  onClick={() => {
                    router.push(entry.url)
                    onOpenChange(false)
                  }}
                >
                  <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[color:var(--accent-strong)]">
                    {entry.section}
                  </p>
                  <p className="mt-2 text-sm font-semibold text-[color:var(--app-fg)]">
                    {entry.title}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-[color:var(--muted-fg)]">
                    {entry.description}
                  </p>
                </button>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-[color:var(--border-strong)] bg-[color:var(--surface-elevated)] px-4 py-8 text-center text-sm leading-6 text-[color:var(--muted-fg)]">
                No results yet. Try tool names like <code>query_symbol</code> or
                section names like <code>Getting Started</code>.
              </div>
            )}
          </div>
        </div>
      </SearchDialogContent>
    </SearchDialog>
  )
}
