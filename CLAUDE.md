# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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
