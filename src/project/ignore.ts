const defaultGeneratedPathPatterns = [
  ".git/**",
  ".worktrees/**",
  "build/**",
  "node_modules/**",
  "dist/**",
  "out/**",
  ".eye/**",
  "coverage/**",
  ".next/**",
  ".turbo/**",
  ".cache/**",
]

const normalizeRelativePath = (value: string) => value.replaceAll("\\", "/")

const matchesPattern = ({
  relativePath,
  pattern,
}: {
  relativePath: string
  pattern: string
}) => {
  if (pattern.endsWith("/**")) {
    const prefix = pattern.slice(0, -3)

    return relativePath === prefix || relativePath.startsWith(`${prefix}/`)
  }

  return relativePath === pattern
}

export const getDefaultGeneratedPathPatterns = () => [
  ...defaultGeneratedPathPatterns,
]

export const shouldIgnoreRelativePath = ({
  relativePath,
  patterns,
}: {
  relativePath: string
  patterns: string[]
}) => {
  const normalizedPath = normalizeRelativePath(relativePath)

  return patterns.some((pattern) =>
    matchesPattern({
      relativePath: normalizedPath,
      pattern: normalizeRelativePath(pattern),
    }),
  )
}
