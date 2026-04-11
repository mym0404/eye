#!/usr/bin/env node

import { access, readFile } from "node:fs/promises"
import path from "node:path"

const repoRoot = process.cwd()

const requiredFiles = [
  "AGENTS.md",
  ".agents/knowledge/README.md",
  ".agents/knowledge/project-map.md",
  ".agents/knowledge/architecture.md",
  ".agents/knowledge/business-logic/indexing-cache-query.md",
  ".agents/knowledge/operations/validation-and-hooks.md",
  ".agents/knowledge/operations/source-sync.md",
  ".agents/knowledge/source-repo.template.json",
  "plans/ACTIVE.md",
]

const readRepoFile = async (relativePath: string) =>
  readFile(path.join(repoRoot, relativePath), "utf8")

const main = async () => {
  const missingFiles: string[] = []

  for (const relativePath of requiredFiles) {
    try {
      await access(path.join(repoRoot, relativePath))
    } catch {
      missingFiles.push(relativePath)
    }
  }

  if (missingFiles.length > 0) {
    throw new Error(`missing knowledge files: ${missingFiles.join(", ")}`)
  }

  const agents = await readRepoFile("AGENTS.md")
  const requiredAgentReferences = [
    ".agents/knowledge/README.md",
    ".agents/knowledge/architecture.md",
    ".agents/knowledge/business-logic/indexing-cache-query.md",
    ".agents/knowledge/operations/validation-and-hooks.md",
    ".agents/knowledge/operations/source-sync.md",
    "plans/ACTIVE.md",
    "pnpm run knowledge:sync",
    "pnpm run docs:validate",
    "pnpm run test:e2e",
  ]

  const missingAgentReferences = requiredAgentReferences.filter(
    (entry) => !agents.includes(entry),
  )

  if (missingAgentReferences.length > 0) {
    throw new Error(
      `AGENTS router is missing references: ${missingAgentReferences.join(", ")}`,
    )
  }

  const businessLogic = await readRepoFile(
    ".agents/knowledge/business-logic/indexing-cache-query.md",
  )
  const requiredBusinessTerms = [
    "refreshProjectIndex",
    "EyeDatabase",
    "EyeBlobStore",
    "projects",
    "files",
    "symbols",
    "references_idx",
    "dependencies",
    "dirty_files",
    "get_project_structure",
    "query_symbol",
  ]
  const missingBusinessTerms = requiredBusinessTerms.filter(
    (entry) => !businessLogic.includes(entry),
  )

  if (missingBusinessTerms.length > 0) {
    throw new Error(
      `business-logic doc is missing core terms: ${missingBusinessTerms.join(", ")}`,
    )
  }

  console.error("docs: ok")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
