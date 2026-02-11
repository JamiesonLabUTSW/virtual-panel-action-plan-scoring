import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CopilotRuntime, OpenAIAdapter, copilotRuntimeNodeHttpEndpoint } from "@copilotkit/runtime";
import { INITIAL_GRADING_STATE } from "@shared/types";
import express, { type Request, type Response } from "express";
import OpenAI from "openai";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// Environment variables
const PORT = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 7860;
const MAX_DOC_CHARS = process.env.MAX_DOC_CHARS
  ? Number.parseInt(process.env.MAX_DOC_CHARS, 10)
  : 20000;

// Validate required environment variables
const requiredEnvVars = [
  "AZURE_OPENAI_API_KEY",
  "AZURE_OPENAI_RESOURCE",
  "AZURE_OPENAI_DEPLOYMENT",
];

const missingVars = requiredEnvVars.filter((envVar) => !process.env[envVar]);

if (missingVars.length > 0) {
  console.error("❌ Missing required environment variables:");
  for (const envVar of missingVars) {
    console.error(`   - ${envVar}`);
  }
  process.exit(1);
}

const AZURE_OPENAI_API_KEY = process.env.AZURE_OPENAI_API_KEY;
const AZURE_OPENAI_RESOURCE = process.env.AZURE_OPENAI_RESOURCE;
const AZURE_OPENAI_DEPLOYMENT = process.env.AZURE_OPENAI_DEPLOYMENT;

// Initialize Azure OpenAI client with v1 API
const openaiClient = new OpenAI({
  apiKey: AZURE_OPENAI_API_KEY,
  baseURL: `https://${AZURE_OPENAI_RESOURCE}.openai.azure.com/openai/v1/`,
  defaultHeaders: {
    "api-key": AZURE_OPENAI_API_KEY,
  },
});

// Create OpenAI adapter (cast to any due to SDK typing incompatibility)
const openaiAdapter = new OpenAIAdapter({
  openai: openaiClient as any,
  model: AZURE_OPENAI_DEPLOYMENT,
});

// Initialize CopilotKit runtime
const copilotRuntime = new CopilotRuntime({
  actions: [],
});

// Verify @shared import works
console.info("✓ @shared/types imported successfully");
console.info("✓ INITIAL_GRADING_STATE:", INITIAL_GRADING_STATE);

// Middleware
app.use(express.json());

// Health check endpoint
app.get("/api/health", (_req: Request, _res: Response) => {
  _res.json({
    status: "ok",
    model: AZURE_OPENAI_DEPLOYMENT,
    api: "azure-v1",
  });
});

// CopilotKit runtime endpoint
app.use(
  "/api/copilotkit",
  copilotRuntimeNodeHttpEndpoint({
    endpoint: "/api/copilotkit",
    runtime: copilotRuntime,
    serviceAdapter: openaiAdapter,
  }) as any
);

// Serve static files from public directory (for production with client build)
const publicDir = path.join(__dirname, "../public");
if (!existsSync(publicDir)) {
  console.warn("⚠ Public directory not found. Static files will not be served.");
  console.warn("  Run 'npm run build --workspace=@grading/client' first for production mode.");
  console.warn("  In dev mode, use the Vite dev server instead.");
} else {
  app.use(express.static(publicDir));
  console.info(`✓ Serving static files from ${publicDir}`);
}

// SPA fallback: serve index.html for any non-API routes
// Note: This must be defined AFTER all API routes (both app.get and app.use)
// to avoid shadowing API endpoints.
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
  console.info(`Server running on port ${PORT}`);
  console.info(`Azure OpenAI: https://${AZURE_OPENAI_RESOURCE}.openai.azure.com/openai/v1/`);
  console.info(`MAX_DOC_CHARS: ${MAX_DOC_CHARS}`);
});
