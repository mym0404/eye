#!/usr/bin/env node

import { execFile } from "node:child_process"
import { constants } from "node:fs"
import { access } from "node:fs/promises"
import { promisify } from "node:util"

import Database from "better-sqlite3"

import { CURRENT_SCHEMA_VERSION } from "../storage/schema.js"
import { resolvePackageBin } from "../util/package-bin.js"

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
    name: "pyright-langserver",
    run: async () => {
      const executablePath = resolvePackageBin({
        packageName: "pyright",
        binName: "pyright-langserver",
      })

      await access(executablePath, constants.R_OK)
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
