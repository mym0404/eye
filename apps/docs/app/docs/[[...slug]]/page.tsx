import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
} from "fumadocs-ui/page"
import { notFound } from "next/navigation"

import { source } from "@/lib/source"

type PageProps = {
  params: Promise<{ slug?: string[] }>
}

export default async function DocsCatchAllPage({ params }: PageProps) {
  const { slug } = await params
  const page = source.getPage(slug)

  if (!page) {
    if ((slug?.length ?? 0) > 0) {
      notFound()
    }

    return (
      <DocsPage>
        <DocsTitle>eye Docs</DocsTitle>
        <DocsDescription>
          Public guides, setup steps, and tool references live here.
        </DocsDescription>
        <DocsBody>
          <p>
            Start from the home page now, then use this section for installation
            guides, client setup, and command reference.
          </p>
        </DocsBody>
      </DocsPage>
    )
  }

  const MDXContent = page.data.body

  return (
    <DocsPage toc={page.data.toc} full={page.data.full}>
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <DocsBody>
        <MDXContent />
      </DocsBody>
    </DocsPage>
  )
}

export async function generateStaticParams() {
  const params = source.generateParams()
  return params.length > 0 ? params : [{ slug: [] }]
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params
  const page = source.getPage(slug)

  if (!page) {
    return {
      title: "Docs",
      description: "Public documentation for eye.",
    }
  }

  return {
    title: page.data.title,
    description: page.data.description,
  }
}
