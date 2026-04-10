#!/usr/bin/env node

import { execFile } from "node:child_process"
import { access, mkdir, readFile, stat, writeFile } from "node:fs/promises"
import path from "node:path"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)

const repoRoot = process.cwd()
const knowledgeDir = path.join(repoRoot, ".agents", "knowledge")
const localConfigPath = path.join(knowledgeDir, "source-repo.local.json")
const syncMetadataPath = path.join(knowledgeDir, "source-sync.local.json")

const getArgValue = (flag: string) => {
  const index = process.argv.indexOf(flag)

  if (index === -1) {
    return undefined
  }

  return process.argv[index + 1]
}

const fileExists = async (targetPath: string) => {
  try {
    await access(targetPath)
    return true
  } catch {
    return false
  }
}

const loadLocalConfig = async () => {
  if (!(await fileExists(localConfigPath))) {
    return undefined
  }

  const raw = await readFile(localConfigPath, "utf8")
  const parsed = JSON.parse(raw) as {
    sourcePath?: string
    remote?: string
    branch?: string
  }

  return parsed
}

const runGit = async ({ cwd, args }: { cwd: string; args: string[] }) => {
  const { stdout } = await execFileAsync("git", args, {
    cwd,
  })

  return stdout.trim()
}

const main = async () => {
  const localConfig = await loadLocalConfig()
  const sourcePath =
    getArgValue("--source") ??
    process.env.EYE_KNOWLEDGE_SOURCE_REPO ??
    localConfig?.sourcePath

  if (!sourcePath) {
    throw new Error(
      "knowledge source path is required. Use --source, EYE_KNOWLEDGE_SOURCE_REPO, or .agents/knowledge/source-repo.local.json.",
    )
  }

  const sourceInfo = await stat(sourcePath)

  if (!sourceInfo.isDirectory()) {
    throw new Error(`knowledge source is not a directory: ${sourcePath}`)
  }

  const remote = getArgValue("--remote") ?? localConfig?.remote ?? "origin"
  const branch = getArgValue("--branch") ?? localConfig?.branch ?? "main"

  await runGit({
    cwd: sourcePath,
    args: ["fetch", remote, branch],
  })
  await runGit({
    cwd: sourcePath,
    args: ["pull", "--ff-only", remote, branch],
  })

  const [headSha, remoteUrl] = await Promise.all([
    runGit({
      cwd: sourcePath,
      args: ["rev-parse", "HEAD"],
    }),
    runGit({
      cwd: sourcePath,
      args: ["remote", "get-url", remote],
    }),
  ])

  await mkdir(knowledgeDir, {
    recursive: true,
  })
  await writeFile(
    syncMetadataPath,
    `${JSON.stringify(
      {
        sourcePath,
        remote,
        branch,
        remoteUrl,
        headSha,
        syncedAt: new Date().toISOString(),
      },
      null,
      2,
    )}\n`,
  )

  console.error(`knowledge sync: ok (${headSha.slice(0, 7)})`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
