#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, "..");
const serverBuild = path.join(rootDir, "server/dist/index.cjs");
const clientBuild = path.join(rootDir, "client/dist/index.html");

if (!existsSync(serverBuild)) {
  console.error("❌ Server build not found at", serverBuild);
  process.exit(1);
}

if (!existsSync(clientBuild)) {
  console.error("❌ Client build not found at", clientBuild);
  process.exit(1);
}
const publicDir = path.join(rootDir, "server/public");
if (existsSync(publicDir)) {
  rmSync(publicDir, { recursive: true, force: true });
}
cpSync(path.join(rootDir, "client/dist"), publicDir, { recursive: true });
const indexHtml = path.join(publicDir, "index.html");
if (!existsSync(indexHtml)) {
  console.error("❌ index.html not found in public directory");
  process.exit(1);
}
