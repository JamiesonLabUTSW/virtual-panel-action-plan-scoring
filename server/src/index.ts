import express, { Request, Response } from "express";
import path from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";
import { INITIAL_GRADING_STATE } from "@shared/types";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// Environment variables
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 7860;
const MAX_DOC_CHARS = process.env.MAX_DOC_CHARS
  ? parseInt(process.env.MAX_DOC_CHARS, 10)
  : 20000;

// Validate required environment variables
// TODO: Switch to fail-fast validation (process.exit(1)) for production
// Currently logs warnings to allow dev mode to start without Azure credentials
const requiredEnvVars = [
  "AZURE_OPENAI_API_KEY",
  "AZURE_OPENAI_RESOURCE",
  "AZURE_OPENAI_DEPLOYMENT",
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.warn(`⚠ Missing environment variable: ${envVar}`);
  }
}

// Verify @shared import works
console.log("✓ @shared/types imported successfully");
console.log("✓ INITIAL_GRADING_STATE:", INITIAL_GRADING_STATE);

// Middleware
app.use(express.json());

// Health check endpoint
app.get("/api/health", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

// Serve static files from public directory (for production with client build)
const publicDir = path.join(__dirname, "../public");
if (!existsSync(publicDir)) {
  console.warn("⚠ Public directory not found. Static files will not be served.");
  console.warn("  Run 'npm run build --workspace=@grading/client' first for production mode.");
  console.warn("  In dev mode, use the Vite dev server instead.");
} else {
  app.use(express.static(publicDir));
  console.log(`✓ Serving static files from ${publicDir}`);
}

// SPA fallback: serve index.html for any non-API routes
// Note: This must be defined AFTER all API routes (both app.get and app.use)
// to avoid shadowing API endpoints. Future middleware like /api/copilotkit
// should be registered before this catch-all route.
app.get("*", (_req: Request, res: Response) => {
  res.sendFile(path.join(publicDir, "index.html"), (err) => {
    if (err) {
      console.error("Failed to serve index.html:", err);
      res.status(500).send("Application not properly deployed");
    }
  });
});

// Start server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server is running on http://0.0.0.0:${PORT}`);
  console.log(`MAX_DOC_CHARS: ${MAX_DOC_CHARS}`);
});
