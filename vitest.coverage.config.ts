import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts", "tests/**/*.e2e.ts"],
    exclude: ["tests/**/*.real-fixtures.e2e.ts", "tests/fixtures/real/**"],
    testTimeout: 30000,
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      reportsDirectory: "coverage",
      include: ["src/**/*.ts"],
      exclude: [
        "src/index.ts",
        "src/scripts/**/*.ts",
        "src/lang/**/*.ts",
        "src/mcp/**/*.ts",
        "src/query/status.ts",
        "src/util/package-path.ts",
      ],
      thresholds: {
        lines: 75,
        functions: 75,
        statements: 75,
        branches: 50,
      },
    },
  },
})
