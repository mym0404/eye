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

const baseIgnoreGlobs = [
  "!.git/**",
  "!node_modules/**",
  "!dist/**",
  "!build/**",
  "!coverage/**",
  "!.next/**",
  "!.turbo/**",
  "!.cache/**",
  "!.worktrees/**",
]

const stripTrailingLineBreak = (value: string) => value.replace(/\r?\n$/u, "")

const getJsonText = (value: { text?: string }) => value.text ?? ""

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
    const args = ["--json", "--line-number", "--column", "--hidden", "--no-config"]

    if (fixedStrings) {
      args.push("--fixed-strings")
    }

    if (wordMatch) {
      args.push("--word-regexp")
    }

    args.push(caseSensitive ? "--case-sensitive" : "--smart-case")

    for (const glob of [...baseIgnoreGlobs, ...globs]) {
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

    const finish = (handler: () => void) => {
      if (finished) {
        return
      }

      finished = true
      handler()
    }

    child.stderr.setEncoding("utf8")
    child.stderr.on("data", (chunk) => {
      stderr += chunk
    })

    child.on("error", (error) => {
      finish(() => {
        const errorWithCode = error as NodeJS.ErrnoException

        if (errorWithCode.code === "ENOENT") {
          reject(new Error("ripgrep (rg) is required for this tool but was not found on PATH."))
          return
        }

        reject(error)
      })
    })

    const output = readline.createInterface({ input: child.stdout })

    output.on("line", (line) => {
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

      const data = event.data as {
        path: { text?: string }
        line_number?: number
        lines: { text?: string }
        submatches?: Array<{ start?: number }>
      }

      matches.push({
        path: getJsonText(data.path),
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
      output.close()

      finish(() => {
        if (limitReached || code === 0 || code === 1) {
          resolve({
            matches,
            truncated: limitReached,
          })
          return
        }

        reject(new Error(stderr.trim() || `rg exited with code ${code ?? "unknown"}.`))
      })
    })
  })
