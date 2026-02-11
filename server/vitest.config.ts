import path from "node:path";
import { defineConfig } from "vitest/config";
import { sharedCoverageConfig } from "../vitest.config.shared";

export default defineConfig({
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "../shared"),
      "@shared/*": path.resolve(__dirname, "../shared/*"),
    },
  },
  test: {
    globals: true,
    environment: "node",
    coverage: {
      ...sharedCoverageConfig,
      exclude: [
        ...sharedCoverageConfig.exclude,
        "../shared/**", // Don't re-test shared
      ],
    },
  },
});
