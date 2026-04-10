import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    include: ["tests/**/*.real-fixtures.e2e.ts"],
    testTimeout: 300000,
    hookTimeout: 300000,
    fileParallelism: false,
    maxWorkers: 1,
    minWorkers: 1,
  },
})
