import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createOpenAI } from "@ai-sdk/openai";
import { CopilotRuntime, copilotRuntimeNodeHttpEndpoint, OpenAIAdapter } from "@copilotkit/runtime";
import { BuiltInAgent } from "@copilotkitnext/agent";
import express, { type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import OpenAI from "openai";
import pinoHttp from "pino-http";
import { GradeDocumentAgent } from "./agents/grade-document-agent";
import { exitIfInvalid, validateRequiredEnvVars } from "./config/env-validation";
import { logger } from "./utils/logger";

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
  // biome-ignore lint/suspicious/noExplicitAny: OpenAI SDK typing incompatibility with CopilotKit
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
    req.log.warn({ ip }, "Rate limit exceeded");

    // Type assertion needed: req.rateLimit added by express-rate-limit at runtime
    // biome-ignore lint/suspicious/noExplicitAny: express-rate-limit extends req at runtime
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
const copilotRuntime = new CopilotRuntime({
  agents: {
    default: new BuiltInAgent({
      model: azureAIProvider(AZURE_OPENAI_DEPLOYMENT),
    }),
    gradeDocument: new GradeDocumentAgent(),
    // biome-ignore lint/suspicious/noExplicitAny: CopilotKit SDK type compatibility
  } as any,
});

// Middleware
app.use(express.json({ limit: REQUEST_SIZE_LIMIT }));

// HTTP request logging middleware (pino-http)
// Pass logger via the `logger` option (not as second positional arg)
app.use(
  pinoHttp({
    // biome-ignore lint/suspicious/noExplicitAny: pino-http v10 type compatibility with pino v9
    logger: logger as any,
    // Custom log levels based on response status
    customLogLevel: (_req, res) => {
      if (res.statusCode >= 500) return "error";
      if (res.statusCode >= 400) return "warn";
      return "info";
    },
    // Custom log messages
    customSuccessMessage: (_req, res) => {
      return `${_req.method} ${_req.url} completed with status ${res.statusCode}`;
    },
    customErrorMessage: (_req, res, _err) => {
      return `${_req.method} ${_req.url} failed with status ${res.statusCode}`;
    },
    // Redact sensitive headers and request/response bodies
    serializers: {
      req: (req) => {
        return {
          method: req.method,
          url: req.url,
          headers: {
            ...req.headers,
            // Remove sensitive headers
            authorization: undefined,
            "x-api-key": undefined,
          },
        };
      },
      res: (res) => {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  })
);

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
  // biome-ignore lint/suspicious/noExplicitAny: CopilotKit Express handler type compatibility
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
  logger.warn("Public directory not found. Static files will not be served.");
  logger.warn("Run 'npm run build --workspace=@grading/client' first for production mode.");
  logger.warn("In dev mode, use the Vite dev server instead.");
} else {
  app.use(express.static(publicDir));
  logger.info({ publicDir }, "Serving static files");
}

// SPA fallback: serve index.html for any non-API routes
// Note: This must be defined AFTER all API routes (both app.get and app.use)
// to avoid shadowing API endpoints.
app.get("*path", (req: Request, res: Response) => {
  res.sendFile(path.join(publicDir, "index.html"), (err) => {
    if (err) {
      req.log.error({ error: err }, "Failed to serve index.html");
      res.status(500).send("Application not properly deployed");
    }
  });
});

// Start server
app.listen(PORT, "0.0.0.0", () => {
  logger.info({ port: PORT }, "Server running");
  logger.info(
    { baseURL: `https://${AZURE_OPENAI_RESOURCE}.openai.azure.com/openai/v1/` },
    "Azure OpenAI configured"
  );
});
