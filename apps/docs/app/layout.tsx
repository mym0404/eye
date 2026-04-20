import "./global.css"

import { RootProvider } from "fumadocs-ui/provider"
import { IBM_Plex_Sans, JetBrains_Mono } from "next/font/google"
import type { ReactNode } from "react"

import { DocsSearchDialog } from "@/components/docs-search-dialog"

const sans = IBM_Plex_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600"],
})

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500"],
})

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${sans.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-[var(--app-bg)] text-[var(--app-fg)] antialiased">
        <a className="skip-link" href="#content">
          Skip to content
        </a>
        <RootProvider
          search={{
            SearchDialog: DocsSearchDialog,
            links: [["Install the Server", "/docs/getting-started/install"]],
          }}
          theme={{
            enabled: true,
            attribute: "class",
            defaultTheme: "system",
            enableSystem: true,
            disableTransitionOnChange: true,
          }}
        >
          {children}
        </RootProvider>
      </body>
    </html>
  )
}
