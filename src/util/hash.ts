import { createHash } from "node:crypto"

export const hashValue = (value: string | Buffer) =>
  createHash("sha1").update(value).digest("hex")
