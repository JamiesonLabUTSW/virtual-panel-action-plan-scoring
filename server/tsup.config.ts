import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs"],
  target: "node24",
  outDir: "dist",
  noExternal: ["@shared"],
  clean: true,
  dts: false,
  sourcemap: true,
  shims: true,
});
