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

The project demonstrates a method for simulating expert evaluator panels using example-conditioned
large language model (LLM) personas and aggregating their outputs into a consensus evaluation.

<a href="https://www.youtube.com/watch?v=yYaZP-fsjMo">
  <img src="img/preview.png" alt="Demo Preview" height="240">
</a>

---

## Overview

Three AI judges (each calibrated with a different human rater's scoring patterns) evaluate medical
residency program action items against a shared rubric. A consensus arbiter then reconciles their
scores to produce a final assessment.

## Stack

- **LLM**: gpt-5.1-codex-mini via Azure OpenAI v1 API
- **Backend**: Express.js + CopilotKit Runtime + LangChain.js
- **Frontend**: React + CopilotKit
- **Deployment**: Single-container Docker on Hugging Face Spaces (port 7860)

## Quick Start

```bash
# Install dependencies (monorepo: shared/, server/, client/)
npm install --workspaces

# Start development server (loads .env and bridges OPENAI_* variables)
./start-dev-server.sh

# In another terminal, start development client
./start-dev-client.sh
```

## Documentation

- **`SPEC.md`** — Complete specification (source of truth)
- **`docs/plan/`** — Implementation plans and detailed sub-issues per phase
- **`CODE_STANDARDS.md`** — Development workflow and tooling conventions
