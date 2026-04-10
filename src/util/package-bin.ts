import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"

const require = createRequire(import.meta.url)

export const resolvePackageBin = ({
  packageName,
  binName,
}: {
  packageName: string
  binName: string
}) => {
  const packageJsonPath = require.resolve(`${packageName}/package.json`)
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
    bin?: Record<string, string> | string
  }

  if (typeof packageJson.bin === "string") {
    return path.join(path.dirname(packageJsonPath), packageJson.bin)
  }

  const relativeBinPath = packageJson.bin?.[binName]

  if (!relativeBinPath) {
    throw new Error(`Unable to resolve ${binName} from package ${packageName}.`)
  }

  return path.join(path.dirname(packageJsonPath), relativeBinPath)
}
