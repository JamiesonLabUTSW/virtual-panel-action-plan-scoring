# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this
repository.

## Project Status

**Phase 2 in progress** (2.1 & 2.2 complete). Implementation follows 8 phases (scaffolding →
features → deploy). Before starting work, read:

- Issue epic (e.g., Phase 1: Project Scaffolding)
- Sub-issue with specific requirements (e.g., #9: Initialize Root Monorepo)
- Relevant phase plan in `docs/plan/` (e.g., `01-scaffolding.md`)

## Key References

- `SPEC.md` — Complete specification (source of truth). Key sections:
  - §4.4-4.5: Zod schemas (ActionItemReview, JudgeOutput, ConsensusOutput) — **copy exactly, do not
    refactor or rename**
  - §4.6: Prompt templates (judge system prompt loaded from `server/src/resources/rubric.txt`, judge
    user, consensus system/user) — **copy exactly**
  - §5.1-5.4: Backend implementation with code samples
  - §7.1-7.5: Frontend implementation with code samples
  - §9.1-9.4: Project layout, path aliases, tsup config, Dockerfile
- `docs/plan/00-PLAN.md` — Phase overview with dependency graph and team parallelism
- `docs/plan/01-scaffolding.md` through `docs/plan/08-polish-deploy.md` — Detailed sub-issues per
  phase

## Project Overview

Multi-Judge LLM Grading Demo — a single-container Hugging Face Space (Docker SDK, port 7860) that
runs a calibrated LLM-as-a-judge panel. Three AI judges (each calibrated with a different human
rater's few-shot examples) evaluate medical residency program action items against a shared rubric,
then a consensus arbiter reconciles their scores. The full specification lives in `SPEC.md`.

## Stack

- **LLM:** gpt-5.1-codex-mini via Azure OpenAI v1 API
- **Backend:** Express.js + CopilotKit Runtime (`@copilotkit/runtime`) + LangChain.js
  (`@langchain/openai`)
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

## Architecture

```
Browser (React + CopilotKit hooks)
    ↕ AG-UI protocol (single endpoint)
Express (port 7860)
    ├── GET  /                → React static build
    ├── POST /api/copilotkit  → CopilotKit Runtime
    │   └── Agent: gradeDocument (AbstractAgent)
    │       └── Orchestrator (LangChain.js)
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
    judge-chain.ts            # LangChain judge with 3-tier structured output fallback
    consensus-chain.ts        # LangChain consensus arbiter
    few-shot-sets.ts          # 15 calibration examples (5 per rater)
    rubric.ts                 # Shared rubric text
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
- Use `useResponsesApi: true` in LangChain's `ChatOpenAI` config
- In LangChain 1.2.7+: `maxTokens` parameter works correctly; older versions may not expose it in
  types. Use whichever parameter works with the installed LangChain version.

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

**LangChain version mismatch:** SPEC.md references structured output parameters (e.g.,
`maxOutputTokens`) that may not exist in older LangChain versions (0.5.x). If implementation
diverges from spec, check if `@langchain/openai` is outdated before assuming spec is wrong. Current
versions (@langchain/openai 1.2.7+, @langchain/core 1.1.22+, openai 6.x) support all documented
parameters.

**Core dependency versions:** @langchain/openai, @langchain/core, openai SDK, and zod should be kept
near latest. Major version upgrades of these packages typically have no breaking changes for this
project; verify with `npm run type-check && npm run test --workspace=@grading/server`.

## Azure OpenAI v1 Configuration

Both CopilotKit and LangChain share one base URL pattern:

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
import { DummyDefaultAgent } from "./agents/dummy-default-agent";
import { GradeDocumentAgent } from "./agents/grade-document-agent";

const runtime = new CopilotRuntime({
  agents: {
    default: new DummyDefaultAgent(),
    gradeDocument: new GradeDocumentAgent(),
  },
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

When integrating third-party libraries (especially complex ones like CopilotKit, LangChain):

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

## Error Handling Conventions

- Single judge failure → continue grading with remaining judges, show error in UI
- 2+ judge failures → throw error, require retry
- Proposal content provided as structured action items; system prompt loaded from
  `server/src/resources/rubric.txt` includes injection defense
- Never log proposal content; log only per-run metrics (scores, latency)

**Known Implementation Limitations:**

- **Timeout handling:** Judge chain creates AbortController but signal is not yet passed to the API
  (prepared for future SDK support). Consensus chain declares `timeoutMs` parameter but does not
  implement timeout handling yet.
- **Missing judge scores:** ConsensusOutput schema requires all three rater scores (min: 1, max: 5),
  but implementation uses sentinel value (0) for missing judges, which violates schema constraint.
  This is stored in-memory after validation but may cause issues if re-serialized or validated
  downstream.

## Code Quality Tooling

**Toolchain:** Biome (lint + format), Prettier (MD only), Vitest (coverage), Husky + lint-staged
(pre-commit), Knip (unused code), TypeDoc (API docs)

**Key commands:**

```bash
npm run lint:fix          # Auto-fix linting issues
npm run format            # Format all files (Biome + Prettier)
npm run test:coverage     # Run tests with coverage reports
npm run knip              # Detect unused dependencies/exports
npm run docs              # Generate API documentation
```

**Pre-commit hooks:** Automatically run Biome, Prettier, type-check (affected workspaces only), and
related tests on staged files. Commits are blocked if any check fails.

**Coverage thresholds:** 80% per workspace (lines, functions, branches, statements). Reports
warnings but does NOT fail builds.

**Testing library upgrades:** When upgrading @langchain/\*, openai, or zod to latest versions,
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

**Configuration files:**

- `biome.json` — Linting + formatting rules (double quotes, 100 line width, import sorting enabled)
- `.prettierrc.json` + `.prettierignore` — Markdown-only formatting
- `{workspace}/vitest.config.ts` — Per-workspace test configs with @shared alias resolution
- `.lintstagedrc.json` — Pre-commit staged file checks
- `knip.json` — Unused code detection config
- `typedoc.json` — API doc generation config

**Documentation:** See `CODE_STANDARDS.md` for detailed workflow, common issues, and
troubleshooting.

## Git & Tool Conventions

- **glab mr create** uses `--target-branch` (not `--base` like GitHub CLI)
- **Feature branch naming:** `feat/<issue>-<description>` (e.g., `feat/9-init-repo`)
- **npm workspaces** require all workspace `package.json` files to exist before `npm install`
- **npm workspace commands** use full package name (e.g., `npm test --workspace=@shared/types`, not
  `shared`)
- **Node version:** Enforce via both `.nvmrc` (for nvm users) and `package.json` `engines` field
