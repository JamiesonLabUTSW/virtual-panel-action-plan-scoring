# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this
repository.

## Project Status

**Phase 2 in progress** (2.1 & 2.2 complete). Implementation follows 8 phases (scaffolding →
features → deploy). Before starting work, read:

- Issue epic (e.g., Phase 1: Project Scaffolding)
- Sub-issue with specific requirements (e.g., #9: Initialize Root Monorepo)

## Key References

- `SPEC.md` — Complete specification (source of truth). Key sections:
  - §4.4-4.5: Zod schemas (ActionItemReview, JudgeOutput, ConsensusOutput) — **copy exactly, do not
    refactor or rename**
  - §4.6: Prompt templates (judge system prompt loaded from `server/src/resources/rubric.txt`, judge
    user, consensus system/user) — **copy exactly**
  - §5.1-5.4: Backend implementation with code samples
  - §7.1-7.5: Frontend implementation with code samples
  - §9.1-9.4: Project layout, path aliases, tsup config, Dockerfile

## Project Overview

Multi-Judge LLM Grading Demo — a single-container Hugging Face Space (Docker SDK, port 7860) that
runs a calibrated LLM-as-a-judge panel. Three AI judges (each calibrated with a different human
rater's few-shot examples) evaluate medical residency program action items against a shared rubric,
then a consensus arbiter reconciles their scores. The full specification lives in `SPEC.md`.

## Stack

- **LLM:** gpt-5.1-codex-mini via Azure OpenAI v1 API
- **Backend:** Express.js + CopilotKit Runtime (`@copilotkit/runtime`) + OpenAI SDK v6 (direct
  Responses API access)
- **Frontend:** React + CopilotKit (`@copilotkit/react-core`, `@copilotkit/react-ui`)
- **Structured output:** Zod schemas + `withStructuredOutput({ strict: true })` with 3-tier fallback
- **Build:** tsup (server) + Vite (client), Docker multi-stage

## Build & Run Commands

**Express 5 / path-to-regexp:** Bare `"*"` wildcard routes error with "Missing parameter name". Use
named wildcards: `app.get("*path", handler)` instead of `app.get("*", handler)`.

```bash
# First time: all workspace package.json files must exist before installing
# Install dependencies (monorepo: shared/, server/, client/)
npm install --workspaces

# Development (preferred - shell scripts handle env var loading)
./start-dev-server.sh  # Server with .env loaded + OPENAI_* → AZURE_OPENAI_* bridging
./start-dev-client.sh  # Client dev server

# Or run directly via npm
npm run dev --workspace=@grading/server  # Express dev server (tsx watch)
npm run dev --workspace=@grading/client  # Vite dev server

# Testing
npm test --workspace=@shared/types    # Run tests (vitest configured in each package)

# Integration tests (gated by env var, require real Azure credentials)
./run-integration-tests.sh            # Loads .env, sets RUN_INTEGRATION_TESTS=true, runs gated tests
# Use it.skipIf(!process.env.RUN_INTEGRATION_TESTS) to gate expensive API calls

# Production build
npm run build --workspace=@grading/client   # Vite build → client/dist
npm run build --workspace=@grading/server   # tsup build → server/dist (bundles @shared)

# Docker
docker build -t grading-demo .
docker run -p 7860:7860 --env-file .env grading-demo
```

**Test packages** (e.g., shared/): Include `"test": "vitest run"` and `"test:watch": "vitest"`
scripts in package.json; place tests in `__tests__/` directory.

**Testing patterns**:

- Follow existing test structure in `__tests__/` directories (see `orchestrator.test.ts` for
  patterns)
- Use Vitest mocks for external dependencies (`vi.mock("../judge-chain")` pattern)
- Mock helper functions: `createMockJudgeOutput()`, `createMockJudgeResult()`,
  `createMockConsensusResult()`
- Track emitted states with `emittedStates` array to verify state progression

**UAT with Playwright**: Start servers with `./start-dev-server.sh` and `./start-dev-client.sh`,
then use Playwright MCP tools for end-to-end testing (navigate, click, wait, snapshot).

## Logging Conventions

The server uses [pino](https://github.com/pinojs/pino) for structured logging.

**Usage pattern:**

```typescript
import logger from "./utils/logger";

// Component-level child logger
const myLogger = logger.child({ component: "orchestrator", proposalId });

// Structured fields first, message last
myLogger.info({ latencyMs, tier, tokens }, "Judge evaluation completed");
myLogger.error({ judgeId, error }, "Judge evaluation failed");
```

**Log levels:**

- `logger.debug()` — Verbose diagnostics (e.g., "content safety check started")
- `logger.info()` — Business metrics (scores, latency, agreement, token usage)
- `logger.warn()` — Degraded execution (single judge failure, rate limits)
- `logger.error()` — Hard stops (consensus formation failure, missing env vars)

**Environment variables:**

- `LOG_LEVEL` — Set to `debug`, `info`, `warn`, or `error` (default: `info` in prod, `debug` in dev)
- `NODE_ENV=development` — Enables pino-pretty (colored, human-readable output)
- `NODE_ENV=production` — Line-delimited JSON for log aggregators

**Automatic HTTP logging:**

- `pino-http` middleware logs every request/response with status code, latency, and request ID
- Request logs: `req.log.info()`, `req.log.warn()`, `req.log.error()`

**pino + pino-http compatibility:**

- **Do NOT use `pino.transport()`** to create the logger — it returns a worker-thread stream that
  breaks when pino-http creates child loggers (`stream.write is not a function`). Use pino's inline
  `transport` option instead: `pino({ transport: { target: "pino-pretty", options: {...} } })`
- Pass logger to pinoHttp via `{ logger }` option, not as the second positional argument
- CopilotKit runtime bundles `pino@9` internally. Server's pino and pino-http versions must align
  with pino 9 (use `pino-http@^10`, not `^11` which requires pino 10)

**Security:**

- Proposal content automatically redacted via `redact.paths` config
- Authorization headers stripped from request logs
- Technical error details logged server-side only (sanitized messages sent to users)

**Testing:**

- Use `logger.child({ test: true })` in tests to isolate log output
- No console.\* calls allowed in production code (enforced by Biome `noConsole` rule)
- **Debugging tip:** pino-pretty runs in a worker thread whose output bypasses shell redirection. To
  see server crash errors, set `NODE_ENV=production` for JSON output to stdout, or remove the
  `transport` option temporarily

## Architecture

```
Browser (React + CopilotKit hooks)
    ↕ AG-UI protocol (single endpoint)
Express (port 7860)
    ├── GET  /                → React static build
    ├── POST /api/copilotkit  → CopilotKit Runtime
    │   └── Agent: gradeDocument (AbstractAgent)
    │       └── Orchestrator (OpenAI SDK)
    │           ├── Judge A (Rater A few-shot calibration)
    │           ├── Judge B (Rater B few-shot calibration)
    │           ├── Judge C (Rater C few-shot calibration)
    │           └── Consensus arbiter
    └── GET  /api/health      → liveness probe
    ↕ HTTPS
Azure OpenAI (gpt-5.1-codex-mini)
```

**Key flows:**

- Frontend triggers `gradeDocument` agent via `useAgent({ agentId }).agent.runAgent()` (not
  `useCoAgent.run()` which is broken in v1.51) with explicit proposal parameters
- Judges execute in parallel (faster completion, progressive state emissions as each completes)
- Each judge completion emits a `STATE_SNAPSHOT` to the frontend via AG-UI
- Consensus arbiter receives only judge outputs (not the original proposal) and constrains final
  score to `[min, max]` of judge scores

## Project Layout

```
shared/          # Types (GradingState, Phase, JudgeState) + Zod schemas (JudgeOutput, ConsensusOutput)
server/src/
  index.ts                    # Express setup, CopilotKit runtime mount
  agents/grade-document-agent.ts  # CopilotKit agent (AbstractAgent subclass)
  grading/
    orchestrator.ts           # Parallel judge pipeline + progressive state emission
    judge-chain.ts            # Judge evaluation with 3-tier structured output fallback
    consensus-chain.ts        # Consensus arbiter
    structured-output.ts      # 3-tier fallback helper (OpenAI Responses API)
    few-shot-sets.ts          # 15 calibration examples (5 per rater)
    rubric.ts                 # Shared rubric text
    content-safety.ts         # Content safety validation
  resources/
    rubric.txt                # Evaluation rubric (system prompt)
    action_item/              # 8 medical specialty action item documents
    ratings/                  # 24 rater JSON files (8 per rater)
      rater_a/
      rater_b/
      rater_c/
client/src/
  App.tsx                     # CopilotKit provider
  components/
    GradingView.tsx           # Main container, action invocation, chat sidebar
    DocumentInput.tsx         # Text/file input
    GradingTimeline.tsx       # Horizontal stepper (Rater A/B/C → Consensus)
    JudgeCards.tsx            # 3-column grid of judge results
    ConsensusPanel.tsx        # Final score, agreement visualization
```

**Path aliases:** Both server and client use `@shared/*` → `../shared/*` (tsup bundles it, Vite
resolves it).

- **server/tsconfig.json:** `paths: { "@shared/*": ["../shared/*"] }` with
  `rootDirs: ["src", "../shared"]`
- **server/tsup.config.ts:** `noExternal: ["@shared"]` to inline shared code into bundle (required
  for Docker)
- **client/vite.config.ts:** `alias: { "@shared": path.resolve(__dirname, "../shared") }`

## Critical Model Constraints (gpt-5.1-codex-mini)

This is a reasoning model with non-standard parameter support:

- **DO NOT** pass `temperature`, `max_tokens`, or `top_p` — they will error
- Use `max_output_tokens` (Responses API) or `max_completion_tokens` (Chat Completions API)
- `reasoning_effort` defaults to `none`; set explicitly if needed
- Implementation uses OpenAI SDK v6 directly with `client.responses.create()` for Responses API

**Azure Responses API (OpenAI SDK):**

- gpt-5.1-codex-mini **does NOT support Chat Completions API** — use Responses API
  (`client.responses.create()`)
- Use standard `OpenAI` client (not `AzureOpenAI`) with Azure baseURL:
  `https://${resource}.openai.azure.com/openai/v1/`
- Parameters: `input` (user message), `instructions` (system prompt), `text.format` (replaces
  `response_format`), `max_output_tokens` (replaces `max_completion_tokens`)
- Response structure: `response.content[0].text` (not `choices[0].message.content`)
- Usage tokens: `input_tokens`/`output_tokens` (not `prompt_tokens`/`completion_tokens`)

## Library Version Notes

**OpenAI SDK:** Implementation uses OpenAI SDK v6 directly for Responses API access. Structured
output parameters (`max_output_tokens`, `text.format`) are well-supported. Keep `openai` package at
^6.0.0 or later.

**Core dependency versions:** OpenAI SDK, zod, and zod-to-json-schema should be kept near latest.
Major version upgrades of these packages typically have no breaking changes for this project; verify
with `npm run type-check && npm run test --workspace=@grading/server`.

## Azure OpenAI v1 Configuration

Both CopilotKit and the grading orchestrator share one base URL pattern:

```
https://${AZURE_OPENAI_RESOURCE}.openai.azure.com/openai/v1/
```

No legacy `api-version` query params. Standard OpenAI SDK patterns apply.

## CopilotKit + Express Integration

**AG-UI event ordering:** After emitting `RUN_ERROR`, do NOT emit `RUN_FINISHED` or any other events
— AG-UI's verify layer throws `AGUIError: Cannot send event type 'RUN_FINISHED'`. After a terminal
event (`RUN_ERROR` or `RUN_FINISHED`), only call `subscriber.complete()`.

When integrating CopilotKit runtime with Express, the OpenAI client and
`copilotRuntimeNodeHttpEndpoint` require `as any` casts due to SDK type incompatibilities
(documented in official CopilotKit examples).

```typescript
// OpenAI client cast needed for OpenAIAdapter type mismatch
const adapter = new OpenAIAdapter({
  openai: openaiClient as any,
  model: AZURE_OPENAI_DEPLOYMENT,
});

// IMPORTANT: Mount at root (not app.use("/api/copilotkit", ...)) because
// Express strips the mount prefix from req.url, but CopilotKit's internal
// Hono router uses req.url to match sub-paths like /api/copilotkit/info.
app.use(
  copilotRuntimeNodeHttpEndpoint({
    endpoint: "/api/copilotkit",
    runtime,
    serviceAdapter: adapter,
  }) as any
);
```

These casts are safe at runtime; only the type system complains due to version/interface mismatches.
This pattern is used in official CopilotKit examples.

## CopilotKit Agent Registration

The grading pipeline uses a custom `AbstractAgent` subclass (not a CopilotKit action). Agents are
registered in `CopilotRuntime` via the `agents` record. A `default` agent **must** be registered
alongside custom agents (CopilotKit's `CopilotListeners` always looks for it):

```typescript
import { BuiltInAgent } from "@copilotkitnext/agent";
import { createOpenAI as createAzureOpenAI } from "@ai-sdk/openai";
import { GradeDocumentAgent } from "./agents/grade-document-agent";

// Vercel AI SDK provider for CopilotKit's default agent
const azureAIProvider = createAzureOpenAI({
  baseURL: `https://${process.env.AZURE_OPENAI_RESOURCE}.openai.azure.com/openai/v1/`,
  apiKey: process.env.AZURE_OPENAI_API_KEY,
  headers: {
    "api-key": process.env.AZURE_OPENAI_API_KEY,
  },
});

const runtime = new CopilotRuntime({
  agents: {
    default: new BuiltInAgent({
      model: azureAIProvider(process.env.AZURE_OPENAI_DEPLOYMENT),
    }),
    gradeDocument: new GradeDocumentAgent(),
  } as any, // Type cast needed for SDK compatibility
});
```

The agent's `run()` method returns an RxJS `Observable<BaseEvent>` that emits `STATE_SNAPSHOT`
events as the grading pipeline progresses. The frontend subscribes via
`useCoAgent<GradingState>({ name: "gradeDocument" })`.

**CopilotKit v1.51 Agent Hook Workarounds:**

- **`useCoAgent.run()` is broken** — returns `agent.runAgent` as detached method reference, losing
  `this` context (`HttpAgent.runAgent` throws "Cannot set properties of undefined (setting
  'abortController')"). Use `useAgent()` from `@copilotkitnext/react` to get the bound agent
  instance and call `agent.runAgent()` directly.
- **Hidden `CopilotChat` required** — `useCoAgent`/`useAgent` depend on chat infrastructure
  (`abortControllerRef`, `connectAgent`) only initialized by a mounted `CopilotChat`. Mount one with
  `display: none` if chat UI isn't needed yet.
- **`running` from `useCoAgent`** means "requests are routed to this agent", **not** "agent is
  executing". Use `useCopilotChat().isLoading` for actual execution status.
- **`agent.runAgent(data)` does NOT pass `data` as agent state** — CopilotKit sends `agent.state`
  (the hook-managed state) as `input.state` in the HTTP body. To pass data to the server agent, call
  `setState()` from `useCoAgent` before `agent.runAgent()`. The `setState` call synchronously
  updates `agent.state` via `agent.setState()`, so it's available when `runAgent()` constructs the
  request.

## Structured Output 3-Tier Fallback

Each tier uses a different API mechanism (not prompt changes):

1. `withStructuredOutput({ strict: true })` → `response_format: { type: "json_schema" }`
2. `withStructuredOutput({ method: "functionCalling" })` → tool/function calling
3. `response_format: { type: "json_object" }` + runtime Zod `parse()`

**Zod schema pattern:** Every field must include `.describe()` for model documentation. Never use
`z.optional()`; use `z.nullable()` if a field can be null. Field order in schema matches SPEC
exactly (becomes the documentation contract).

**Responses API JSON schema strict mode requirements:**

- JSON schema must include: `type: "object"`, `additionalProperties: false`, `properties` field,
  `name` field
- Use `zod-to-json-schema` with `{ target: "openApi3", $refStrategy: "none" }` to inline all
  definitions
- Validate with defensive checks before API call (add missing `type`/`additionalProperties` if
  needed)

## Environment Variables

| Variable                  | Required | Default | Purpose                  |
| ------------------------- | -------- | ------- | ------------------------ |
| `AZURE_OPENAI_API_KEY`    | Yes      | —       | Azure OpenAI auth        |
| `AZURE_OPENAI_RESOURCE`   | Yes      | —       | Azure resource name      |
| `AZURE_OPENAI_DEPLOYMENT` | Yes      | —       | Deployment name          |
| `PORT`                    | No       | 7860    | Server port              |
| `MAX_DOC_CHARS`           | No       | 20000   | Document character limit |

## Environment Validation

At server startup, validate all required environment variables **before** initializing the app. Use
fail-fast approach with clear error messages.

**Pattern:** Extracted utilities for testability (Issue #21), located in
`server/src/config/env-validation.ts`:

```typescript
// In server/src/index.ts
import { exitIfInvalid, validateRequiredEnvVars } from "./config/env-validation";

const envValidation = validateRequiredEnvVars();
exitIfInvalid(envValidation);

// After exitIfInvalid(), validated values are guaranteed to be defined
const AZURE_OPENAI_API_KEY = envValidation.values.AZURE_OPENAI_API_KEY!;
const AZURE_OPENAI_RESOURCE = envValidation.values.AZURE_OPENAI_RESOURCE!;
const AZURE_OPENAI_DEPLOYMENT = envValidation.values.AZURE_OPENAI_DEPLOYMENT!;
```

The utilities provide:

- `validateRequiredEnvVars(env?)`: Returns `{ isValid, missingVars, values }` for testability
- `exitIfInvalid(result)`: Logs errors and calls `process.exit(1)` if validation fails

Exit with code 1 and clear error list. Never just warn—silent failures break production deployments.

## TypeScript Configuration

- **tsconfig.json "references"**: Remove `"references": [{ "path": "./" }]` from packages with
  `"noEmit": true` (causes TS6305/TS6306 errors in strict mode)
- **server/tsconfig.json path resolution**: Use `rootDirs: ["src", "../shared"]` (not `rootDir`) to
  avoid TS6059 when including external packages. Also exclude shared tests:
  ```json
  "rootDirs": ["src", "../shared"],
  "include": ["src/**/*", "../shared/**/*.ts", "!../shared/**/*.test.ts"],
  "exclude": ["node_modules", "dist", "../shared/__tests__"]
  ```
- **client/tsconfig.json & tsconfig.app.json**: Remove all `"references"` fields to avoid composite
  project conflicts with `noEmit: true`
- **Unused parameters in strict mode**: When `noUnusedParameters: true`, prefix unused params with
  `_` (e.g., `_req`, `_res`) to avoid TS6133 errors

## Library Integration & Documentation

When integrating third-party libraries (especially complex ones like CopilotKit):

- Use Context7 (`mcp__plugin_context7_context7__resolve-library-id` → `__query-docs`) to find
  official integration examples and patterns
- Search documentation for "Express integration," "server setup," or library-specific gotchas
- Check for known typing issues with other SDKs (e.g., OpenAI SDK compatibility with CopilotKit)
- Review official docs for any `as any` workarounds or documented type incompatibilities

## Vite Dev Server Configuration

Client Vite proxy is pre-configured in `client/vite.config.ts`:

- `/api/*` requests forward to `http://localhost:7860` (Express server on port 7860)
- Allows relative URLs in client code (e.g., `runtimeUrl="/api/copilotkit"`)
- Works in both dev mode and production without changes
- No need to reconfigure this for new API endpoints; just add them to the server

## Evaluation Design

Three raters with distinct calibration personas:

- **Rater A "The Professor"** — strict on structure, quantitative targets, and metric specificity
- **Rater B "The Editor"** — generous on feasibility and clarity, focuses on achievability
- **Rater C "The Practitioner"** — strict on actionability, data richness, and practical impact

Shared rubric: 1-5 scale (Poor/Weak/Adequate/Strong/Excellent) loaded from
`server/src/resources/rubric.txt`. `overall_score` is holistic, not an average of item scores.

Consensus arbiter references judge rationales (not the original proposal), outputs `agreement_level`
(strong/moderate/weak), and deduplicates improvement suggestions.

## Action Item Parsing

**Critical architectural decision**: Each document is ONE action item, not split by lines.

- Frontend sends `[text.trim()]` as single-item array (entire document as one element)
- Server truncates by character count (20,000 chars max), not item count
- `wasTruncated` flag set when original text exceeds 20k chars
- Users paste multi-paragraph documents; splitting by newlines would break the content

## Error Handling Conventions

- Single judge failure → continue grading with remaining judges, show error in UI
- 2+ judge failures → throw error, require retry
- Proposal content provided as structured action items; system prompt loaded from
  `server/src/resources/rubric.txt` includes injection defense
- Never log proposal content; log only per-run metrics (scores, latency)
- **Error sanitization**: All user-facing errors use generic message "An error occurred during
  evaluation. Please try again." Technical details logged server-side only
- **State reset pattern**: Use `setState(INITIAL_GRADING_STATE)` for full reset, not spread
  operator—prevents stale data in CopilotKit chat context

**Known Implementation Limitations:**

- **Timeout handling:** Judge chain creates AbortController but signal is not yet passed to the API
  (prepared for future SDK support). Consensus chain declares `timeoutMs` parameter but does not
  implement timeout handling yet.
- **Missing judge scores:** ConsensusOutput schema requires all three rater scores (min: 1, max: 5),
  but implementation uses sentinel value (0) for missing judges, which violates schema constraint.
  This is stored in-memory after validation but may cause issues if re-serialized or validated
  downstream.

## Code Quality Tooling

**Toolchain:** Biome v2 (lint + format + security), Prettier (MD only), Vitest (coverage), Husky +
lint-staged (pre-commit), Knip (unused code), TypeDoc (API docs)

**Key commands:**

```bash
npm run lint:fix          # Auto-fix linting issues
npm run format            # Format all files (Biome + Prettier)
npm run test:coverage     # Run tests with coverage reports
npm run knip              # Detect unused dependencies/exports
npm run docs              # Generate API documentation
npm run audit:security    # Check for high/critical dependency vulnerabilities (non-blocking)
npm run secrets:check     # Scan staged files for secrets via gitleaks (non-blocking)
npm run secrets:scan-all  # Scan entire git history for secrets
```

**Pre-commit hooks:** Run secret scan (gitleaks, non-blocking) → dependency audit (non-blocking) →
lint-staged (Biome, Prettier, type-check, related tests). Security checks are informational only;
lint/type/test failures block commits.

**Coverage thresholds:** 80% per workspace (lines, functions, branches, statements). Reports
warnings but does NOT fail builds.

**Testing library upgrades:** When upgrading openai, zod, or zod-to-json-schema to latest versions,
follow this safe path:

1. Update package.json versions and run `npm install --workspaces`
2. Run `npm run type-check --workspace=@grading/server` to catch type errors
3. Run `npm run test --workspace=@grading/server` to validate behavior
4. If all pass, the upgrade is safe (this codebase has clean breaking-change tests)

**Configuration patterns & gotchas:**

- **Vitest shared coverage config:** Export from root `vitest.config.shared.ts`, import in workspace
  configs. TypeScript strict typing requires: (1) `reporter` array without `as const` (must be
  mutable), (2) `watermarks` typed as `[number, number]` tuples not `number[]`
- **Lint-staged file passing:** Use workspace commands from root
  (`npm run script --workspace=@pkg/name`), NOT bash wrappers (`bash -c 'cd dir && cmd'`). Bash
  wrappers prevent lint-staged from appending file arguments
- **Husky v9+ hooks:** No husky.sh sourcing needed - just shebang + command in `.husky/*` files
- **Biome v2 config migration:** `files.ignore` → `files.includes` (allowlist), `organizeImports` →
  `assist.actions.source.organizeImports`, `noConsoleLog` → `noConsole`. The `biome migrate` command
  fails on Tailwind CSS parse errors — manual migration may be needed.
- **Biome v2 CSS:** Exclude CSS from `files.includes` if using Tailwind `@apply` — Biome can't parse
  it and will error.
- **Biome `noSecrets` rule:** Flags high-entropy test name strings as false positives. Suppress with
  `// biome-ignore lint/security/noSecrets: <reason>`

**Configuration files:**

- `biome.json` — Linting + formatting rules (double quotes, 100 line width, import sorting enabled)
- `gitleaks.toml` — Secret scanning config with allowlists for test fixtures and example files
- `.prettierrc.json` + `.prettierignore` — Markdown-only formatting
- `{workspace}/vitest.config.ts` — Per-workspace test configs with @shared alias resolution
- `.lintstagedrc.json` — Pre-commit staged file checks
- `knip.json` — Unused code detection config
- `typedoc.json` — API doc generation config

**Documentation:** See `CODE_STANDARDS.md` for detailed workflow, common issues, and
troubleshooting.

## Security Tooling

Three-phase security tooling (see `docs/SECURITY_TOOLING.md` for full details):

- **Phase 1 — Dependency audit:** `npm audit` in pre-commit (non-blocking, `|| true`)
- **Phase 2 — Secret scanning:** gitleaks pre-commit hook (`scripts/check-secrets.sh`), config in
  `gitleaks.toml`. Gracefully skips if gitleaks not installed (`brew install gitleaks`)
- **Phase 3 — Static analysis:** Biome v2 security rules (`noGlobalEval`,
  `noDangerouslySetInnerHtml`, `noSecrets`) at error level. Zero new dependencies.

All remaining dependency vulnerabilities (16 moderate) are transitive — none directly used. Tracked
in GitLab issue #67.

## Git & Tool Conventions

- **glab mr create** uses `--target-branch` (not `--base` like GitHub CLI)
- **glab label create** uses `--name` flag (not positional):
  `glab label create --name "label" --color '#hex'`
- **Feature branch naming:** `feat/<issue>-<description>` (e.g., `feat/9-init-repo`)
- **npm workspaces** require all workspace `package.json` files to exist before `npm install`
- **npm workspace commands** use full package name (e.g., `npm test --workspace=@shared/types`, not
  `shared`)
- **Node version:** Enforce via both `.nvmrc` (for nvm users) and `package.json` `engines` field

## Dependency Version Constraints

**npm overrides** (in root `package.json`) force single versions across the monorepo to prevent
hoisting conflicts. Current overrides: `vite ^6`, `esbuild >=0.25.0`, `rxjs 7.8.1`,
`prismjs 1.30.0`.

**Version alignment rules:**

- **vitest** major version must match **vite** major version (vitest 3.x for vite 6.x). Mismatch
  causes duplicate vite copies and plugin crashes (`createIdResolver is not a function`)
- **pino** version is pinned by `@copilotkit/runtime` (currently pino@9). Do not upgrade pino or
  pino-http independently — check `npm ls pino` for conflicts first
- **vitest 3.x** changed `vi.fn` type signature: use `vi.fn<(arg: T) => R>()` (single function type
  param), not `vi.fn<[T], R>()` (separate args/return params)
- When debugging dependency issues, always run `npm ls <package>` to check for duplicate versions
  before changing package.json. Add npm overrides only when deduplication can't be achieved by
  aligning direct dependency ranges
