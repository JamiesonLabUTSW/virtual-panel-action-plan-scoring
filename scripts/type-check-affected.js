#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, "..");

// Get staged files from git
let stagedFiles = [];
try {
  const output = execFileSync("git", ["diff", "--cached", "--name-only", "--diff-filter=ACM"], {
    cwd: rootDir,
    encoding: "utf8",
  });
  stagedFiles = output.trim().split("\n").filter(Boolean);
} catch (error) {
  console.warn("⚠ Could not detect staged files from git:", error.message);
  console.warn("Skipping type-check (not in git repo or git error)");
  process.exit(0);
}

// Determine affected workspaces
const workspaces = new Set();

for (const file of stagedFiles) {
  if (file.startsWith("shared/") && file.endsWith(".ts")) {
    workspaces.add("shared");
    // Shared changes affect all workspaces
    workspaces.add("server");
    workspaces.add("client");
  } else if (file.startsWith("server/") && file.endsWith(".ts")) {
    workspaces.add("server");
  } else if (file.startsWith("client/") && (file.endsWith(".ts") || file.endsWith(".tsx"))) {
    workspaces.add("client");
  }
}

if (workspaces.size === 0) {
  process.exit(0);
}

// Run type-check in affected workspaces
let hasErrors = false;

for (const workspace of workspaces) {
  const workspacePath = join(rootDir, workspace);
  const workspaceHasTsConfig = existsSync(join(workspacePath, "tsconfig.json"));

  if (!workspaceHasTsConfig) {
    continue;
  }
  try {
    execFileSync("npx", ["tsc", "--noEmit"], {
      cwd: workspacePath,
      stdio: "inherit",
    });
  } catch (error) {
    console.error(`✗ ${workspace} type-check failed`);
    hasErrors = true;
  }
}

if (hasErrors) {
  process.exit(1);
}
