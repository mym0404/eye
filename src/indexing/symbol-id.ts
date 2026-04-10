import { hashValue } from "../util/hash.js"

export const createSymbolId = ({
  projectRoot,
  language,
  relativePath,
  name,
  kind,
  line,
  column,
}: {
  projectRoot: string
  language: string
  relativePath: string
  name: string
  kind: string
  line: number
  column: number
}) =>
  hashValue(
    [
      projectRoot,
      language,
      relativePath,
      name,
      kind,
      String(line),
      String(column),
    ].join(":"),
  )
