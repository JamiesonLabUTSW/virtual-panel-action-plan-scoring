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
  - §4.4-4.5: Zod schemas (JudgeOutput, ConsensusOutput) — **copy exactly, do not refactor or
    rename**
  - §4.6: Prompt templates (judge system/user, consensus system/user) — **copy exactly**
  - §5.1-5.4: Backend implementation with code samples
  - §7.1-7.5: Frontend implementation with code samples
  - §9.1-9.4: Project layout, path aliases, tsup config, Dockerfile
- `docs/plan/00-PLAN.md` — Phase overview with dependency graph and team parallelism
- `docs/plan/01-scaffolding.md` through `docs/plan/08-polish-deploy.md` — Detailed sub-issues per
  phase

## Project Overview

Multi-Judge LLM Grading Demo — a single-container Hugging Face Space (Docker SDK, port 7860) that
runs a calibrated LLM-as-a-judge panel. Three AI judges (each calibrated with a different human
rater's few-shot examples) evaluate a document against a shared rubric, then a consensus arbiter
reconciles their scores. The full specification lives in `SPEC.md`.

## Stack

- **LLM:** gpt-5.1-codex-mini via Azure OpenAI v1 API
- **Backend:** Express.js + CopilotKit Runtime (`@copilotkit/runtime`) + LangChain.js
  (`@langchain/openai`)
- **Frontend:** React + CopilotKit (`@copilotkit/react-core`, `@copilotkit/react-ui`)
- **Structured output:** Zod schemas + `withStructuredOutput({ strict: true })` with 3-tier fallback
- **Build:** tsup (server) + Vite (client), Docker multi-stage

## Build & Run Commands

```bash
# First time: all workspace package.json files must exist before installing
# Install dependencies (monorepo: shared/, server/, client/)
npm install --workspaces

# Development
npm run dev --workspace=@grading/server  # Express dev server (tsx watch)
npm run dev --workspace=@grading/client  # Vite dev server

# Testing
npm test --workspace=@shared/types    # Run tests (vitest configured in each package)

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
    │   └── Action: gradeDocument
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

- Frontend triggers `gradeDocument` action via `useCoAgent<GradingState>.run()` with explicit
  `documentText`/`documentTitle` parameters
- Judges execute sequentially (avoids Azure rate limits, enables progressive UI updates)
- Each judge completion emits a `STATE_DELTA` to the frontend via AG-UI
- Consensus arbiter receives only judge outputs (not the original document) and constrains final
  score to `[min, max]` of judge scores

## Project Layout

```
shared/          # Types (GradingState, Phase, JudgeState) + Zod schemas (JudgeOutput, ConsensusOutput)
server/src/
  index.ts                    # Express setup, CopilotKit runtime mount
  actions/grade-document.ts   # CopilotKit action definition
  grading/
    orchestrator.ts           # Sequential judge pipeline + state emission
    judge-chain.ts            # LangChain judge with 3-tier structured output fallback
    consensus-chain.ts        # LangChain consensus arbiter
    few-shot-sets.ts          # 15 calibration examples (5 per rater)
    rubric.ts                 # Shared rubric text
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

## Azure OpenAI v1 Configuration

Both CopilotKit and LangChain share one base URL pattern:

```
https://${AZURE_OPENAI_RESOURCE}.openai.azure.com/openai/v1/
```

No legacy `api-version` query params. Standard OpenAI SDK patterns apply.

## CopilotKit + Express Integration

When integrating CopilotKit runtime with Express, the OpenAI client and
`copilotRuntimeNodeHttpEndpoint` require `as any` casts due to SDK type incompatibilities
(documented in official CopilotKit examples).

```typescript
// OpenAI client cast needed for OpenAIAdapter type mismatch
const adapter = new OpenAIAdapter({
  openai: openaiClient as any,
  model: AZURE_OPENAI_DEPLOYMENT,
});

// copilotRuntimeNodeHttpEndpoint cast needed for Express middleware type mismatch
app.use(
  "/api/copilotkit",
  copilotRuntimeNodeHttpEndpoint({
    endpoint: "/api/copilotkit",
    runtime,
    serviceAdapter: adapter,
  }) as any
);
```

These casts are safe at runtime; only the type system complains due to version/interface mismatches.
This pattern is used in official CopilotKit examples.

## Structured Output 3-Tier Fallback

Each tier uses a different API mechanism (not prompt changes):

1. `withStructuredOutput({ strict: true })` → `response_format: { type: "json_schema" }`
2. `withStructuredOutput({ method: "functionCalling" })` → tool/function calling
3. `response_format: { type: "json_object" }` + runtime Zod `parse()`

**Zod schema pattern:** Every field must include `.describe()` for model documentation. Never use
`z.optional()`; use `z.nullable()` if a field can be null. Field order in schema matches SPEC
exactly (becomes the documentation contract).

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
fail-fast approach with clear error messages:

```typescript
const missingVars = requiredEnvVars.filter((v) => !process.env[v]);
if (missingVars.length > 0) {
  console.error("❌ Missing required environment variables:");
  for (const v of missingVars) console.error(`   - ${v}`);
  process.exit(1);
}
```

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

- **Rater A "The Professor"** — strict on structure & logic, lenient on style
- **Rater B "The Editor"** — strict on clarity & prose, lenient on depth
- **Rater C "The Practitioner"** — strict on actionability & evidence, lenient on formality

Shared rubric: Clarity (1-5), Reasoning (1-5), Completeness (1-5). `overall_score` is holistic, not
an average.

Consensus arbiter references judge rationales (not the document), outputs `agreement_level`
(strong/moderate/weak), and deduplicates improvement suggestions.

## Error Handling Conventions

- Single judge failure → continue grading with remaining judges, show error in UI
- 2+ judge failures → throw error, require retry
- Document text wrapped in `<document>` tags with injection defense in system prompt
- Never log document content; log only per-run metrics (scores, latency, confidence)

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
