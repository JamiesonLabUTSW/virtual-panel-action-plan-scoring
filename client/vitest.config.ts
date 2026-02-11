import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { sharedCoverageConfig } from "../vitest.config.shared";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "../shared"),
      "@shared/*": path.resolve(__dirname, "../shared/*"),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/__tests__/setup.ts"], // Future: React Testing Library setup
    coverage: {
      ...sharedCoverageConfig,
      exclude: [
        ...sharedCoverageConfig.exclude,
        "../shared/**",
        "src/main.tsx", // Entry point, hard to test
      ],
    },
  },
});
