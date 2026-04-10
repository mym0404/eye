import { readFile } from "node:fs/promises"

import { resolveProjectPath } from "../project/root.js"

export type SourceLine = {
  number: number
  text: string
}

const splitLines = (value: string) =>
  value.length === 0 ? [] : value.split(/\r?\n/u)

const getWindow = ({
  line,
  before,
  after,
  totalLines,
  maxLines,
}: {
  line: number
  before: number
  after: number
  totalLines: number
  maxLines: number
}) => {
  const requestedStart = Math.max(1, line - before)
  const requestedEnd = Math.min(totalLines, line + after)
  const requestedLength = requestedEnd - requestedStart + 1

  if (requestedLength <= maxLines) {
    return {
      startLine: requestedStart,
      endLine: requestedEnd,
      clamped: false,
    }
  }

  let startLine = Math.max(1, line - Math.floor((maxLines - 1) / 2))
  const endLine = Math.min(totalLines, startLine + maxLines - 1)

  startLine = Math.max(1, endLine - maxLines + 1)

  return {
    startLine,
    endLine,
    clamped: true,
  }
}

export const readSourceRange = async ({
  projectRoot,
  filePath,
  line,
  before,
  after,
  maxLines,
}: {
  projectRoot: string
  filePath: string
  line: number
  before: number
  after: number
  maxLines: number
}) => {
  const resolvedFile = await resolveProjectPath({
    projectRoot,
    targetPath: filePath,
  })
  const buffer = await readFile(resolvedFile.absolutePath)

  if (buffer.includes(0)) {
    throw new Error(
      `binary files are not supported: ${resolvedFile.relativePath}`,
    )
  }

  const lineTexts = splitLines(buffer.toString("utf8"))
  const totalLines = lineTexts.length

  if (totalLines === 0) {
    return {
      projectRoot,
      filePath: resolvedFile.relativePath,
      line: 1,
      startLine: 0,
      endLine: 0,
      totalLines: 0,
      clamped: false,
      lines: [],
    }
  }

  const anchorLine = Math.max(1, Math.min(line, totalLines))
  const window = getWindow({
    line: anchorLine,
    before,
    after,
    totalLines,
    maxLines,
  })

  const lines: SourceLine[] = lineTexts
    .slice(window.startLine - 1, window.endLine)
    .map((text, index) => ({
      number: window.startLine + index,
      text,
    }))

  return {
    projectRoot,
    filePath: resolvedFile.relativePath,
    line: anchorLine,
    startLine: window.startLine,
    endLine: window.endLine,
    totalLines,
    clamped: window.clamped,
    lines,
  }
}

export const formatSourceRange = ({
  filePath,
  startLine,
  endLine,
  totalLines,
  clamped,
  lines,
}: {
  filePath: string
  startLine: number
  endLine: number
  totalLines: number
  clamped: boolean
  lines: SourceLine[]
}) => {
  const header =
    totalLines === 0
      ? `${filePath}: empty file`
      : `${filePath}:${startLine}-${endLine} of ${totalLines}${clamped ? " (clamped)" : ""}`

  if (lines.length === 0) {
    return header
  }

  const lineNumberWidth = String(endLine).length
  const body = lines
    .map(
      ({ number, text }) =>
        `${String(number).padStart(lineNumberWidth)} | ${text}`,
    )
    .join("\n")

  return `${header}\n${body}`
}
