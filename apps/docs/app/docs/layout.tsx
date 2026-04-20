import { DocsLayout } from "fumadocs-ui/layouts/docs"
import type { ReactNode } from "react"

import { source } from "@/lib/source"

export default function DocsShellLayout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout
      tree={source.pageTree}
      nav={{
        title: (
          <>
            <span className="font-[family-name:var(--font-mono)] text-sm uppercase tracking-[0.32em] text-teal-800/70">
              eye
            </span>
          </>
        ),
      }}
    >
      {children}
    </DocsLayout>
  )
}
