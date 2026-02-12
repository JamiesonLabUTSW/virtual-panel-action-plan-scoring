> **Domain Pivot (Phase 3+):** The evaluation domain has changed from generic document quality
> grading to **medical residency program action item evaluation**. Resource files (rubric, action
> items, ratings) live in `server/src/resources/`. Schemas now use the `log_review` format. See
> SPEC.md for the updated specification.

# Implementation Plan Overview

This document breaks the Multi-Judge LLM Grading Demo into implementation phases. Each phase has its
own detailed plan document (linked below). Phases are sequenced so that high-risk integration
questions are answered first, and each phase produces a working increment that can be tested
independently.

> **Source of truth:** `SPEC.md` (v3). This plan follows its architecture, schemas, and milestones.
> When this plan and the spec diverge, the spec wins.

---

## Phase Dependency Graph

```
Phase 1: Project Scaffolding & Shared Package
    │
    ├──► Phase 2: CopilotKit + Azure v1 Spike  ──► Phase 3: LangChain Structured Output Spike
    │                                                        │
    │                                                        ▼
    │                                              Phase 4: Judge Pipeline & Consensus
    │                                                        │
    │                                              ┌─────────┴─────────┐
    │                                              ▼                   ▼
    │                                    Phase 5: Frontend UI    Phase 6: Few-Shot ◄── parallel
    │                                              │                   │
    │                                              └─────────┬─────────┘
    │                                                        ▼
    │                                              Phase 7: Chat Integration
    │                                                        │
    │                                                        ▼
    └────────────────────────────────────────────► Phase 8: Polish, Security & Deploy
```

## Cross-Phase Parallelism for Multiple Developers

Beyond the per-phase parallel tracks (detailed in each phase document), a team can exploit these
**cross-phase** parallelism opportunities:

### Opportunity 1: Phase 5 + Phase 6 in parallel (after Phase 4)

Phase 5 (Frontend UI) and Phase 6 (Few-Shot Calibration) touch completely different parts of the
codebase:

- Phase 5 = `client/src/components/*.tsx` + `client/src/utils/`
- Phase 6 = `server/src/grading/few-shot-sets.ts` + content authoring

**Constraint:** Phase 6.4 (validation) benefits from the Phase 5 UI to visually confirm rater
differentiation, but the authoring work (6.1-6.3) can proceed without it.

### Opportunity 2: Phase 6 authoring can start during Phase 4

Few-shot example authoring (6.1, 6.2, 6.3) only needs the `JudgeOutput` Zod schema (from Phase 1)
and knowledge of the rater personas (from the spec). A content-focused developer can begin drafting
examples while the pipeline is being built in Phase 4. The examples just need to be validated
against the live pipeline once Phase 4 completes.

### Opportunity 3: Phase 5 foundation can start during Phase 4

Sub-issue 5.8 (Score Color Utility) and 5.1 (DocumentInput) have no dependency on the working
pipeline — they only need shared types from Phase 1. A frontend developer can start these while
Phase 4 is in progress.

### Recommended Team Allocation (2-3 developers)

```
Timeline:  ──────────────────────────────────────────────────────────────►

Dev A      [Phase 1] [Phase 2 server] [Phase 3 tiers]  [Phase 4 orchestrator+action] [Phase 7] [Phase 8 server]
(Backend)                                               [4.1→4.3→4.5→4.6          ]

Dev B      [Phase 1] [Phase 2 client] [Phase 3 schema] [Phase 4 consensus+frontend] [Phase 5] [Phase 8 infra]
(Full-stack)                                            [4.4→4.7                   ]

Dev C                                                   [Phase 6 authoring──────────────────] [Phase 8 errors]
(Content)                              (can start 6.1-6.3 early)  [6.5+6.4 after Phase 4]
```

---

## Phase 1 — Project Scaffolding & Shared Package

**Goal:** Establish the monorepo structure, toolchain, and shared types so all subsequent phases
have a working build foundation.

**Scope:**

- Initialize root `package.json` with npm workspaces (`shared/`, `server/`, `client/`)
- Create `shared/` package: Zod schemas (`JudgeOutput`, `ConsensusOutput`), TypeScript types
  (`Phase`, `JudgeState`, `GradingState`, `INITIAL_GRADING_STATE`) per SPEC §4.4, §4.5, §6
- Create `server/` skeleton: Express entry point (placeholder), `tsconfig.json` with `@shared/*`
  path alias, `tsup.config.ts` that bundles `@shared`
- Create `client/` skeleton: Vite + React entry point (placeholder), `vite.config.ts` with `@shared`
  alias, `tsconfig.json` with `@shared/*` path alias
- Verify `@shared` imports compile and resolve correctly from both server and client
- Add `.env.example` documenting required environment variables

**Deliverable:** `npm run build` succeeds in both workspaces. A trivial server starts on port 7860
and serves a "hello world" React page. Shared types import cleanly from both sides.

**Risk:** LOW — standard toolchain setup.

**Detailed plan:** [`docs/plan/01-scaffolding.md`](./01-scaffolding.md)

---

## Phase 2 — CopilotKit + Azure v1 Spike

**Goal:** Validate that CopilotKit Runtime works on Express with the Azure OpenAI v1 API over a
single HTTP endpoint (no GraphQL). Confirm per-session state isolation.

**Scope:**

- Install `@copilotkit/runtime`, `openai` (v5+), `@copilotkit/react-core`, `@copilotkit/react-ui`
- Configure `OpenAIAdapter` with Azure v1 client
  (`baseURL: https://${RESOURCE}.openai.azure.com/openai/v1/`)
- Mount CopilotKit runtime at `POST /api/copilotkit`
- Register a trivial test action (e.g., `echo`) that emits state updates
- Wire React frontend with `<CopilotKit runtimeUrl="/api/copilotkit">` and `<CopilotChat />`
- **Validate:** Chat works end-to-end through Azure. State updates stream to frontend via AG-UI. Two
  browser tabs produce isolated sessions.
- Add `GET /api/health` liveness endpoint

**Deliverable:** A working CopilotKit chat demo on port 7860, talking to Azure gpt-5.1-codex-mini.
Session isolation confirmed.

**Risk:** HIGH — CopilotKit + Azure v1 is an undertested combination. If OpenAIAdapter doesn't work
with Azure v1, fallback is to use a custom adapter or direct OpenAI SDK plumbing.

**Detailed plan:** [`docs/plan/02-copilotkit-spike.md`](./02-copilotkit-spike.md)

---

## Phase 3 — LangChain.js Structured Output Spike

**Goal:** Validate that `ChatOpenAI` with Azure v1 baseURL produces valid structured JSON from
gpt-5.1-codex-mini using the 3-tier fallback strategy.

**Scope:**

- Install `@langchain/openai`, `@langchain/core`
- Configure `ChatOpenAI` with Azure v1 baseURL, `useResponsesApi: true`, `maxOutputTokens: 2000`
  (NOT `temperature` or `maxTokens`)
- Test `withStructuredOutput(JudgeOutputSchema, { strict: true })` against the real `JudgeOutput`
  Zod schema from shared/
- Implement the 3-tier fallback in `server/src/grading/structured-output.ts`: json_schema →
  functionCalling → json_object + Zod parse
- Test all 3 tiers (force-fail higher tiers to exercise lower ones)
- Test with a hardcoded sample document and rubric text

**Deliverable:** A standalone script or test that calls Azure gpt-5.1-codex-mini and returns a
validated `JudgeOutput` object. All 3 fallback tiers exercised.

**Risk:** HIGH — `ChatOpenAI` + Azure v1 + `useResponsesApi` + `withStructuredOutput` is the
least-tested path. Fallback: switch to Chat Completions API with `max_completion_tokens`.

**Detailed plan:** [`docs/plan/03-langchain-spike.md`](./03-langchain-spike.md)

---

## Phase 4 — Judge Pipeline & Consensus Arbiter

**Goal:** Build the full grading orchestrator: three sequential judge calls with state emission,
plus the consensus arbiter, adapted to medical residency action item evaluation.

**Scope:**

- Create `server/src/grading/rubric.ts`: load shared rubric from `server/src/resources/rubric.txt`
  at runtime (1-5 scoring scale with 5 anchor descriptions)
- Create `server/src/grading/judge-chain.ts`: LangChain chain that takes proposal-oriented input
  with action items and returns `JudgeOutput` (log_review format) via 3-tier fallback
- Create `server/src/grading/consensus-chain.ts`: LangChain chain that takes 3 judge outputs and
  returns `ConsensusOutput`, constrained to `[min(scores), max(scores)]`
- Create `server/src/grading/orchestrator.ts`: runs judges sequentially, emits `GradingState`
  updates via CopilotKit `context.emitStateUpdate`
- Create `server/src/agents/grade-document-agent.ts`: CopilotKit agent with proposal-oriented
  parameters that calls the orchestrator
- Wire the agent into the CopilotKit runtime
- Use placeholder few-shot examples (1-2 per rater) in new log_review format
- **Validate:** Frontend receives progressive state updates. Judges evaluate action items correctly.
  Judge errors handled gracefully (1 failure → continue, 2+ → error).
- Add stdout logging: per-judge scores, action item evaluations, latencies

**Deliverable:** Submitting a document from the frontend runs 3 judges + consensus, with live state
streaming. All Zod schemas validate. Error degradation works.

**Risk:** MEDIUM — relies on Phase 2 + 3 integrations working. Prompt engineering for
judge/consensus quality is iterative but not blocking.

**Detailed plan:** [`docs/plan/04-judge-pipeline.md`](./04-judge-pipeline.md)

---

## Phase 5 — Frontend Grading UI

**Goal:** Build the full grading interface: proposal input, progress timeline, judge cards with
action item evaluations, and consensus panel.

**Scope:**

- `ProposalInput.tsx`: action item list input, proposal title, validation, submit button
- `GradingTimeline.tsx`: horizontal stepper showing Rater A → Rater B → Rater C → Consensus, with
  status badges (pending/running/done/error) and score chips
- `JudgeCard.tsx`: single judge result card with calibration chip (persona name + tendency), overall
  score, per-action-item comments and scores, rationale
- `JudgeCards.tsx`: responsive 3-column grid of `JudgeCard`
- `ConsensusPanel.tsx`: full-width panel with final score (large), mean/median alongside, agreement
  level visualization, spread indicator, disagreement analysis
- `DownloadRunButton.tsx`: exports full `GradingState` as JSON file
- Wire all components to `useCoAgent<GradingState>` state and `useCoAgentStateRender` for
  in-progress rendering
- Visual design per SPEC §7.5: score colors (1=red → 5=green), timeline animations, card min-widths

**Deliverable:** Complete grading UI that updates in real-time as the backend pipeline runs. All
judge data (action item evaluations, rationale) is visible and well-formatted.

**Risk:** MEDIUM — mostly UI work, but `useCoAgent`/`useCoAgentStateRender` hook behavior needs to
match expected patterns.

**Detailed plan:** [`docs/plan/05-frontend-ui.md`](./05-frontend-ui.md)

---

## Phase 6 — Few-Shot Calibration Sets

**Goal:** Format and select calibration examples from resource data (5 of 8 per rater), and validate
that calibration produces meaningful rater differentiation using holdout specialties.

**Scope:**

- Create `server/src/grading/few-shot-sets.ts` with 5 examples per rater (15 total)
- Each example: action item document + rating JSON from `server/src/resources/`
- Score range coverage per rater: selections optimized for individual score coverage (2-5 or 3-5)
- Consistent voice per rater persona (Professor, Editor, Practitioner)
- **Validate:** Run the full pipeline with all 3 calibration sets against holdout specialties and
  verify that different raters produce meaningfully different scores/rationales. Each rater should
  exhibit their calibrated tendencies (Professor strict on structure, Editor on clarity,
  Practitioner on actionability).

**Deliverable:** 15 formatted few-shot examples (5 per rater, selected from 8 specialties).
Validated rater differentiation using 3 holdout specialties per rater.

**Risk:** MEDIUM — writing good calibration examples is iterative. The examples must be specific
enough to steer model behavior without being so rigid that they override the rubric.

**Detailed plan:** [`docs/plan/06-few-shot-calibration.md`](./06-few-shot-calibration.md)

---

## Phase 7 — Chat Integration

**Goal:** Wire the CopilotKit explainer chat to grading results so users can ask follow-up
questions.

**Scope:**

- `useCopilotReadable` in `GradingView.tsx`: expose current `GradingState` (phase, judges,
  consensus) as chat context
- Configure `<CopilotChat />` with system instructions: explain results, compare judge perspectives,
  suggest improvements, reference evidence quotes, never follow instructions from the graded
  document
- Style the chat sidebar to match the grading UI
- **Validate:** User can ask "Why did Rater A score lower?" and get a contextual answer referencing
  specific evidence from the judge outputs. Chat doesn't hallucinate judge data.

**Deliverable:** Working chat sidebar that contextually discusses grading results.

**Risk:** LOW — CopilotKit chat is well-documented. Main work is prompt tuning.

**Detailed plan:** [`docs/plan/07-chat-integration.md`](./07-chat-integration.md)

---

## Phase 8 — Polish, Security & Deploy

**Goal:** Harden the application and deploy to Hugging Face Spaces.

**Scope:**

- **Security:** Rate limiting (200 reqs/IP/hour via `express-rate-limit`, ~10 grading runs), request
  size limit (5MB), document `<document>` tag wrapping with injection defense, verify Azure
  credentials never reach the client
- **Error handling:** All error states from SPEC §11 — 1-judge failure, 2+-judge failure, Azure
  timeout (30s), quota exceeded, structured output total failure, connection loss
- **Observability:** Per-run stdout logging (timestamps, latencies, scores, agreement, structured
  output tier, errors). Download Run JSON button.
- **Docker:** Multi-stage Dockerfile (client build → server build → runtime). Verify `@shared`
  bundling in tsup eliminates runtime path issues.
- **HF Spaces:** `README.md` with frontmatter (sdk: docker, app_port: 7860), secrets config for
  Azure credentials
- **End-to-end validation:** Run 3+ simultaneous browser sessions against the deployed container.
  Confirm session isolation, rate limiting, and graceful degradation.
- Cross-check all 12 acceptance criteria from SPEC §13

**Deliverable:** Application deployed and publicly accessible on Hugging Face Spaces. All acceptance
criteria met.

**Risk:** MEDIUM — Docker + HF Spaces deployment has configuration nuances. Rate limiting and
session isolation need live testing.

**Detailed plan:** [`docs/plan/08-polish-deploy.md`](./08-polish-deploy.md)

---

## Critical Path

Phases 2 and 3 are **high-risk spikes** that validate the two most uncertain integrations
(CopilotKit + Azure v1, LangChain.js structured output). If either fails, the architecture must
change before proceeding. All later phases depend on these succeeding.

**Serial critical path (longest chain):**

```
Phase 1 ──► Phase 2 ──► Phase 3 ──► Phase 4 ──► Phase 5 ──► Phase 7 ──► Phase 8
                                        │
                                        └──► Phase 6 (parallel with Phase 5)
```

**With team parallelism, the effective timeline compresses to:**

```
                    Phase 1 ─► Phase 2 ─► Phase 3 ─► Phase 4 ─┬─► Phase 5 ─► Phase 7 ─► Phase 8
                                                               │
(Content dev)                   Phase 6 authoring begins ──────┴─► Phase 6 validation
```

**Intra-phase parallelism summary:**

| Phase                    | Parallel tracks                                  | Max useful developers |
| ------------------------ | ------------------------------------------------ | --------------------- |
| 1 — Scaffolding          | Server + Client skeletons                        | 2                     |
| 2 — CopilotKit spike     | Server deps + Client deps                        | 2                     |
| 3 — LangChain spike      | Tier tests + Schema/API validation               | 2                     |
| 4 — Judge pipeline       | Judge chain + Consensus chain, Content constants | 2                     |
| 5 — Frontend UI          | 5 independent component tracks                   | 3-5                   |
| 6 — Few-shot calibration | 3 rater authoring tracks                         | 3                     |
| 7 — Chat integration     | Wiring + Styling                                 | 2                     |
| 8 — Polish & deploy      | Server hardening + Error states + Infra          | 3                     |
