# Multi-Judge LLM Grading Demo

A medical residency program action item evaluation system using a panel of calibrated AI judges.

## Overview

Three AI judges (each calibrated with a different human rater's scoring patterns) evaluate program
action items against a shared rubric. A consensus arbiter then reconciles their scores to produce a
final assessment.

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
