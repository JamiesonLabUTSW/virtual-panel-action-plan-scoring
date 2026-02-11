// Shared Vitest coverage configuration for all workspaces
export const sharedCoverageConfig = {
  provider: "v8" as const,
  reporter: ["text", "json", "html", "lcov"],
  reportsDirectory: "./coverage",
  thresholds: {
    lines: 80,
    functions: 80,
    branches: 80,
    statements: 80,
  },
  // Note: Thresholds report but don't fail builds (no enforcement configured)
  // Watermarks control report color coding (red < 80%, yellow 80-95%, green > 95%)
  watermarks: {
    lines: [80, 95] as [number, number],
    functions: [80, 95] as [number, number],
    branches: [80, 95] as [number, number],
    statements: [80, 95] as [number, number],
  },
  exclude: ["node_modules/**", "__tests__/**", "*.config.ts", "dist/**"],
};
