import { constants } from "node:fs"
import { access, mkdir, writeFile } from "node:fs/promises"
import path from "node:path"

export class EyeBlobStore {
  readonly rootDir: string

  constructor(rootDir: string) {
    this.rootDir = rootDir
  }

  ensureReady = async () => {
    await mkdir(this.rootDir, { recursive: true })
  }

  getBlobPath = (hash: string) => path.join(this.rootDir, `${hash}.json`)

  writeJsonBlob = async ({ hash, value }: { hash: string; value: unknown }) => {
    await this.ensureReady()

    const targetPath = this.getBlobPath(hash)

    try {
      await access(targetPath, constants.F_OK)
      return targetPath
    } catch {
      await writeFile(targetPath, JSON.stringify(value, null, 2))
      return targetPath
    }
  }
}
