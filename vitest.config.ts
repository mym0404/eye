import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    testTimeout: 15000,
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      reportsDirectory: "coverage",
      include: ["src/**/*.ts"],
      exclude: ["src/index.ts", "src/scripts/**/*.ts"],
      thresholds: {
        lines: 75,
        functions: 75,
        statements: 75,
        branches: 50,
      },
    },
  },
})
