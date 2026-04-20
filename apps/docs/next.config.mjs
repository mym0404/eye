import { createMDX } from "fumadocs-mdx/next"

const basePath = process.env.EYE_DOCS_BASE_PATH ?? ""
const withMDX = createMDX()

/** @type {import("next").NextConfig} */
const config = {
  reactStrictMode: true,
  output: "export",
  trailingSlash: true,
  basePath,
  images: {
    unoptimized: true,
  },
}

export default withMDX(config)
