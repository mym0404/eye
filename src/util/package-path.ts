import { createRequire } from "node:module"
import path from "node:path"

const require = createRequire(import.meta.url)

export const resolvePackagePath = ({
  packageName,
  relativePath,
}: {
  packageName: string
  relativePath?: string
}) => {
  if (relativePath) {
    try {
      return require.resolve(`${packageName}/${relativePath}`)
    } catch {
      // fall through to package-root resolution
    }
  }

  try {
    const packageJsonPath = require.resolve(`${packageName}/package.json`)
    const packageRoot = path.dirname(packageJsonPath)

    return relativePath ? path.join(packageRoot, relativePath) : packageRoot
  } catch {
    const entryPath = require.resolve(packageName)
    const packageRoot = path.dirname(entryPath)

    return relativePath ? path.join(packageRoot, relativePath) : packageRoot
  }
}
