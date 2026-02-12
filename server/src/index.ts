import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createOpenAI } from "@ai-sdk/openai";
import { CopilotRuntime, OpenAIAdapter, copilotRuntimeNodeHttpEndpoint } from "@copilotkit/runtime";
import { BuiltInAgent } from "@copilotkitnext/agent";
import express, { type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import OpenAI from "openai";
import { GradeDocumentAgent } from "./agents/grade-document-agent";
import { exitIfInvalid, validateRequiredEnvVars } from "./config/env-validation";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// Environment variables
const PORT = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 7860;

// Rate limiting and request size configuration (Issues #56, #57)
// Note: CopilotKit's AG-UI protocol sends ~10 requests per page load and ~15
// per grading run through the single /api/copilotkit endpoint. A limit of 200
// HTTP requests/hour allows ~10 grading runs with headroom for page reloads.
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX_REQUESTS = 200;
const REQUEST_SIZE_LIMIT = "5mb";

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

// Create Vercel AI SDK OpenAI provider pointing at Azure for the default chat agent
const azureAIProvider = createOpenAI({
  baseURL: `https://${AZURE_OPENAI_RESOURCE}.openai.azure.com/openai/v1/`,
  apiKey: AZURE_OPENAI_API_KEY,
  headers: { "api-key": AZURE_OPENAI_API_KEY },
});

// Configure rate limiter for CopilotKit endpoint (Issue #56)
const gradingLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  handler: (req, res, _next, _optionsUsed) => {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    console.warn(`Rate limit exceeded for IP: ${ip} at ${new Date().toISOString()}`);

    // Type assertion needed: req.rateLimit added by express-rate-limit at runtime
    const rateLimitInfo = (req as any).rateLimit;
    const retryAfter = rateLimitInfo?.resetTime
      ? Math.ceil(rateLimitInfo.resetTime.getTime() / 1000)
      : Math.ceil((Date.now() + RATE_LIMIT_WINDOW_MS) / 1000);

    res.status(429).json({
      error: "Too many grading requests. Please try again later.",
      retryAfter, // Unix timestamp
    });
  },
});

// Initialize CopilotKit runtime with:
// - "default": BuiltInAgent for post-grading chat (uses Azure OpenAI via Vercel AI SDK)
// - "gradeDocument": Custom AbstractAgent for the multi-judge grading pipeline
// biome-ignore lint/suspicious/noExplicitAny: CopilotKit's internal @ag-ui/client types conflict with explicit dep (documented in CLAUDE.md)
const copilotRuntime = new CopilotRuntime({
  agents: {
    default: new BuiltInAgent({
      model: azureAIProvider(AZURE_OPENAI_DEPLOYMENT),
    }),
    gradeDocument: new GradeDocumentAgent(),
  } as any,
});

// Middleware
app.use(express.json({ limit: REQUEST_SIZE_LIMIT }));

// Health check endpoint
app.get("/api/health", (_req: Request, _res: Response) => {
  _res.json({
    status: "ok",
    model: AZURE_OPENAI_DEPLOYMENT,
    api: "azure-v1",
  });
});

// Apply rate limiting to CopilotKit endpoint (all subpaths)
app.use("/api/copilotkit", gradingLimiter);

// CopilotKit runtime endpoint
// IMPORTANT: Mount at root (not app.use("/api/copilotkit", ...)) because
// Express strips the mount prefix from req.url, but CopilotKit's internal
// Hono router uses req.url to match sub-paths like /api/copilotkit/info.
// Guard with path check so non-CopilotKit requests fall through to static files.
const copilotHandler = copilotRuntimeNodeHttpEndpoint({
  endpoint: "/api/copilotkit",
  runtime: copilotRuntime,
  serviceAdapter: openaiAdapter,
}) as any;

app.use((req, res, next) => {
  if (req.path.startsWith("/api/copilotkit")) {
    return copilotHandler(req, res, next);
  }
  next();
});

// Serve static files from public directory (for production with client build)
// In dev: __dirname is src/, so ../public works (client/dist symlinked or co-located)
// In prod (tsup CJS): __dirname resolves to cwd (/app), so try ./public first
const publicDir = existsSync(path.join(__dirname, "public"))
  ? path.join(__dirname, "public")
  : path.join(__dirname, "../public");
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
