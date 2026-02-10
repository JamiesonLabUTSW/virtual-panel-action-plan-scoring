#!/usr/bin/env node
import { cpSync, rmSync, existsSync, mkdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, "..");

console.log("📦 Verifying cross-workspace build...\n");

// 1. Check that builds exist
console.log("1️⃣ Checking build artifacts...");
const serverBuild = path.join(rootDir, "server/dist/index.cjs");
const clientBuild = path.join(rootDir, "client/dist/index.html");

if (!existsSync(serverBuild)) {
  console.error("❌ Server build not found at", serverBuild);
  process.exit(1);
}
console.log("✓ Server build found");

if (!existsSync(clientBuild)) {
  console.error("❌ Client build not found at", clientBuild);
  process.exit(1);
}
console.log("✓ Client build found");

// 2. Copy client dist to server/public (simulating Dockerfile behavior)
console.log("\n2️⃣ Setting up static files...");
const publicDir = path.join(rootDir, "server/public");
if (existsSync(publicDir)) {
  rmSync(publicDir, { recursive: true, force: true });
}
cpSync(path.join(rootDir, "client/dist"), publicDir, { recursive: true });
console.log("✓ Client build copied to server/public");

// 3. Verify key files in public directory
console.log("\n3️⃣ Verifying SPA files...");
const indexHtml = path.join(publicDir, "index.html");
if (!existsSync(indexHtml)) {
  console.error("❌ index.html not found in public directory");
  process.exit(1);
}
console.log("✓ index.html present in public directory");

console.log("\n✅ Build verification passed!");
console.log("\nNext steps:");
console.log("- Set up .env file with required Azure OpenAI credentials");
console.log("- Run: npm run dev");
console.log("- Or for production: PORT=7860 node server/dist/index.cjs");
console.log("- Visit: http://localhost:7860");
