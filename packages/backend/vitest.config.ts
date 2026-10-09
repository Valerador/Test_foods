import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    testTimeout: 20000,
    hookTimeout: 20000,
    fileParallelism: false, // Run integration test files sequentially to ensure clean DB isolation
  },
});
