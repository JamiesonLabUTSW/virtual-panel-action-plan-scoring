# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Status

**Phase 1 in progress.** Implementation follows 8 phases (scaffolding → features → deploy). Before starting work, read:
- Issue epic (e.g., Phase 1: Project Scaffolding)
- Sub-issue with specific requirements (e.g., #9: Initialize Root Monorepo)
- Relevant phase plan in `docs/plan/` (e.g., `01-scaffolding.md`)

## Key References

- `SPEC.md` — Complete specification (source of truth). Key sections:
  - §4.4-4.5: Zod schemas (JudgeOutput, ConsensusOutput) — **copy exactly, do not refactor or rename**
  - §4.6: Prompt templates (judge system/user, consensus system/user) — **copy exactly**
  - §5.1-5.4: Backend implementation with code samples
  - §7.1-7.5: Frontend implementation with code samples
  - §9.1-9.4: Project layout, path aliases, tsup config, Dockerfile
- `docs/plan/00-PLAN.md` — Phase overview with dependency graph and team parallelism
- `docs/plan/01-scaffolding.md` through `docs/plan/08-polish-deploy.md` — Detailed sub-issues per phase

## Project Overview

Multi-Judge LLM Grading Demo — a single-container Hugging Face Space (Docker SDK, port 7860) that runs a calibrated LLM-as-a-judge panel. Three AI judges (each calibrated with a different human rater's few-shot examples) evaluate a document against a shared rubric, then a consensus arbiter reconciles their scores. The full specification lives in `SPEC.md`.

## Stack

- **LLM:** gpt-5.1-codex-mini via Azure OpenAI v1 API
- **Backend:** Express.js + CopilotKit Runtime (`@copilotkit/runtime`) + LangChain.js (`@langchain/openai`)
- **Frontend:** React + CopilotKit (`@copilotkit/react-core`, `@copilotkit/react-ui`)
- **Structured output:** Zod schemas + `withStructuredOutput({ strict: true })` with 3-tier fallback
- **Build:** tsup (server) + Vite (client), Docker multi-stage

## Build & Run Commands

```bash
# First time: all workspace package.json files must exist before installing
# Install dependencies (monorepo: shared/, server/, client/)
npm install --workspaces

# Development
npm run dev --workspace=server     # Express dev server (tsx watch)
npm run dev --workspace=client     # Vite dev server

# Production build
npm run build --workspace=client   # Vite build → client/dist
npm run build --workspace=server   # tsup build → server/dist (bundles @shared)

# Docker
docker build -t grading-demo .
docker run -p 7860:7860 --env-file .env grading-demo
```

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
- Frontend triggers `gradeDocument` action via `useCoAgent<GradingState>.run()` with explicit `documentText`/`documentTitle` parameters
- Judges execute sequentially (avoids Azure rate limits, enables progressive UI updates)
- Each judge completion emits a `STATE_DELTA` to the frontend via AG-UI
- Consensus arbiter receives only judge outputs (not the original document) and constrains final score to `[min, max]` of judge scores

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

**Path aliases:** Both server and client use `@shared/*` → `../shared/*` (tsup bundles it, Vite resolves it).
- **server/tsconfig.json:** `paths: { "@shared/*": ["../shared/*"] }` with `rootDirs: ["src", "../shared"]`
- **server/tsup.config.ts:** `noExternal: ["@shared"]` to inline shared code into bundle (required for Docker)
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

## Structured Output 3-Tier Fallback

Each tier uses a different API mechanism (not prompt changes):
1. `withStructuredOutput({ strict: true })` → `response_format: { type: "json_schema" }`
2. `withStructuredOutput({ method: "functionCalling" })` → tool/function calling
3. `response_format: { type: "json_object" }` + runtime Zod `parse()`

## Environment Variables

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `AZURE_OPENAI_API_KEY` | Yes | — | Azure OpenAI auth |
| `AZURE_OPENAI_RESOURCE` | Yes | — | Azure resource name |
| `AZURE_OPENAI_DEPLOYMENT` | Yes | — | Deployment name |
| `PORT` | No | 7860 | Server port |
| `MAX_DOC_CHARS` | No | 20000 | Document character limit |

## Evaluation Design

Three raters with distinct calibration personas:
- **Rater A "The Professor"** — strict on structure & logic, lenient on style
- **Rater B "The Editor"** — strict on clarity & prose, lenient on depth
- **Rater C "The Practitioner"** — strict on actionability & evidence, lenient on formality

Shared rubric: Clarity (1-5), Reasoning (1-5), Completeness (1-5). `overall_score` is holistic, not an average.

Consensus arbiter references judge rationales (not the document), outputs `agreement_level` (strong/moderate/weak), and deduplicates improvement suggestions.

## Error Handling Conventions

- Single judge failure → continue grading with remaining judges, show error in UI
- 2+ judge failures → throw error, require retry
- Document text wrapped in `<document>` tags with injection defense in system prompt
- Never log document content; log only per-run metrics (scores, latency, confidence)

## Git & Tool Conventions

- **glab mr create** uses `--target-branch` (not `--base` like GitHub CLI)
- **Feature branch naming:** `feat/<issue>-<description>` (e.g., `feat/9-init-repo`)
- **npm workspaces** require all workspace `package.json` files to exist before `npm install`
- **Node version:** Enforce via both `.nvmrc` (for nvm users) and `package.json` `engines` field
