import { defineConfig } from "vitest/config";
import { sharedCoverageConfig } from "../vitest.config.shared";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    coverage: {
      ...sharedCoverageConfig,
    },
  },
});
