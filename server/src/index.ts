import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CopilotRuntime, OpenAIAdapter, copilotRuntimeNodeHttpEndpoint } from "@copilotkit/runtime";
import express, { type Request, type Response } from "express";
import OpenAI from "openai";
import { DummyDefaultAgent } from "./agents/dummy-default-agent";
import { GradeDocumentAgent } from "./agents/grade-document-agent";
import { exitIfInvalid, validateRequiredEnvVars } from "./config/env-validation";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// Environment variables
const PORT = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 7860;

// Validate required environment variables (Issue #21)
const envValidation = validateRequiredEnvVars();
exitIfInvalid(envValidation);

// After exitIfInvalid(), these values are guaranteed to be defined
// biome-ignore lint/style/noNonNullAssertion: Safe after exitIfInvalid() validation
const AZURE_OPENAI_API_KEY = envValidation.values.AZURE_OPENAI_API_KEY!;
// biome-ignore lint/style/noNonNullAssertion: Safe after exitIfInvalid() validation
const AZURE_OPENAI_RESOURCE = envValidation.values.AZURE_OPENAI_RESOURCE!;
// biome-ignore lint/style/noNonNullAssertion: Safe after exitIfInvalid() validation
const AZURE_OPENAI_DEPLOYMENT = envValidation.values.AZURE_OPENAI_DEPLOYMENT!;

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

// Initialize CopilotKit runtime with gradeDocument agent + dummy default agent
// WORKAROUND: CopilotKit provider's CopilotListeners always looks for 'default' agent
// We register a dummy one to prevent provider crash. Real fix: figure out multi-agent pattern.
// biome-ignore lint/suspicious/noExplicitAny: CopilotKit's internal @ag-ui/client types conflict with explicit dep (documented in CLAUDE.md)
const copilotRuntime = new CopilotRuntime({
  agents: {
    default: new DummyDefaultAgent(),
    gradeDocument: new GradeDocumentAgent(),
  } as any,
});

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
// IMPORTANT: Mount at root (not app.use("/api/copilotkit", ...)) because
// Express strips the mount prefix from req.url, but CopilotKit's internal
// Hono router uses req.url to match sub-paths like /api/copilotkit/info.
app.use(
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
app.get("*path", (_req: Request, res: Response) => {
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
});
