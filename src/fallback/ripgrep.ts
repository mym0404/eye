import { spawn } from "node:child_process"
import readline from "node:readline"

export type SearchMatch = {
  path: string
  line: number
  column: number
  text: string
}

export type SearchResult = {
  matches: SearchMatch[]
  truncated: boolean
}

type RipgrepJsonMatch = {
  path: { text?: string }
  line_number?: number
  lines: { text?: string }
  submatches?: Array<{ start?: number }>
}

const stripTrailingLineBreak = (value: string) => value.replace(/\r?\n$/u, "")

const getJsonText = (value: { text?: string }) => value.text ?? ""

const normalizeRelativePath = (value: string) =>
  value.replace(/^\.\/+/u, "").replaceAll("\\", "/")

const rejectMissingRipgrep = (
  reject: (error: Error) => void,
  error: NodeJS.ErrnoException,
) => {
  if (error.code === "ENOENT") {
    reject(new Error("ripgrep (rg) is required but was not found on PATH."))
    return
  }

  reject(error)
}

export const searchWithRipgrep = async ({
  projectRoot,
  pattern,
  maxResults,
  fixedStrings = false,
  wordMatch = false,
  caseSensitive = false,
  searchRoots = ["."],
  globs = [],
}: {
  projectRoot: string
  pattern: string
  maxResults: number
  fixedStrings?: boolean
  wordMatch?: boolean
  caseSensitive?: boolean
  searchRoots?: string[]
  globs?: string[]
}) =>
  new Promise<SearchResult>((resolve, reject) => {
    const args = [
      "--json",
      "--line-number",
      "--column",
      "--hidden",
      "--no-config",
    ]

    if (fixedStrings) {
      args.push("--fixed-strings")
    }

    if (wordMatch) {
      args.push("--word-regexp")
    }

    args.push(caseSensitive ? "--case-sensitive" : "--smart-case")

    for (const glob of globs) {
      args.push("-g", glob)
    }

    args.push(pattern, ...(searchRoots.length > 0 ? searchRoots : ["."]))

    const child = spawn("rg", args, {
      cwd: projectRoot,
      stdio: ["ignore", "pipe", "pipe"],
    })

    const matches: SearchMatch[] = []
    let stderr = ""
    let limitReached = false
    let finished = false

    const finish = (callback: () => void) => {
      if (finished) {
        return
      }

      finished = true
      callback()
    }

    child.stderr.setEncoding("utf8")
    child.stderr.on("data", (chunk) => {
      stderr += chunk
    })

    child.on("error", (error) => {
      finish(() => rejectMissingRipgrep(reject, error as NodeJS.ErrnoException))
    })

    const lines = readline.createInterface({ input: child.stdout })

    lines.on("line", (line) => {
      let event: unknown

      try {
        event = JSON.parse(line)
      } catch {
        return
      }

      if (
        typeof event !== "object" ||
        event === null ||
        !("type" in event) ||
        !("data" in event) ||
        event.type !== "match"
      ) {
        return
      }

      const data = event.data as RipgrepJsonMatch
      matches.push({
        path: normalizeRelativePath(getJsonText(data.path)),
        line: data.line_number ?? 1,
        column: (data.submatches?.[0]?.start ?? 0) + 1,
        text: stripTrailingLineBreak(getJsonText(data.lines)),
      })

      if (matches.length >= maxResults) {
        limitReached = true
        child.kill()
      }
    })

    child.on("close", (code) => {
      lines.close()

      finish(() => {
        if (limitReached || code === 0 || code === 1) {
          resolve({
            matches,
            truncated: limitReached,
          })
          return
        }

        reject(
          new Error(
            stderr.trim() || `rg exited with code ${code ?? "unknown"}.`,
          ),
        )
      })
    })
  })

export const listFilesWithRipgrep = async ({
  projectRoot,
  searchRoot = ".",
  globs = [],
}: {
  projectRoot: string
  searchRoot?: string
  globs?: string[]
}) =>
  new Promise<string[]>((resolve, reject) => {
    const args = ["--files", "--hidden", "--no-config"]

    for (const glob of globs) {
      args.push("-g", glob)
    }

    args.push(searchRoot)

    const child = spawn("rg", args, {
      cwd: projectRoot,
      stdio: ["ignore", "pipe", "pipe"],
    })

    let stdout = ""
    let stderr = ""

    child.stdout.setEncoding("utf8")
    child.stderr.setEncoding("utf8")
    child.stdout.on("data", (chunk) => {
      stdout += chunk
    })
    child.stderr.on("data", (chunk) => {
      stderr += chunk
    })

    child.on("error", (error) =>
      rejectMissingRipgrep(reject, error as NodeJS.ErrnoException),
    )

    child.on("close", (code) => {
      if (code === 0 || code === 1) {
        const files = stdout
          .split(/\r?\n/u)
          .map((value) => normalizeRelativePath(value.trim()))
          .filter(Boolean)

        resolve(files)
        return
      }

      reject(
        new Error(
          stderr.trim() || `rg --files exited with code ${code ?? "unknown"}.`,
        ),
      )
    })
  })
