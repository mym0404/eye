#!/usr/bin/env node

import { execFile } from "node:child_process"
import { promisify } from "node:util"

import Database from "better-sqlite3"

import { CURRENT_SCHEMA_VERSION } from "../storage/schema.js"

const execFileAsync = promisify(execFile)

const checks = [
  {
    name: "node",
    run: async () => {
      if (!process.versions.node) {
        throw new Error("Node.js runtime was not detected.")
      }
    },
  },
  {
    name: "rg",
    run: async () => {
      await execFileAsync("rg", ["--version"])
    },
  },
  {
    name: "ctags",
    run: async () => {
      let versionOutput = ""

      try {
        const { stdout, stderr } = await execFileAsync("ctags", ["--version"])
        versionOutput = `${stdout}\n${stderr}`.trim()
      } catch (error) {
        throw new Error(
          "Universal Ctags is required on PATH as `ctags`. Install it with `brew install universal-ctags` or `sudo apt-get install --yes universal-ctags` and make sure that binary shadows BSD ctags.",
          { cause: error },
        )
      }

      if (!versionOutput.includes("Universal Ctags")) {
        throw new Error(
          "Universal Ctags is required on PATH as `ctags`. The detected `ctags` binary is not Universal Ctags.",
        )
      }
    },
  },
  {
    name: "better-sqlite3",
    run: async () => {
      const database = new Database(":memory:")

      database.prepare("select 1 as value").get()
      database.close()
    },
  },
  {
    name: "mcp-server-runtime",
    run: async () => {
      const { createEyeServer } = await import("../mcp/server.js")

      createEyeServer()
    },
  },
  {
    name: "cache-schema",
    run: async () => {
      if (CURRENT_SCHEMA_VERSION < 1) {
        throw new Error("Schema version must be positive.")
      }
    },
  },
]

const main = async () => {
  const results = await Promise.allSettled(
    checks.map(async (check) => {
      await check.run()
      return check.name
    }),
  )

  const failures = results.filter(
    (result): result is PromiseRejectedResult => result.status === "rejected",
  )

  if (failures.length > 0) {
    for (const failure of failures) {
      console.error(failure.reason)
    }

    process.exit(1)
  }

  console.error("doctor: ok")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
