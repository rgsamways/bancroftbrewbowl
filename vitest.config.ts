import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["apps/*/src/**/*.test.ts", "packages/*/src/**/*.test.ts", "e2e/**/*.test.ts"],
    // The tests share one real database and some screens read across all of it (the admin summary
    // counts every waiting decision), so test files run one after another.
    fileParallelism: false,
    setupFiles: ["./apps/api/src/test/setup.ts"],
  },
});
