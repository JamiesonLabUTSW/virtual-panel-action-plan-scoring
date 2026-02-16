---
title: Multi-Judge Grading Demo
emoji: ⚖️
colorFrom: blue
colorTo: green
sdk: docker
app_port: 7860
pinned: false
---

# Leveraging Artificial Intelligence to Enhance Institutional Quality Assurance: Automating Annual Action Plan Scoring as a Use Case

**2026 ACGME Annual Educational Conference — Meaning in Medicine**

[![Open in Spaces](https://huggingface.co/datasets/huggingface/badges/resolve/main/open-in-hf-spaces-md.svg)](https://huggingface.co/spaces/mike-holcomb/multi-judge-grading-demo)

[Video Presentation of Technique](https://www.youtube.com/watch?v=yYaZP-fsjMo)

---

## What This Demo Does

This project demonstrates a method for simulating expert evaluator panels using **calibrated AI
judge personas**. Three AI judges—each trained with different human rater examples—independently
evaluate medical residency program action plans against the same rubric. Their assessments are then
reconciled by a consensus arbiter that produces a final score with transparent agreement statistics.

The technique showcases how **few-shot calibration** (providing example evaluations in the prompt
context, without any model training or weight updates) can create meaningfully different evaluation
perspectives from the same language model. When judges disagree, their different scoring tendencies
reflect the distinct evaluation philosophies of the human raters they were calibrated against. This
disagreement becomes a feature rather than a bug, helping program directors understand which aspects
of their proposals are universally strong versus which might need refinement based on different
evaluative lenses.

The system provides **real-time feedback** as each judge completes their evaluation, with per-item
comments, scores, and a final consensus assessment. After grading, users can ask follow-up questions
through an interactive chat interface to better understand the results.

---

## Research Context

This demonstration was developed for the **2026 ACGME Annual Educational Conference** to showcase
practical applications of AI in medical education quality assurance. The calibrated multi-judge
approach addresses a common challenge: **expert evaluators often disagree on assessment scores**,
and understanding _why_ they disagree can be as valuable as the scores themselves.

Traditional inter-rater reliability approaches treat evaluator disagreement as measurement error to
be minimized. This project takes a different perspective: **disagreement can be informative** when
it reflects different but equally valid evaluative philosophies. By making judge calibration
explicit and providing transparent consensus statistics, this system helps program directors
understand evaluation results in terms of different evaluative priorities (structure vs. feasibility
vs. actionability) rather than dismissing disagreement as noise.

The technique demonstrates that AI can support quality assurance not by replacing human judgment,
but by making the diversity of expert perspectives more visible and actionable.

---

## The Evaluation Technique

### Three Calibrated Judges

Each judge is calibrated with five example evaluations from a specific human rater, giving them
distinct scoring tendencies:

| Judge       | Persona          | Calibration Tendency                                          |
| ----------- | ---------------- | ------------------------------------------------------------- |
| **Rater A** | The Professor    | Strict on structure, quantitative targets, metric specificity |
| **Rater B** | The Editor       | Generous on feasibility and clarity, values achievable plans  |
| **Rater C** | The Practitioner | Strict on actionability, data richness, practical impact      |

**How calibration works**: Each judge receives the same evaluation rubric but sees different example
evaluations during their training. These examples demonstrate how their assigned human rater scored
proposals and what aspects they emphasized in their feedback. The AI judges learn to emulate these
evaluation patterns—Rater A demands detailed metrics, Rater B focuses on clear communication, and
Rater C prioritizes real-world implementation.

### Scoring Scale

The shared rubric uses a 5-point scale with clear anchors:

- **1 = Poor**: fundamental gaps; lacks feasibility, clarity, or alignment
- **2 = Weak**: notable issues; partial feasibility or unclear execution
- **3 = Adequate**: meets minimum; feasible but needs improvements
- **4 = Strong**: solid plan with minor refinements suggested
- **5 = Excellent**: clear, feasible, well-aligned, high impact

Each judge applies this scale through their calibrated lens. The same action plan might score a 5
from Rater B (who values clear articulation) while receiving a 3 from Rater A (who demands more
quantitative detail). Both are valid assessments reflecting different evaluative priorities.

### How Consensus Works

After all judges complete their evaluations, a consensus arbiter synthesizes their perspectives:

- **Score constraint**: The final score must fall within the range of judge scores (between the
  minimum and maximum). The arbiter cannot invent scores outside what the judges found.
- **Agreement levels** (calculated using a simple mathematical rule, not AI interpretation):
  - **Strong**: Judges' scores differ by 0-1 point
  - **Moderate**: Judges' scores differ by 2 points
  - **Weak**: Judges' scores differ by 3-4 points
- **Statistics**: Mean, median, and score spread are calculated mathematically to provide objective
  benchmarks alongside the AI-generated synthesis.
- **Synthesis approach**: The arbiter uses AI to combine and explain the judges' feedback, but only
  reads the judges' comments—not the original proposal—ensuring it truly reconciles different
  perspectives rather than adding a fourth independent opinion.

When judges agree, the consensus highlights shared themes. When they disagree, the arbiter explains
_why_ based on the judges' different calibration perspectives and the specific evidence each cited.

---

## How It Works

```
User enters proposal
    ↓
Browser (React UI with real-time updates)
    ↓
Server (Express + CopilotKit Runtime)
    ↓
Three AI Judges evaluate in parallel
    ↓
Consensus Arbiter synthesizes results
    ↓
Azure OpenAI (gpt-5.1-codex-mini)
    ↓
Final assessment displayed with chat Q&A
```

As each judge completes their evaluation, the backend immediately sends updated state to the
frontend. Users see the timeline update in real time—first Rater A completes, then Rater B, then
Rater C, and finally the consensus emerges. No polling or refresh required.

---

## Technology Stack

| Layer                 | Technology                                                                    |
| --------------------- | ----------------------------------------------------------------------------- |
| **LLM**               | gpt-5.1-codex-mini via Azure OpenAI v1 API                                    |
| **Backend**           | Express.js 5 + CopilotKit Runtime 1.51                                        |
| **Frontend**          | React 18 + CopilotKit UI components                                           |
| **Structured Output** | Zod 4 schemas + OpenAI SDK's zodTextFormat                                    |
| **Orchestration**     | Reactive Extensions for JavaScript (RxJS) 7.8 Observables for event streaming |
| **Deployment**        | Docker (single container on Hugging Face Spaces, port 7860)                   |
| **Runtime**           | Node.js 24+                                                                   |

**Note**: The implementation uses the OpenAI SDK v6 directly to access Azure's Responses API.
LangChain is not used—the OpenAI SDK provides the necessary abstractions for reasoning model
interactions and structured output with Zod integration.

---

## Quick Start

### Local Development

```bash
# 1. Clone repository and install dependencies (monorepo)
npm install --workspaces

# 2. Create .env file in project root with Azure OpenAI credentials
cat > .env << EOF
AZURE_OPENAI_API_KEY=your_api_key_here
AZURE_OPENAI_RESOURCE=your_resource_name
AZURE_OPENAI_DEPLOYMENT=your_deployment_name
EOF

# 3. Start development servers
./start-dev-server.sh  # Backend (port 7860, loads .env automatically)
./start-dev-client.sh  # Frontend (port 5173, new terminal)

# 4. Open browser to http://localhost:5173
```

**Development workflow**: The client dev server proxies `/api/*` requests to the backend server on
port 7860. Changes to React components hot-reload automatically. Changes to server code trigger
automatic restarts via tsx watch mode.

### Docker Deployment

```bash
# Build image
docker build -t grading-demo .

# Run with environment file
docker run -p 7860:7860 --env-file .env grading-demo
```

The Dockerfile uses multi-stage builds to optimize image size—dependencies are installed in a
builder stage, then only production artifacts are copied to the final image.

---

## Environment Variables

Required configuration for Azure OpenAI connection:

| Variable                  | Required | Purpose                                            |
| ------------------------- | -------- | -------------------------------------------------- |
| `AZURE_OPENAI_API_KEY`    | Yes      | Azure OpenAI authentication key                    |
| `AZURE_OPENAI_RESOURCE`   | Yes      | Azure resource name (e.g., `my-openai-resource`)   |
| `AZURE_OPENAI_DEPLOYMENT` | Yes      | Model deployment name (must be gpt-5.1-codex-mini) |

These variables are validated at server startup. If any are missing, the server will fail fast with
a clear error message rather than starting with incomplete configuration.

---

## Model Constraints (gpt-5.1-codex-mini)

This reasoning model has non-standard parameter support compared to standard chat models:

- ❌ **Not supported**: `temperature`, `max_tokens`, `top_p` (will cause API errors if passed)
- ✅ **Use instead**: `max_output_tokens` parameter for controlling response length
- ✅ **API endpoint**: Azure Responses API (`/openai/v1/responses` path)
- ✅ **Reasoning effort**: Defaults to `none`, can be adjusted if needed for more complex reasoning

**Why Responses API?** Reasoning models use a different API surface than chat models:

- Standard Chat Completions API uses `messages` array and `choices[].message`
- Responses API uses `input`/`instructions` and `output.content[].text`
- Only Responses API supports the parameter constraints of reasoning models
- Structured output works differently—JSON Schema strict mode is fully supported

**Implementation note**: The 3-tier structured output fallback system accounts for these
differences, attempting strict JSON Schema validation first and gracefully degrading if needed.

---

## Documentation

- **`SPEC.md`** — Complete technical specification (source of truth for implementation details)
- **`docs/plan/`** — Phase-by-phase implementation plans with detailed sub-issues
- **`CODE_STANDARDS.md`** — Development workflow, tooling conventions, and quality standards
- **`CLAUDE.md`** — Project context and guidance for AI-assisted development
- **`prompts/README.md`** — Prompt template documentation (judge system, consensus arbiter, few-shot
  calibration examples, and utility prompts for data analysis)

---

## Technical Implementation Details

This section provides detailed architecture information for developers who want to understand or
extend the implementation.

### Component Architecture

```
┌──────────────────────────────────────────────────────────┐
│  Browser                                                 │
│  ┌──────────────────────────────┐ ┌────────────────────┐│
│  │  Grading UI                  │ │  Chat Sidebar      ││
│  │  • Timeline (judge progress) │ │  • Follow-up Q&A   ││
│  │  • Judge cards (3 columns)   │ │  • Context-aware   ││
│  │  • Consensus panel           │ │    explanations    ││
│  │  (React + CopilotKit hooks)  │ │  (CopilotChat)     ││
│  └──────────────────────────────┘ └────────────────────┘│
│         ↕ Agent-User Interaction (AG-UI) protocol        │
├──────────────────────────────────────────────────────────┤
│  Express Server (port 7860)                              │
│  ┌────────────────────────────────────────────────────┐  │
│  │  CopilotKit Runtime                                │  │
│  │  ├─ gradeDocument agent                            │  │
│  │  │  └─ Orchestrator                                │  │
│  │  │     ├─ Judge A (Rater A calibration)           │  │
│  │  │     ├─ Judge B (Rater B calibration)           │  │
│  │  │     ├─ Judge C (Rater C calibration)           │  │
│  │  │     └─ Consensus arbiter                       │  │
│  │  │                                                  │  │
│  │  └─ default agent (BuiltInAgent for chat Q&A)     │  │
│  └────────────────────────────────────────────────────┘  │
│  ├── GET  /              → React static build            │
│  ├── POST /api/copilotkit → CopilotKit Runtime           │
│  └── GET  /api/health     → liveness probe               │
│                                                          │
│         ↕ HTTPS (Azure OpenAI v1 API)                    │
│    Azure OpenAI (gpt-5.1-codex-mini deployment)          │
└──────────────────────────────────────────────────────────┘
```

### Key Architectural Features

**Progressive state emission**: The backend uses the Agent-User Interaction (AG-UI) protocol to
stream state updates as events. Each judge completion triggers a `STATE_SNAPSHOT` event that updates
the frontend UI immediately—no polling or page refresh required.

**3-tier structured output fallback**: To ensure judges always return valid JSON, the system
attempts three increasingly permissive validation strategies:

1. JSON Schema with strict validation (preferred)
2. JSON Schema without strict mode (fallback)
3. JSON Object mode with runtime validation (last resort)

This graceful degradation ensures reliable structured output even when the AI service has temporary
limitations.

**Agent-User Interaction protocol**: CopilotKit's AG-UI protocol handles all real-time communication
over a single HTTP endpoint. Events like `STATE_SNAPSHOT` and `RUN_FINISHED` stream from server to
client automatically—no custom WebSocket or Server-Sent Events implementation needed.

**Azure Responses API**: The reasoning model (gpt-5.1-codex-mini) requires the Responses API rather
than the standard Chat Completions API. This specialized endpoint supports reasoning-specific
parameters and JSON Schema strict mode validation.
