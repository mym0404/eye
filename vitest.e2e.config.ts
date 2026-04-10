import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    include: ["tests/**/*.e2e.ts"],
    exclude: ["tests/**/*.real-fixtures.e2e.ts", "tests/fixtures/real/**"],
    testTimeout: 30000,
  },
})
