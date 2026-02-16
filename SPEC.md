# Multi-Judge LLM Grading Demo — Spec v3

## 0 · Summary

A single-container Hugging Face Space (Docker SDK) hosts a **calibrated LLM-as-a-judge panel** demo.
Three AI judges — each calibrated with a different human rater's few-shot examples — evaluate the
same medical residency program proposal with action items against the same rubric. A consensus
**arbiter** (not a re-evaluator) reconciles their scores into a final grade. The frontend renders
live progress, structured judge outputs with per-item feedback, and an interactive explainer chat —
all powered by **CopilotKit** and the **AG-UI** protocol.

**Stack:**

| Layer             | Technology                                                                |
| ----------------- | ------------------------------------------------------------------------- |
| LLM               | **gpt-5.1-codex-mini** via **Azure OpenAI v1 API**                        |
| Backend framework | Express.js + **CopilotKit Runtime** (`@copilotkit/runtime`)               |
| LLM orchestration | **OpenAI SDK v6** (direct Responses API access with Azure v1 baseURL)     |
| Frontend          | React + **CopilotKit** (`@copilotkit/react-core`, `@copilotkit/react-ui`) |
| Structured output | Zod schemas + 3-tier fallback (JSON Schema strict → non-strict → runtime) |
| Deployment        | HF Spaces Docker, single port 7860                                        |

**Key constraint:** HF Spaces exposes one public port. Express serves the React build as static
files and mounts the CopilotKit runtime at `/api/copilotkit`.

---

## 1 · Goals & Non-Goals

### Goals

1. **Demonstrate calibration.** Three judges use the exact same rubric. Each is calibrated with a
   different human rater's example judgments (few-shot). The demo shows whether calibration produces
   agreement — and when it doesn't, _why_, grounded in specific evidence from the program proposal.
2. **Ship a real-time, interactive UX.** CopilotKit's AG-UI protocol pushes state from backend to
   frontend as each judge completes. A chat panel lets users ask follow-up questions about the
   grade.
3. **Produce strict structured output with evidence.** Every judge returns validated JSON with
   per-item constructive feedback. The consensus arbiter reconciles by referencing judge rationales,
   not by re-reading the proposal.
4. **Deploy in one container** on HF Spaces with no external infrastructure beyond the Azure OpenAI
   endpoint.

### Non-Goals

- Persistent storage of proposals or runs across container restarts.
- User authentication.
- Multi-file or rich-document upload (single proposal input only).
- Benchmark-grade reliability claims (this is a demo).
- Using CopilotKit as the primary grading decision-maker (custom orchestrator handles evaluation;
  CopilotKit handles UX and interactive follow-up).

---

## 2 · Architecture

```
┌──────────────────────────────────────────────────────────┐
│  Browser                                                 │
│  ┌──────────────────────────────┐ ┌────────────────────┐ │
│  │  Grading UI                  │ │  CopilotKit Chat   │ │
│  │  (Timeline, Judge Cards,     │ │  <CopilotChat />   │ │
│  │   Consensus Panel)           │ │  "Explain my grade"│ │
│  │                              │ │  "How to improve?" │ │
│  │  useCoAgent<GradingState>    │ │                    │ │
│  │  useCoAgentStateRender       │ │                    │ │
│  └──────────────────────────────┘ └────────────────────┘ │
│                     ↕ AG-UI protocol (single endpoint)   │
├──────────────────────────────────────────────────────────┤
│  Express (port 7860)                                     │
│                                                          │
│  ├── GET  / ................... React static build       │
│  ├── POST /api/copilotkit ..... CopilotKit Runtime       │
│  │   ├── Service Adapter: OpenAIAdapter (Azure v1 client)│
│  │   ├── Agent: "gradeDocument" (AbstractAgent)          │
│  │   │   └── Orchestrator (OpenAI SDK)                   │
│  │   │       ├── Judge evaluation (Rater A calibration)  │
│  │   │       ├── Judge evaluation (Rater B calibration)  │
│  │   │       ├── Judge evaluation (Rater C calibration)  │
│  │   │       └── Consensus arbiter                       │
│  │   └── Readable context: grading results (for chat)    │
│  └── GET  /api/health ......... liveness probe           │
│                                                          │
│         ↕ HTTPS (v1 API)                                 │
│    Azure OpenAI (gpt-5.1-codex-mini deployment)          │
└──────────────────────────────────────────────────────────┘
```

### Why This Architecture

**CopilotKit Runtime replaces custom SSE/REST endpoints.** CopilotKit provides a server-side runtime
(`@copilotkit/runtime`) that mounts as Express middleware. It handles all transport between backend
and frontend via the AG-UI protocol — streaming state snapshots, messages, and tool call events over
a **single HTTP endpoint** (GraphQL was removed in CopilotKit v1.50+). There is no need to implement
custom streaming endpoints. The grading pipeline is registered as a CopilotKit **agent** (custom
`AbstractAgent` subclass) that the frontend triggers via `useAgent({ agentId: "gradeDocument" })`
combined with `useCoAgent<GradingState>` for state management (CopilotKit v1.51 workaround pattern).

**Single OpenAI client, one Azure v1 baseURL.** Both CopilotKit (for chat) and the grading
orchestrator share the same Azure OpenAI v1 configuration. The v1 API uses standard OpenAI SDK
patterns (`baseURL + apiKey`), eliminating Azure-specific adapter friction.

**OpenAI SDK handles LLM calls.** Each judge evaluation uses `client.responses.create()` with the
Azure Responses API to get structured JSON output. The implementation includes a 3-tier fallback
(JSON Schema strict → non-strict → JSON Object mode with runtime Zod validation) to ensure reliable
structured output. The consensus arbiter takes the three judge outputs as input and produces a
reconciled result.

**The frontend uses CopilotKit hooks for reactivity.** `useCoAgent<GradingState>` subscribes to the
agent's state. As the backend orchestrator emits state updates, the frontend re-renders
automatically via AG-UI `STATE_DELTA` events. `<CopilotChat />` provides the explainer chat panel.

---

## 3 · Model: gpt-5.1-codex-mini on Azure OpenAI v1

### Why This Model

gpt-5.1-codex-mini supports **streaming**, **function calling**, **structured outputs** (JSON schema
mode), and is cost-effective for a demo making 4 LLM calls per run. It is a **reasoning model** in
the GPT-5.1 family and has specific parameter constraints that differ from classic chat models.

### ⚠️ Reasoning Model Parameter Constraints

GPT-5.1-codex-mini is a reasoning model. Per Microsoft's documentation:

- **`temperature` is NOT supported.** Do not pass it. Judge differentiation comes entirely from
  few-shot calibration, not sampling temperature.
- **`max_tokens` is NOT supported.** Use `max_output_tokens` (Responses API) or
  `max_completion_tokens` (Chat Completions API).
- **`reasoning_effort`** is supported and defaults to `none` for GPT-5.1 models. Set it explicitly
  if reasoning is desired. Valid values: `none`, `minimal`, `low`, `medium`, `high`.
- **`top_p`** is NOT supported.

### Azure v1 API Strategy

This project uses Azure OpenAI's **v1 API** exclusively. The v1 API was introduced in August 2025
and removes the need for legacy `api-version` query parameters. It uses standard OpenAI SDK
patterns:

```
Base URL: https://{resource-name}.openai.azure.com/openai/v1/
Auth: API key via standard header
```

This means:

- **CopilotKit's `OpenAIAdapter`** receives a standard `OpenAI` client instance configured with the
  Azure v1 base URL.
- **Grading orchestrator** uses the same `OpenAI` client directly via `client.responses.create()` to
  access the Responses API. No Azure-specific wrappers needed.
- No `api-version` query param needed. No `azureOpenAIApiInstanceName` or `azureOpenAIApiVersion`.

### Responses API vs Chat Completions

Azure's GPT-5.x models are designed for the **Responses API** (`client.responses.create(...)`)
rather than Chat Completions API (`client.chat.completions.create(...)`). The implementation uses
the Responses API directly via the OpenAI SDK v6.

**Implementation approach:** The grading orchestrator calls `client.responses.create()` with
structured output parameters (`text.format` for JSON Schema). The Responses API uses different field
names (`input`/`instructions` instead of `messages`, `output.content[].text` instead of
`choices[].message.content`). The 3-tier fallback strategy handles cases where strict JSON Schema
validation is not supported.

### Configuration

```typescript
import OpenAI from "openai";

// Shared Azure v1 base URL
const AZURE_BASE_URL = `https://${process.env.AZURE_OPENAI_RESOURCE}.openai.azure.com/openai/v1/`;

// OpenAI SDK client for both CopilotKit and grading orchestrator
const openaiClient = new OpenAI({
  apiKey: process.env.AZURE_OPENAI_API_KEY,
  baseURL: AZURE_BASE_URL,
  defaultHeaders: {
    "api-key": process.env.AZURE_OPENAI_API_KEY,
  },
});

// Example: Call Responses API for judge evaluation
const response = await openaiClient.responses.create({
  model: process.env.AZURE_OPENAI_DEPLOYMENT, // e.g. "gpt-51-codex-mini"
  instructions: systemPrompt, // System prompt
  input: userPrompt, // User message
  text: {
    format: {
      type: "json_schema",
      name: "JudgeOutput",
      schema: jsonSchema,
      strict: true, // Tier 1: strict validation
    },
  },
  max_output_tokens: 4000, // Control output length (judges use 4k, consensus uses 4k)
  // Reasoning models use internal chain-of-thought tokens that count toward this limit
  // temperature: DO NOT SET — unsupported for reasoning models
  // Judge variance comes from calibration sets (few-shot examples), not sampling
});
```

### Environment Variables

| Variable                  | Required | Description                                             |
| ------------------------- | -------- | ------------------------------------------------------- |
| `AZURE_OPENAI_API_KEY`    | Yes      | API key for the Azure OpenAI resource                   |
| `AZURE_OPENAI_RESOURCE`   | Yes      | Resource name (e.g. `my-org-openai`) — used in base URL |
| `AZURE_OPENAI_DEPLOYMENT` | Yes      | Deployment name for gpt-5.1-codex-mini                  |
| `PORT`                    | No       | Default `7860`                                          |
| `MAX_DOC_CHARS`           | No       | Default `20000`                                         |

---

## 4 · Evaluation Design: Calibrated Judges

### 4.1 Core Concept

All three judges evaluate the **same program proposal with action items** against the **same
rubric**. What differs is the **few-shot calibration set** — each set comes from a different human
rater who has their own interpretation style, severity tendencies, and focus areas.

This design answers the question: _Given the same rubric, do differently-calibrated judges agree on
program quality? When they disagree, what does the disagreement reveal about the rubric's ambiguity
or the proposal's strengths and weaknesses?_

### 4.2 The Three Raters

| Rater                            | Persona                                    | Tendency                                                                               | Few-Shot Character                                                         |
| -------------------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| **Rater A — "The Professor"**    | Experienced academic reviewer, 20+ years   | Strict on structure, quantitative targets, metric specificity; lenient on presentation | Examples emphasize structure, quantitative targets, and metric specificity |
| **Rater B — "The Editor"**       | Professional editor, publishing background | Generous on feasibility and clarity; focuses on achievability                          | Examples emphasize feasibility, clarity, and achievability                 |
| **Rater C — "The Practitioner"** | Industry professional, applied focus       | Strict on actionability, data richness, practical impact; lenient on formality         | Examples emphasize actionability, data richness, and practical impact      |

Each rater contributes **5 calibration examples** (from a pool of 8 medical specialties): pairs of
`(program, structured_rating)` that show how _they_ would rate representative program proposals.

### 4.3 Shared Rubric (v1)

All judges score on a 1–5 scale defined by these anchors:

| Score | Anchor    | Definition                                                 |
| ----- | --------- | ---------------------------------------------------------- |
| **1** | Poor      | Fundamental gaps; lacks feasibility, clarity, or alignment |
| **2** | Weak      | Notable issues; partial feasibility or unclear execution   |
| **3** | Adequate  | Meets minimum; feasible but needs improvements             |
| **4** | Strong    | Solid plan with minor refinements suggested                |
| **5** | Excellent | Clear, feasible, well-aligned, high impact                 |

The rubric is loaded from `server/src/resources/rubric.txt` at runtime. It defines a `log_review`
tool call schema that judges must use.

The **overall score** (1–5) is a holistic assessment that reflects the overall plan quality and
coherence. It may be close to, but need not equal, the average of individual action item scores.

### 4.4 Judge Output Schema (Zod)

```typescript
import { z } from "zod";

export const ActionItemReview = z.object({
  action_item_id: z.number().int().describe("Stable ID of the action item being reviewed"),
  comment: z.string().describe("Brief, constructive feedback (1-3 sentences)"),
  score: z.number().int().min(1).max(5).describe("Score from 1 (poor) to 5 (excellent)"),
});

export const JudgeOutput = z.object({
  proposal_id: z.number().int().describe("Proposal identifier from the current request"),
  evaluator_id: z.number().int().describe("Persona ID of the evaluator"),
  evaluator_name: z.string().describe("Persona name of the evaluator"),
  items: z.array(ActionItemReview).min(1).describe("One review per action item"),
  overall_score: z.number().int().min(1).max(5).describe("Overall assessment score 1-5"),
});

export type JudgeOutputType = z.infer<typeof JudgeOutput>;
```

**Key design notes:**

- `z.optional()` is NOT supported for reasoning models' structured output — use `z.nullable()` if
  needed.
- The schema uses the `log_review` tool call format defined in `rubric.txt`.
- `items` array provides per-action-item feedback with specific comments and scores.
- `evaluator_id` and `evaluator_name` identify the rater persona being emulated.
- No `confidence` field — judges provide scores directly based on calibration examples.
- No `criteria` array — feedback is given per action item, not per abstract criterion.
- Comments must be specific, actionable, and reference the action item content where relevant.

### 4.5 Consensus Output Schema (Zod)

```typescript
export const ConsensusOutput = z.object({
  final_score: z
    .number()
    .int()
    .min(1)
    .max(5)
    .describe("Reconciled final score — MUST be within [min(judge scores), max(judge scores)]"),
  rationale: z
    .string()
    .describe(
      "3-5 sentence synthesis using judge rationales and evidence, NOT new document analysis"
    ),
  agreement: z.object({
    scores: z.object({
      rater_a: z
        .number()
        .int()
        .min(1)
        .max(5)
        .nullable()
        .describe("Score from Rater A (null if judge failed)"),
      rater_b: z
        .number()
        .int()
        .min(1)
        .max(5)
        .nullable()
        .describe("Score from Rater B (null if judge failed)"),
      rater_c: z
        .number()
        .int()
        .min(1)
        .max(5)
        .nullable()
        .describe("Score from Rater C (null if judge failed)"),
    }),
    mean_score: z
      .number()
      .min(1)
      .max(5)
      .describe("Arithmetic mean of judge scores, rounded to 1 decimal"),
    median_score: z.number().int().min(1).max(5).describe("Median of judge scores"),
    spread: z.number().int().min(0).max(4).describe("Max score minus min score across judges"),
    agreement_level: z
      .enum(["strong", "moderate", "weak"])
      .describe("strong = spread 0-1, moderate = spread 2, weak = spread 3-4"),
    disagreement_analysis: z
      .string()
      .describe(
        "Why judges differed, referencing their calibration perspectives and specific evidence they cited"
      ),
  }),
  improvements: z
    .array(z.string())
    .min(1)
    .max(5)
    .describe("Consolidated improvement suggestions from all judges, deduplicated"),
});

export type ConsensusOutputType = z.infer<typeof ConsensusOutput>;
```

**Key design notes:**

- `mean_score` and `median_score` provide a deterministic baseline. The UI displays these alongside
  the consensus score so users can see that the LLM consensus adds interpretation, not just
  arithmetic.
- `final_score` is constrained to `[min(judges), max(judges)]` in the prompt, preventing the
  consensus from inventing scores outside the range of its inputs.
- The consensus arbiter references judge rationales and per-item feedback, NOT the original
  proposal. This prevents it from collapsing into "just another judge."
- No `criteria` array — consensus focuses on overall score agreement and consolidated improvements.

### 4.6 Prompt Templates

#### Judge System Prompt (shared)

The system prompt is loaded from `server/src/resources/rubric.txt` at runtime. It defines:

- The evaluator role (emulate a target evaluator persona)
- The `log_review` tool call schema with fields: `proposal_id`, `evaluator_id`, `evaluator_name`,
  `items[]` (with `action_item_id`, `comment`, `score`), `overall_score`
- Scoring anchors (1=Poor, 2=Weak, 3=Adequate, 4=Strong, 5=Excellent)
- Comment style guidelines (specific, actionable, concise)
- Overall score guidance (reflects plan coherence, may differ from item average)
- Few-shot imitation instructions (mirror persona tone and scoring tendencies)
- Validation checklist (every item ID covered, comments non-empty, scores in [1,5])

#### Judge User Prompt Template

```
## Calibration Examples

{few_shot_examples}

## Proposal to Evaluate

Proposal ID: {proposal_id}
Evaluator ID: {evaluator_id}
Evaluator Name: {evaluator_name}

### Action Items

{action_items_text}

Evaluate these action items according to the rubric.
```

#### Consensus System Prompt

```
You are a consensus ARBITER. You receive evaluations from up to three calibrated
judges (Rater A "The Professor", Rater B "The Editor", Rater C "The Practitioner")
who assessed the same program proposal against the same rubric. Each judge was
calibrated with a different human rater's few-shot examples, giving them distinct
scoring tendencies.

RATER PERSONAS:
- Rater A ("The Professor"): strict on structure, quantitative targets, metric
  specificity; demands detailed methodology and clear execution plans
- Rater B ("The Editor"): generous on feasibility and clarity; values achievable,
  well-articulated plans with clear timelines
- Rater C ("The Practitioner"): strict on actionability, data richness, practical
  impact; focuses on real-world implementation and concrete mechanisms

YOUR TASK:
Read each judge's per-item feedback and overall rationale. Synthesize their
perspectives into a single consensus evaluation grounded in their reasoning.

ARBITER RULES:
1. Your final_score MUST be within [min(judge scores), max(judge scores)].
   You may NOT score outside this range.
2. Your rationale must reference specific points from the judges' feedback.
   Do NOT introduce new claims about the proposal — only synthesize what
   the judges observed.
3. When judges agree, note the consensus and shared themes.
4. When judges disagree, explain WHY based on their different calibration
   perspectives and the specific feedback each provided.
5. If fewer than 3 judges succeeded, explicitly acknowledge the missing
   perspective(s) and note reduced confidence in the consensus.
6. Produce consolidated improvement suggestions — deduplicate across judges,
   merging similar points into one clear recommendation.
7. Return ONLY valid JSON matching the required schema. No free-form text.
```

#### Consensus User Prompt Template

```
## Judge Evaluations

### Rater A (The Professor) — Overall Score: {a.overall_score}/5
{JSON.stringify(judge_a_output, null, 2)}

### Rater B (The Editor) — Overall Score: {b.overall_score}/5
{JSON.stringify(judge_b_output, null, 2)}

### Rater C (The Practitioner) — Overall Score: {c.overall_score}/5
{JSON.stringify(judge_c_output, null, 2)}

NOTE: {missingJudgeCount} judge(s) did not complete evaluation. Acknowledge the
missing perspective and proceed with consensus from available judges.

Synthesize these evaluations into a consensus assessment. Return your synthesis
as valid JSON.
```

---

## 5 · Backend Implementation

### 5.1 Express Server Structure

```typescript
// server/src/index.ts
import express from "express";
import { CopilotRuntime, OpenAIAdapter, copilotRuntimeNodeHttpEndpoint } from "@copilotkit/runtime";
import { BuiltInAgent } from "@copilotkitnext/agent";
import { createOpenAI as createAzureOpenAI } from "@ai-sdk/openai";
import OpenAI from "openai";
import { GradeDocumentAgent } from "./agents/grade-document-agent";
import path from "path";
import rateLimit from "express-rate-limit";

const app = express();
const PORT = process.env.PORT || 7860;

// Rate limiting
// Note: CopilotKit's AG-UI protocol sends ~10 requests per page load and ~15
// per grading run through the single /api/copilotkit endpoint. A limit of 200
// HTTP requests/hour allows ~10 grading runs with headroom for page reloads.
const gradingLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 200, // ~10 grading runs per IP per hour (accounting for AG-UI protocol overhead)
  message: { error: "Too many grading requests. Please try again later." },
});

// Request size limit
app.use(express.json({ limit: "5mb" }));

// Serve React build
app.use(express.static(path.join(__dirname, "../public")));

// Azure OpenAI v1 client — shared between grading orchestrator and default agent
const AZURE_BASE_URL = `https://${process.env.AZURE_OPENAI_RESOURCE}.openai.azure.com/openai/v1/`;

const openaiClient = new OpenAI({
  apiKey: process.env.AZURE_OPENAI_API_KEY,
  baseURL: AZURE_BASE_URL,
  defaultHeaders: {
    "api-key": process.env.AZURE_OPENAI_API_KEY,
  },
});

// Vercel AI SDK provider for CopilotKit's default agent
const azureAIProvider = createAzureOpenAI({
  baseURL: AZURE_BASE_URL,
  apiKey: process.env.AZURE_OPENAI_API_KEY,
  headers: {
    "api-key": process.env.AZURE_OPENAI_API_KEY,
  },
});

// CopilotKit runtime with OpenAI adapter pointing at Azure v1
const serviceAdapter = new OpenAIAdapter({
  openai: openaiClient as any, // Type cast needed for SDK compatibility
  model: process.env.AZURE_OPENAI_DEPLOYMENT,
});

const copilotRuntime = new CopilotRuntime({
  agents: {
    // REQUIRED: CopilotKit's chat infrastructure requires a "default" agent
    default: new BuiltInAgent({
      model: azureAIProvider(process.env.AZURE_OPENAI_DEPLOYMENT),
    }),
    gradeDocument: new GradeDocumentAgent(),
  } as any, // Type cast needed for SDK compatibility
});

// IMPORTANT: Mount at root (not app.use("/api/copilotkit", ...)) because
// Express strips the mount prefix from req.url, but CopilotKit's internal
// Hono router uses req.url to match sub-paths like /api/copilotkit/info.
app.use(
  copilotRuntimeNodeHttpEndpoint({
    endpoint: "/api/copilotkit",
    runtime: copilotRuntime,
    serviceAdapter,
  }) as any // Type cast needed for Express middleware compatibility
);

app.use("/api/copilotkit", gradingLimiter);

// Health check
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    model: process.env.AZURE_OPENAI_DEPLOYMENT,
    api: "azure-v1",
  });
});

// SPA fallback
app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
```

### 5.2 Grade Document Agent

The grading pipeline is a CopilotKit **agent** — a custom `AbstractAgent` subclass whose `run()`
method returns an RxJS `Observable<BaseEvent>`. The frontend triggers it via
`useCoAgent<GradingState>.run()` with explicit proposal parameters (proposal ID, action items).

```typescript
// server/src/agents/grade-document-agent.ts
import { AbstractAgent, EventType } from "@ag-ui/client";
import type { BaseEvent, RunAgentInput } from "@ag-ui/client";
import { Observable } from "rxjs";
import { runGradingPipeline } from "../grading/orchestrator";

export class GradeDocumentAgent extends AbstractAgent {
  constructor() {
    super({
      agentId: "gradeDocument",
      description:
        "Evaluate a medical residency program proposal using three calibrated judges and produce a consensus grade.",
    });
  }

  run(input: RunAgentInput): Observable<BaseEvent> {
    return new Observable((subscriber) => {
      (async () => {
        try {
          subscriber.next({ type: EventType.RUN_STARTED });
          subscriber.next({ type: EventType.STATE_SNAPSHOT, snapshot: { phase: "idle" } });

          const result = await runGradingPipeline({
            proposalId: input.state?.proposalId ?? 1,
            proposalTitle: input.state?.proposalTitle,
            actionItems: input.state?.actionItems ?? [],
            emitState: (state) => {
              subscriber.next({ type: EventType.STATE_SNAPSHOT, snapshot: state });
            },
          });

          subscriber.next({ type: EventType.STATE_SNAPSHOT, snapshot: result });
          subscriber.next({ type: EventType.RUN_FINISHED });
          subscriber.complete();
        } catch (error) {
          subscriber.next({
            type: EventType.RUN_ERROR,
            message: error instanceof Error ? error.message : String(error),
          });
          subscriber.complete();
        }
      })();
    });
  }
}
```

### 5.3 Grading Orchestrator

```typescript
// server/src/grading/orchestrator.ts
import { runJudge } from "./judge-chain";
import { runConsensus } from "./consensus-chain";
import { validateContentSafety } from "./content-safety";
import { RATER_A_EXAMPLES, RATER_B_EXAMPLES, RATER_C_EXAMPLES } from "./few-shot-sets";
import { RUBRIC_TEXT } from "./rubric";
import type { GradingState, JudgeState } from "@shared/types";
import logger from "../utils/logger";

interface PipelineInput {
  proposalId: number;
  proposalTitle?: string;
  actionItems: string[]; // Single-item array: entire document is one action item
  emitState: (state: Partial<GradingState>) => void;
}

export async function runGradingPipeline({
  proposalId,
  proposalTitle,
  actionItems,
  emitState,
}: PipelineInput): Promise<GradingState> {
  // Truncate by character count (20,000 chars max), not item count
  // Each document is ONE action item (not split by lines)
  const MAX_CHARS = 20_000;
  const proposalText = actionItems[0] || "";
  const truncatedText = proposalText.slice(0, MAX_CHARS);
  const wasTruncated = proposalText.length > MAX_CHARS;
  const truncatedItems = [truncatedText];

  // Content safety screening before judge execution
  const safetyCheck = await validateContentSafety(truncatedText);
  if (!safetyCheck.isSafe) {
    throw new Error(safetyCheck.reason || "Content safety check failed");
  }

  // Phase 1-3: Run judges IN PARALLEL
  // Parallel execution provides faster completion (~3x speedup). State emissions
  // as each judge completes still provide progressive UX updates. Rate limit risk
  // is acceptable for demo with limited concurrent users.
  const judges = [
    { id: "rater_a" as const, evaluatorId: 1, label: "The Professor", examples: RATER_A_EXAMPLES },
    { id: "rater_b" as const, evaluatorId: 2, label: "The Editor", examples: RATER_B_EXAMPLES },
    {
      id: "rater_c" as const,
      evaluatorId: 3,
      label: "The Practitioner",
      examples: RATER_C_EXAMPLES,
    },
  ];

  const judgeResults: Record<string, JudgeState> = {};

  // Initialize all judges as "running"
  for (const judge of judges) {
    judgeResults[judge.id] = { status: "running", label: judge.label };
  }
  emitState({ phase: "evaluating", judges: { ...judgeResults }, wasTruncated });

  // Execute all judges in parallel
  const judgePromises = judges.map(async (judge) => {
    const judgeLogger = logger.child({ component: "orchestrator", judgeId: judge.id, proposalId });
    const startTime = Date.now();
    try {
      const result = await runJudge({
        proposalId,
        evaluatorId: judge.evaluatorId,
        evaluatorName: judge.label,
        actionItemsText: truncatedItems[0], // Single document as one action item
        fewShotExamples: judge.examples,
      });
      const latencyMs = Date.now() - startTime;
      judgeResults[judge.id] = { status: "done", label: judge.label, result, latencyMs };

      judgeLogger.info(
        {
          overallScore: result.overall_score,
          latencyMs,
          tier: result.tier,
          tokens: result.usage?.totalTokens,
        },
        "Judge evaluation completed"
      );
      emitState({ judges: { ...judgeResults } });
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      judgeResults[judge.id] = {
        status: "error",
        label: judge.label,
        error: error instanceof Error ? error.message : "Unknown error",
        latencyMs,
      };
      judgeLogger.error(
        { latencyMs, error: error instanceof Error ? error.message : String(error) },
        "Judge evaluation failed"
      );
      emitState({ judges: { ...judgeResults } });
    }
  });

  await Promise.all(judgePromises);

  // Phase 4: Consensus
  const successfulJudges = Object.entries(judgeResults)
    .filter(([_, v]) => v.status === "done" && v.result)
    .map(([k, v]) => ({ id: k, label: v.label, ...v.result! }));

  if (successfulJudges.length < 2) {
    const errorMsg = "Fewer than 2 judges succeeded. Cannot form consensus.";
    emitState({ phase: "error", error: errorMsg });
    throw new Error(errorMsg);
  }

  emitState({ phase: "consensus" });

  const consensus = await runConsensus({
    judgeResults: successfulJudges,
    rubricText: RUBRIC_TEXT,
    missingJudgeCount: 3 - successfulJudges.length,
  });

  const finalState: GradingState = {
    phase: "done",
    proposal: { id: proposalId, title: proposalTitle, actionItems: truncatedItems, wasTruncated },
    judges: judgeResults,
    consensus,
  };

  emitState(finalState);

  logger.info(
    {
      proposalId,
      finalScore: consensus.final_score,
      agreementLevel: consensus.agreement.agreement_level,
      spread: consensus.agreement.spread,
    },
    "Grading pipeline completed"
  );

  return finalState;
}
```

### 5.4 Judge Evaluation (OpenAI SDK)

The actual implementation uses `invokeWithStructuredOutput` helper from
`server/src/grading/structured-output.ts` which implements the 3-tier fallback strategy. Here's the
judge chain structure:

```typescript
// server/src/grading/judge-chain.ts
import { invokeWithStructuredOutput } from "./structured-output";
import { JudgeOutput, type JudgeOutputType } from "@shared/schemas";
import { RUBRIC_TEXT } from "./rubric";
import logger from "../utils/logger";

const MAX_COMPLETION_TOKENS = 4000;
const SCHEMA_NAME = "JudgeOutput";

interface JudgeInput {
  proposalId: number;
  evaluatorId: number;
  evaluatorName: string;
  actionItemsText: string; // Single document as one action item
  fewShotExamples: string; // Pre-formatted calibration examples
}

export async function runJudge(input: JudgeInput): Promise<JudgeOutputType> {
  const judgeLogger = logger.child({
    component: "judge-chain",
    evaluatorId: input.evaluatorId,
    proposalId: input.proposalId,
  });

  // Build prompts
  const systemPrompt = RUBRIC_TEXT;
  const userPrompt = `## Calibration Examples

${input.fewShotExamples}

## Proposal to Evaluate

Proposal ID: ${input.proposalId}
Evaluator ID: ${input.evaluatorId}
Evaluator Name: ${input.evaluatorName}

### Action Items

${input.actionItemsText}

Evaluate these action items according to the rubric using the log_review tool.`;

  const startTime = Date.now();

  try {
    // Call structured output helper with 3-tier fallback
    const result = await invokeWithStructuredOutput<JudgeOutputType>(JudgeOutput, {
      system: systemPrompt,
      user: userPrompt,
      maxCompletionTokens: MAX_COMPLETION_TOKENS,
      schemaName: SCHEMA_NAME,
    });

    const latencyMs = Date.now() - startTime;
    judgeLogger.info({ latencyMs, tier: result.tier }, "Judge evaluation succeeded");

    return result;
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    judgeLogger.error(
      { latencyMs, error: error instanceof Error ? error.message : String(error) },
      "Judge evaluation failed after all tiers"
    );
    throw error;
  }
}
```

### 5.5 Consensus Chain

Same pattern as judge chain, using `ConsensusOutput` schema, the arbiter prompt from §4.6, and the
three judge JSON outputs as formatted input. The consensus does NOT receive the original document —
only the judge evaluations.

### 5.6 Structured Output Fallback Strategy

The implementation in `server/src/grading/structured-output.ts` provides a **3-tier fallback** using
Azure Responses API:

| Tier                | Method                                                                     | Trigger                                                   |
| ------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------- |
| **1 (preferred)**   | Responses API with `text.format: { type: "json_schema", strict: true }`    | Default first attempt                                     |
| **2 (fallback)**    | Responses API with `text.format: { type: "json_schema" }` (non-strict)     | Tier 1 fails (strict mode unsupported or schema rejected) |
| **3 (last resort)** | Responses API with `text.format: { type: "json_object" }` + Zod validation | Both schema modes fail                                    |

Implementation details:

- Uses `zodToJsonSchema()` from `zod-to-json-schema` with
  `{ target: "openApi3", $refStrategy: "none" }` to inline all definitions
- Defensive schema validation: adds missing `type: "object"` and `additionalProperties: false` if
  needed
- Each tier logs success/failure with structured metrics (tier, latency, tokens)
- Tier 3 parses JSON and validates with `schema.parse()` at runtime

This is **strategy-based**, not prompt-based. Each tier uses a different Responses API
configuration.

---

## 6 · Shared Types

These types live in a `shared/` directory. Both server and client import via the `@shared` path
alias (see §9.1 for setup).

```typescript
// shared/types.ts
import type { JudgeOutputType, ConsensusOutputType } from "./schemas";

export type Phase =
  | "idle"
  | "evaluating" // Document submitted, judges haven't started yet
  | "rater_a"
  | "rater_b"
  | "rater_c"
  | "consensus"
  | "done"
  | "error";

export interface JudgeState {
  status: "pending" | "running" | "done" | "error";
  label: string;
  result?: JudgeOutputType;
  error?: string;
  latencyMs?: number;
}

export interface GradingState {
  phase: Phase;
  proposal?: {
    id: number;
    title?: string;
    actionItems: string[];
    wasTruncated?: boolean;
  };
  judges: {
    rater_a?: JudgeState;
    rater_b?: JudgeState;
    rater_c?: JudgeState;
  };
  consensus?: ConsensusOutputType;
  error?: string;
  wasTruncated?: boolean;
}

export const INITIAL_GRADING_STATE: GradingState = {
  phase: "idle",
  judges: {},
};
```

---

## 7 · Frontend Implementation

### 7.1 App Shell

```tsx
// client/src/App.tsx
import { CopilotKit } from "@copilotkit/react-core";
import "@copilotkit/react-ui/styles.css";
import { GradingView } from "./components/GradingView";

export default function App() {
  return (
    <CopilotKit runtimeUrl="/api/copilotkit">
      <GradingView />
    </CopilotKit>
  );
}
```

### 7.2 Main Grading View (with explicit action invocation)

```tsx
// client/src/components/GradingView.tsx
import { useState, useCallback } from "react";
import { useCoAgent, useCopilotReadable } from "@copilotkit/react-core";
import { useAgent } from "@copilotkitnext/react";
import { CopilotChat } from "@copilotkit/react-ui";
import type { GradingState } from "@shared/types";
import { INITIAL_GRADING_STATE } from "@shared/types";
import { DocumentInput } from "./DocumentInput";
import { GradingTimeline } from "./GradingTimeline";
import { JudgeCards } from "./JudgeCards";
import { ConsensusPanel } from "./ConsensusPanel";
import { ChatSidebar } from "./ChatSidebar";

export function GradingView() {
  const [hasStarted, setHasStarted] = useState(false);

  // CopilotKit v1.51 workaround: Use dual hooks
  // - useCoAgent for state management
  // - useAgent for bound agent instance
  const { state, setState } = useCoAgent<GradingState>({
    name: "gradeDocument",
    initialState: INITIAL_GRADING_STATE,
  });

  const { agent } = useAgent({ agentId: "gradeDocument" });

  // Make grading results available to the explainer chat
  useCopilotReadable({
    description: "Current grading results including all judge evaluations and consensus",
    value: JSON.stringify({
      phase: state.phase,
      judges: state.judges,
      consensus: state.consensus,
    }),
  });

  // EXPLICIT agent invocation with state-first pattern
  // CopilotKit v1.51: Must call setState() BEFORE agent.runAgent()
  // The setState call updates agent.state, which is sent to server
  const handleSubmit = useCallback(
    async (title: string, text: string) => {
      const trimmedText = text.trim();
      if (trimmedText.length === 0) return;
      const items = [trimmedText];

      // Update state FIRST (synchronously sets agent.state)
      setState((prev) => ({
        ...(prev ?? INITIAL_GRADING_STATE),
        phase: "evaluating",
        proposal: {
          id: Date.now(), // Generate proposal ID client-side
          title,
          actionItems: items,
        },
        judges: {},
        consensus: undefined,
        error: undefined,
      }));

      setHasStarted(true);

      try {
        // Call agent with NO parameters (uses agent.state set above)
        await agent.runAgent();
      } catch (err) {
        setState((prev) => ({
          ...(prev ?? INITIAL_GRADING_STATE),
          phase: "error",
          error: err instanceof Error ? err.message : "An error occurred",
        }));
      }
    },
    [agent, setState]
  );

  return (
    <div className="app-layout">
      <main className="grading-main">
        {state.phase === "idle" && <DocumentInput onSubmit={handleSubmit} disabled={false} />}

        {state.phase !== "idle" && (
          <>
            <GradingTimeline phase={state.phase} judges={state.judges} />
            {state.consensus && state.phase === "done" && (
              <ConsensusPanel consensus={state.consensus} judges={state.judges} />
            )}
            <JudgeCards judges={state.judges} />
          </>
        )}
      </main>

      {hasStarted && <ChatSidebar />}
    </div>
  );
}
```

**Key difference from v2:** The `handleStartGrading` function passes proposal data (ID, action items
array, title) directly as action parameters, not embedded in a chat message. This ensures the action
always receives the full proposal structure.

### 7.3 Component Tree

```
App
└── CopilotKit (provider, runtimeUrl="/api/copilotkit")
    └── GradingView
        ├── ProposalInput            (shown when phase === "idle")
        │   ├── ProposalID field
        │   ├── Title field (optional)
        │   ├── Action items list editor
        │   ├── Action item count + limit warning
        │   └── "Start Grading" button
        │
        ├── GradingTimeline          (horizontal stepper)
        │   ├── TimelineStep (Rater A)  + latency badge
        │   ├── TimelineStep (Rater B)  + latency badge
        │   ├── TimelineStep (Rater C)  + latency badge
        │   └── TimelineStep (Consensus)
        │
        ├── JudgeCards               (3-column grid)
        │   ├── JudgeCard (Rater A — "The Professor")
        │   │   ├── CalibrationChip ("Strict on: structure, quantitative targets")
        │   │   ├── StatusBadge (pending | running | done | error)
        │   │   ├── ScoreBadge (1-5, color-coded)
        │   │   ├── ActionItemReviews (list of items with comments & scores)
        │   │   └── OverallScoreBadge (prominent, with brief rationale)
        │   ├── JudgeCard (Rater B — "The Editor")
        │   └── JudgeCard (Rater C — "The Practitioner")
        │
        ├── ConsensusPanel           (full-width, below judge cards)
        │   ├── ScoreRow
        │   │   ├── FinalScoreBadge (large, prominent)
        │   │   ├── MeanScoreBadge (smaller, muted — deterministic baseline)
        │   │   └── MedianScoreBadge (smaller, muted — deterministic baseline)
        │   ├── AgreementVisualization
        │   │   ├── ScoreDots (3 judge scores → converging to final)
        │   │   └── AgreementBadge (strong/moderate/weak)
        │   ├── DisagreementAnalysis (always visible)
        │   ├── ImprovementsList (consolidated from all judges)
        │   └── DownloadRunJSON button (exports full GradingState)
        │
        └── CopilotChat (sidebar)
            └── (CopilotKit managed)
```

### 7.4 AG-UI State Flow

The frontend does **not** poll or manage SSE connections. CopilotKit handles all transport via its
**single endpoint** (no GraphQL involved — GraphQL was removed in v1.50+).

1. User clicks "Start Grading" → `run({ proposalId, actionItems, proposalTitle })` triggers the
   `gradeDocument` action with explicit parameters.
2. Backend orchestrator calls
   `emitState({ phase: "rater_a", judges: { rater_a: { status: "running" } } })`.
3. CopilotKit runtime encodes this as an AG-UI `STATE_DELTA` event.
4. Frontend `useCoAgent` receives the delta, merges it into `state`, triggers re-render.
5. `useCoAgentStateRender` fires, rendering the timeline with Rater A active.
6. Repeat for each judge and consensus.
7. Final `emitState({ phase: "done", ... })` renders the complete result.

**No custom event types.** All progress is modeled as state transitions on a single `GradingState`
object.

### 7.5 Visual Design Specifications

#### Score Color Coding

| Score | Color                  | Label         |
| ----- | ---------------------- | ------------- |
| 1     | `#DC2626` (red-600)    | Poor          |
| 2     | `#F97316` (orange-500) | Below Average |
| 3     | `#EAB308` (yellow-500) | Adequate      |
| 4     | `#22C55E` (green-500)  | Good          |
| 5     | `#16A34A` (green-600)  | Excellent     |

#### Calibration Chips (per judge card)

Each judge card header includes a short chip explaining what this judge emphasizes:

- Rater A: "Strict on: structure, quantitative targets, metric specificity"
- Rater B: "Generous on: feasibility, clarity, achievability"
- Rater C: "Strict on: actionability, data richness, practical impact"

When judges disagree, the consensus panel's disagreement analysis references these chips, e.g.:
"Rater A penalized lack of quantitative targets (score 2); Rater B valued clear achievability (score
4)."

#### Timeline States

- **Pending:** Gray dot, muted label.
- **Running:** Pulsing blue dot with animated ring, bold label.
- **Done:** Green check with score badge overlay + latency (e.g. "2.1s").
- **Error:** Red X with tooltip showing error message.

#### Judge Cards

- 320px min-width, responsive 3-column grid.
- Header: rater name + persona tag + calibration chip.
- When `status === "running"`: skeleton pulse animation on score/review areas.
- When `status === "done"`: overall score badge slides in, per-item reviews fade in sequentially
  (staggered 100ms). Each item shows: ID, comment, score badge.
- When `status === "error"`: red border, error message, "This judge's evaluation failed. Consensus
  will proceed with remaining judges."

#### Consensus Panel

- Full-width card with subtle gradient background.
- **Score row:** Final score at 48px font size (centered), flanked by smaller mean and median scores
  with labels. This communicates that consensus adds interpretation beyond arithmetic.
- Agreement visualization: three small colored dots (one per judge, color-coded by score) with
  animated lines converging to a central larger dot (the consensus score).
- `agreement_level` badge: "Strong Agreement" (green), "Moderate Agreement" (yellow), "Weak
  Agreement" (red).
- **Download Run JSON** button: exports full `GradingState` as a `.json` file.

---

## 8 · Few-Shot Calibration Sets

### 8.1 Structure

Each rater's calibration set consists of **5 examples** selected from a pool of **8 medical
specialties**. Each example is a complete medical residency program action item paired with a rating
JSON showing how that rater would score it — including rationale and overall score.

The 8 specialties available are:

- Surgery
- Pediatrics
- Emergency Medicine
- Internal Medicine
- Family Medicine
- Anesthesiology
- Psychiatry
- Obstetrics and Gynecology

For each rater, 5 specialties are used for calibration (few-shot examples) and the remaining 3 are
held out for validation.

### 8.2 Rater Selections

**Rater A** (scores range 2-5):

- Surgery (5)
- Emergency Medicine (5)
- Internal Medicine (3)
- Obstetrics & Gynecology (2)
- Anesthesiology (2)
- _Holdout: Pediatrics, Family Medicine, Psychiatry_

**Rater B** (scores range 3-5):

- Surgery (5)
- Emergency Medicine (5)
- Internal Medicine (4)
- Family Medicine (3)
- Anesthesiology (3)
- _Holdout: Pediatrics, Psychiatry, Obstetrics & Gynecology_

**Rater C** (scores range 2-5):

- Surgery (5)
- Pediatrics (5)
- Emergency Medicine (4)
- Internal Medicine (3)
- Anesthesiology (2)
- _Holdout: Family Medicine, Psychiatry, Obstetrics & Gynecology_

### 8.3 Example Format

Each rating file (e.g., `server/src/resources/ratings/rater_a/surgery.json`) contains:

```json
{
  "program": "surgery",
  "rationale": "This is a very strong, well-constructed item with clear linkage from a rich background dataset...",
  "score": 5
}
```

These are loaded at runtime and formatted into few-shot examples for the judge prompts. The action
item text is loaded from `server/src/resources/action_item/{specialty}.md`.

### 8.4 Design Principles

- **Score range coverage:** Each rater's 5 examples cover a range from low (2) to high (5), showing
  the persona's scoring tendencies across quality levels.
- **Consistent voice:** Each rater's rationales reflect their focus areas (Rater A emphasizes
  structure and metrics; Rater B emphasizes clarity and feasibility; Rater C emphasizes
  actionability and data).

### 8.5 Storage

Few-shot sets are loaded from `server/src/resources/` at runtime:

- Action item text: `action_item/{specialty}.md`
- Ratings: `ratings/rater_{a,b,c}/{specialty}.json`
- Rubric: `rubric.txt`

The orchestrator formats these into prompt strings for each judge.

---

## 9 · Project Layout, Packaging & Docker

### 9.1 Repository Layout

```
/
├── shared/                        # Shared types & schemas (runtime dependency)
│   ├── types.ts
│   ├── schemas.ts
│   ├── package.json               # { "name": "@shared/types" }
│   └── tsconfig.json
├── server/
│   ├── src/
│   │   ├── index.ts
│   │   ├── agents/
│   │   │   └── grade-document-agent.ts
│   │   ├── grading/
│   │   │   ├── orchestrator.ts
│   │   │   ├── judge-chain.ts
│   │   │   ├── consensus-chain.ts
│   │   │   ├── structured-output.ts        # 3-tier fallback logic
│   │   │   ├── structured-output-errors.ts # Fallback error definitions
│   │   │   ├── few-shot-sets.ts            # Loads calibration from resources/
│   │   │   ├── content-safety.ts           # Content safety screening
│   │   │   ├── rubric.ts                   # Rubric loading
│   │   │   └── llm.ts                      # LLM client initialization
│   │   └── resources/
│   │       ├── rubric.txt
│   │       ├── action_item/
│   │       │   ├── surgery.md
│   │       │   ├── pediatrics.md
│   │       │   ├── emergency_medicine.md
│   │       │   ├── internal_medicine.md
│   │       │   ├── family_medicine.md
│   │       │   ├── anesthesiology.md
│   │       │   ├── psychiatry.md
│   │       │   └── obstetrics_and_gynecology.md
│   │       └── ratings/
│   │           ├── rater_a/  # 8 JSON files (surgery.json, pediatrics.json, ...)
│   │           ├── rater_b/  # 8 JSON files
│   │           └── rater_c/  # 8 JSON files
│   ├── package.json
│   └── tsconfig.json              # paths: { "@shared/*": ["../shared/*"] }
├── client/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── components/
│   │       ├── GradingView.tsx
│   │       ├── DocumentInput.tsx
│   │       ├── GradingTimeline.tsx
│   │       ├── JudgeCards.tsx
│   │       ├── JudgeCard.tsx
│   │       ├── ConsensusPanel.tsx
│   │       ├── DownloadRunButton.tsx
│   │       ├── ChatSidebar.tsx
│   │       ├── RubricModal.tsx
│   │       ├── TermsModal.tsx
│   │       └── Footer.tsx
│   ├── package.json
│   ├── vite.config.ts             # resolve.alias: { "@shared": "../shared" }
│   └── tsconfig.json              # paths: { "@shared/*": ["../shared/*"] }
├── Dockerfile
└── README.md
```

### 9.2 Path Alias Configuration

**Problem (from review):** Relative imports like `../../shared/schemas` from
`server/src/grading/judge-chain.ts` would resolve to `server/src/shared`, not `/shared`. This won't
compile.

**Solution:** Use `@shared` path aliases in both server and client.

```jsonc
// server/tsconfig.json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": { "@shared/*": ["../shared/*"] },
    "outDir": "dist",
    "rootDirs": ["src", "../shared"],
  },
  "include": ["src/**/*", "../shared/**/*"],
}
```

```jsonc
// client/tsconfig.json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": { "@shared/*": ["../shared/*"] },
  },
}
```

```typescript
// client/vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@shared": path.resolve(__dirname, "../shared") },
  },
});
```

### 9.3 Server Bundling Strategy

**Problem (from review):** The Docker runtime stage copies `server/dist` but not `shared/`. If
compiled server code imports schemas at runtime, you get `MODULE_NOT_FOUND`.

**Solution:** Bundle the server with **tsup** (or esbuild) so that `shared/` code is inlined into
the output bundle. No need to copy `shared/` separately at runtime.

```jsonc
// server/package.json
{
  "scripts": {
    "build": "tsup src/index.ts --format cjs --dts --clean",
    "dev": "tsx watch src/index.ts",
  },
  "devDependencies": {
    "tsup": "^8.0.0",
    "tsx": "^4.0.0",
  },
}
```

```typescript
// server/tsup.config.ts
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs"],
  target: "node20",
  // Bundle shared/ code into the output
  noExternal: ["@shared"],
  clean: true,
});
```

### 9.4 Dockerfile (Multi-Stage)

```dockerfile
# Stage 1: Build client
FROM node:20-slim AS client-build
WORKDIR /app
COPY shared/ ./shared/
COPY client/package*.json ./client/
RUN cd client && npm ci
COPY client/ ./client/
RUN cd client && npm run build

# Stage 2: Build server (bundles shared/ into output)
FROM node:20-slim AS server-build
WORKDIR /app
COPY shared/ ./shared/
COPY server/package*.json ./server/
RUN cd server && npm ci
COPY server/ ./server/
RUN cd server && npm run build

# Stage 3: Runtime (no shared/ needed — bundled into server dist)
FROM node:20-slim
WORKDIR /app

COPY --from=server-build /app/server/dist ./dist
COPY --from=server-build /app/server/node_modules ./node_modules
COPY --from=server-build /app/server/package.json ./
COPY --from=client-build /app/client/dist ./public

EXPOSE 7860

CMD ["node", "dist/index.js"]
```

**Key difference from v2:** `shared/` is copied into build stages so TypeScript compilation
succeeds, but the server bundler (tsup) inlines shared code, so the runtime stage doesn't need it.

### 9.5 HF Spaces README.md Frontmatter

```yaml
---
title: Multi-Judge Grading Demo
emoji: ⚖️
colorFrom: blue
colorTo: green
sdk: docker
app_port: 7860
pinned: false
---
```

### 9.6 Secrets Configuration

In HF Spaces settings, add as **secrets** (not visible in UI):

- `AZURE_OPENAI_API_KEY`
- `AZURE_OPENAI_RESOURCE`
- `AZURE_OPENAI_DEPLOYMENT`

---

## 10 · Security & Abuse Controls

| Control                          | Implementation                                                                                                                                                                                                                                                                                                |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Document size limit**          | `MAX_DOC_CHARS` env var, default 20,000 chars. Enforced in orchestrator before any LLM call. Frontend shows live character count and blocks submission over limit.                                                                                                                                            |
| **Request size limit**           | Express `express.json({ limit: '5mb' })`.                                                                                                                                                                                                                                                                     |
| **Rate limiting**                | `express-rate-limit`: 200 HTTP requests per IP per hour (~10 grading runs, accounting for AG-UI protocol overhead of ~10 requests per page load and ~15 per grading run).                                                                                                                                     |
| **Token secrecy**                | Azure credentials are server-side only, never sent to client. CopilotKit runtime handles all LLM calls.                                                                                                                                                                                                       |
| **Prompt injection defense**     | Zero-shot content safety classifier screens proposal text before judge execution. Uses gpt-5.1-codex-mini with a dedicated safety prompt to detect injection attempts and inappropriate content. Flagged content returns user-friendly error. Azure DefaultV2 guardrail provides additional protection layer. |
| **Cross-user session isolation** | CopilotKit runtime must use per-connection state (not a process-wide singleton). Verify in Milestone 1 that agent state is scoped per session. If needed, attach a `runId` and keep state in a request-scoped Map.                                                                                            |
| **No logging of content**        | Log only: run timestamps, document char length, scores, confidence, model latency. Never log document text.                                                                                                                                                                                                   |

---

## 11 · Error States & Graceful Degradation

| Scenario                                 | Behavior                                                                                                                                                                                                                                                                                                              |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1 judge fails**                        | UI shows red error on that judge's card. Consensus proceeds with 2 judges. Consensus prompt acknowledges missing perspective.                                                                                                                                                                                         |
| **2+ judges fail**                       | UI shows error state: "Unable to form consensus. Please try again." Offer a retry button that resets to `phase: "idle"`.                                                                                                                                                                                              |
| **Azure OpenAI timeout**                 | 30-second timeout per judge call. On timeout, mark judge as error and continue. **Note:** Judge chain implements timeout with AbortController, but signal is not yet passed to the API (prepared for future SDK support). Consensus chain declares `timeoutMs` parameter but does not implement timeout handling yet. |
| **Structured output — all 3 tiers fail** | Mark judge as error. Log the tier-specific failures for debugging.                                                                                                                                                                                                                                                    |
| **Proposal too long**                    | Frontend blocks submission with action item count warning. Backend truncates with `wasTruncated: true` flag, shown in UI.                                                                                                                                                                                             |
| **Azure quota exceeded**                 | Surface Azure error message to UI: "LLM service temporarily unavailable. Please try again later."                                                                                                                                                                                                                     |
| **CopilotKit connection lost**           | Frontend shows reconnection notice. State is stateless (no persistence needed).                                                                                                                                                                                                                                       |

**Schema Notes:**

- `ConsensusOutput.agreement.scores` now properly supports null values for failed judges (via
  `.nullable()` in schema). Missing judges are set to `null` rather than sentinel values, ensuring
  schema compliance.

---

## 12 · Observability

- **Per-run metrics** (logged to stdout, available in HF Space logs):
  - Timestamps: run start, each judge start/end, consensus start/end.
  - `latencyMs` per judge call and total.
  - Proposal ID and action item count.
  - Final scores (all judges + consensus).
  - Agreement level and spread.
  - Structured output tier used (1/2/3) per judge and consensus.
  - Token usage: `promptTokens` and `completionTokens` per judge and consensus.
  - Error counts.
- **"Download Run JSON" button** in the consensus panel — exports the full `GradingState` as a
  `.json` file for transparency and debugging.

---

## 13 · Acceptance Criteria

1. **Deploys on HF Spaces Docker** and loads the UI at the Space URL.
2. **User can input a program proposal with action items** and trigger grading.
3. **UI shows real-time progress** as each judge runs: timeline updates, judge cards animate from
   pending → running → done.
4. **Each judge returns validated structured output** with: proposal_id, evaluator_id,
   evaluator_name, per-item reviews (action_item_id, comment, score), and overall_score (1-5).
5. **Per-item feedback is visible in the UI**, showing specific comments and scores for each action
   item, proving the model provided granular assessment.
6. **Consensus produces a final structured result** with reconciled score constrained to
   `[min, max]` of judge scores, mean/median baselines, agreement analysis, disagreement explanation
   referencing calibration perspectives, and consolidated improvements.
7. **Mean and median are displayed alongside consensus** so users can see the LLM adds
   interpretation, not just arithmetic.
8. **Chat panel works**: user can ask "Why did Rater A score lower?" and get a contextual answer
   referencing specific per-item feedback.
9. **Calibration chips are visible** on each judge card, making calibration differences legible.
10. **Graceful degradation**: if one judge fails, grading still completes with a note.
11. **No Azure credentials are exposed** to the client.
12. **Cross-user sessions are isolated** — simultaneous users don't see each other's grading runs.

---

## 14 · Implementation Milestones

| #   | Milestone                                           | Deliverable                                                                                                                                                                                                                                                                                                              | Risk Level | Est. Effort   |
| --- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | ------------- |
| 1   | **Spike: CopilotKit + Azure v1 on Express**         | Minimal Express server with CopilotKit runtime using `OpenAIAdapter({ openai: azureV1Client })`. CopilotChat works in React. Served on port 7860 in Docker. **Validate:** CopilotKit streams over single endpoint (no GraphQL). Verify per-session state isolation.                                                      | 🔴 HIGH    | 1.5 days      |
| 2   | **Spike: OpenAI SDK structured output on Azure v1** | `client.responses.create()` with Azure v1 baseURL. Test JSON Schema strict mode with `text.format` returns valid JSON from gpt-5.1-codex-mini. **Validate:** All 3 fallback tiers (strict → non-strict → json_object + Zod). Test that `temperature` and `max_tokens` are NOT passed. Confirm `max_output_tokens` works. | 🔴 HIGH    | 1 day         |
| 3   | **Judge pipeline**                                  | Orchestrator runs 3 judges in parallel with progressive state emission. Hardcode a sample document and one calibration set. Verify state updates arrive in frontend via `useCoAgent`.                                                                                                                                    | 🟡 MEDIUM  | 1 day         |
| 4   | **Consensus arbiter**                               | Consensus prompt + schema. Verify: final_score within `[min, max]`, references judge rationales not document, mean/median computed correctly.                                                                                                                                                                            | 🟢 LOW     | 0.5 day       |
| 5   | **Frontend grading UI**                             | Timeline, JudgeCards (with calibration chips, evidence quotes), ConsensusPanel (with score row, agreement viz, download button). Wired to `useCoAgent` state.                                                                                                                                                            | 🟡 MEDIUM  | 2 days        |
| 6   | **Few-shot calibration sets**                       | Write 15 calibration examples (5 per rater) with evidence quotes. Test that different sets produce meaningfully different judge behavior.                                                                                                                                                                                | 🟡 MEDIUM  | 1 day         |
| 7   | **Chat integration**                                | `useCopilotReadable` for grading context. Verify chat answers questions about results. Style the chat sidebar. Add prompt injection defense to chat instructions.                                                                                                                                                        | 🟢 LOW     | 0.5 day       |
| 8   | **Polish & deploy**                                 | Error states, rate limiting, path aliases verified, tsup bundling, Dockerfile, HF Spaces config, secrets. End-to-end test with 3+ simultaneous users.                                                                                                                                                                    | 🟡 MEDIUM  | 1 day         |
|     | **Total**                                           |                                                                                                                                                                                                                                                                                                                          |            | **~8.5 days** |

**Critical path:** Milestones 1 and 2 are the highest-risk spikes. If either fails, the architecture
must change before proceeding.

---

## Appendix A · Package Dependencies

### Server (`server/package.json`)

```json
{
  "dependencies": {
    "@copilotkit/runtime": "^1.51.0",
    "@copilotkitnext/agent": "^1.51.0", // BuiltInAgent for default agent
    "@ag-ui/client": "^0.0.43",
    "@ai-sdk/openai": "^1.0.0", // Vercel AI SDK for BuiltInAgent
    "openai": "^6.0.0",
    "express": "^5.0.0",
    "express-rate-limit": "^8.0.0",
    "pino": "^9.14.0",
    "pino-http": "^10.0.0",
    "pino-pretty": "^11.3.0",
    "rxjs": "^7.8.0",
    "zod": "^4.0.0",
    "zod-to-json-schema": "^3.24.0" // JSON Schema generation for structured output
  },
  "devDependencies": {
    "@vitest/coverage-v8": "^3.0.0",
    "supertest": "^7.2.2",
    "tsup": "^8.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.6.0",
    "vitest": "^3.0.0"
  }
}
```

### Client (`client/package.json`)

```json
{
  "dependencies": {
    "@copilotkit/react-core": "^1.51.0",
    "@copilotkit/react-ui": "^1.51.0",
    "@copilotkitnext/react": "^1.51.0", // CopilotKit v1.51 workaround (useAgent hook)
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    // Additional post-spec styling and legal compliance:
    "@tailwindcss/vite": "^4.1.18", // Tailwind CSS Vite integration
    "tailwindcss": "^4.1.18", // CSS framework
    "react-cookie-consent": "^9.0.0" // GDPR cookie banner
  },
  "devDependencies": {
    "vite": "^6.0.0",
    "@vitejs/plugin-react": "^4.3.0",
    "typescript": "^5.6.0",
    "@vitest/coverage-v8": "^3.0.0",
    "vitest": "^3.0.0",
    "jsdom": "^24.0.0"
  }
}
```

**Note:** `@copilotkitnext/react`, `@tailwindcss/vite`, `tailwindcss`, and `react-cookie-consent`
were added post-spec for CopilotKit v1.51 workarounds, styling (cosmetic updates phase), and legal
compliance (cookie consent requirement).

---

## Appendix B · Key Decisions Log

| Decision                                               | Rationale                                                                                                                                                                                                                              |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Azure v1 API (not legacy api-version)**              | v1 uses standard OpenAI SDK patterns, eliminates Azure-specific adapter friction, aligns with Microsoft's recommended path for GPT-5.x models.                                                                                         |
| **OpenAI SDK directly (not LangChain)**                | Using OpenAI SDK v6 with `client.responses.create()` provides direct control over Responses API parameters without framework abstractions. Avoids version compatibility issues and gives full access to JSON Schema strict mode.       |
| **No `temperature` for judge variance**                | GPT-5.1-codex-mini is a reasoning model; `temperature` is unsupported. Judge variance comes from calibration sets (few-shot examples), which is the correct experimental design anyway.                                                |
| **Parallel judges, not sequential**                    | Faster completion (~3x speedup). Progressive state emissions as each judge completes provide clear UX. Rate limit risk acceptable for demo with limited concurrent users. Sequential can be added as fallback for shared environments. |
| **Consensus as constrained arbiter, not re-evaluator** | If consensus re-reads the proposal, the panel collapses into a single model call with extra steps. Constraining to `[min, max]` and requiring judge-rationale-based justification preserves the multi-judge value.                     |
| **Domain pivot to medical residency evaluation**       | Synthetic medical program action items from resources/ provide realistic domain context and scoring variance for demonstration purposes. Per-item feedback format matches actual program evaluation workflows.                         |
| **Per-item feedback (not criteria)**                   | Action items are the natural evaluation unit for program proposals. Per-item comments and scores provide more actionable feedback than abstract criterion scores.                                                                      |
| **3-tier structured output fallback**                  | Azure Responses API + GPT-5.1 strict JSON Schema support may have limitations. Strategy-based fallback (json_schema strict → non-strict → json_object + Zod runtime validation) is more robust than prompt-based retry.                |
| **tsup server bundling**                               | Inlines `shared/` code into server bundle, eliminating Docker runtime path issues.                                                                                                                                                     |
| **CopilotKit single endpoint (no GraphQL)**            | GraphQL was removed in CopilotKit v1.50+. Spec language updated to reflect current architecture.                                                                                                                                       |

---

## Appendix C · Glossary

| Term                        | Definition                                                                                                                                                                                                                                         |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Action item**             | A specific component of a medical residency program proposal with defined objectives, steps, and success metrics.                                                                                                                                  |
| **Proposal**                | A medical residency program improvement plan consisting of multiple action items, evaluated by the judge panel.                                                                                                                                    |
| **Calibrated judge**        | An LLM instance whose behavior is steered by few-shot examples from a specific human rater, producing scores consistent with that rater's tendencies.                                                                                              |
| **Few-shot set**            | A collection of 5 (program, rating) example pairs selected from 8 medical specialties, used to calibrate a judge. Remaining 3 specialties are held out for validation.                                                                             |
| **Consensus arbiter**       | An LLM call that reconciles multiple judge outputs into a single grade by referencing their rationales — NOT by re-evaluating the proposal independently.                                                                                          |
| **AG-UI**                   | Agent-User Interaction Protocol. An open, event-based protocol for real-time communication between AI agents and UIs. Developed by CopilotKit.                                                                                                     |
| **STATE_DELTA**             | An AG-UI event type that sends an incremental state update from the agent to the frontend.                                                                                                                                                         |
| **Azure OpenAI v1 API**     | The next-generation Azure OpenAI API (Aug 2025+) that uses standard OpenAI SDK patterns with `baseURL` instead of Azure-specific `api-version` query parameters.                                                                                   |
| **Responses API**           | OpenAI's newer API endpoint (`client.responses.create(...)`) designed for reasoning models, preferred over Chat Completions for GPT-5.x models. Uses `max_output_tokens` instead of `max_tokens` and `input`/`instructions` instead of `messages`. |
| **JSON Schema strict mode** | A structured output validation mode where the API enforces exact schema compliance at generation time. Set via `text.format.strict: true` in Responses API. Tier 1 in the 3-tier fallback strategy.                                                |
| **gpt-5.1-codex-mini**      | A compact Azure OpenAI reasoning model supporting structured output, function calling, and configurable `reasoning_effort`. Does NOT support `temperature` or `max_tokens`.                                                                        |
| **Reasoning model**         | An OpenAI model (GPT-5.x, o-series) that performs internal chain-of-thought before responding. Has different parameter constraints than classic chat models.                                                                                       |
| **log_review**              | Tool call name defined in rubric.txt for judge evaluations. Returns structured per-item feedback with proposal_id, evaluator metadata, and action item reviews.                                                                                    |
