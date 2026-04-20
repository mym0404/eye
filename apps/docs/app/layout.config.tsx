import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared"

import { SiteWordmark } from "@/components/site-wordmark"

export const baseOptions: BaseLayoutProps = {
  nav: {
    title: <SiteWordmark />,
    url: "/",
  },
  searchToggle: {
    components: {
      lg: <span>Search docs</span>,
      sm: <span>Search</span>,
    },
  },
  themeSwitch: {
    enabled: true,
    mode: "light-dark-system",
  },
  githubUrl: "https://github.com/mym0404/eye",
  links: [
    {
      text: "Docs",
      url: "/docs",
      active: "nested-url",
    },
  ],
}
