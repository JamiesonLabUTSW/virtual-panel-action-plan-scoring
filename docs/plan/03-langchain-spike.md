# Phase 3 — LangChain.js Structured Output Spike

**Goal:** Validate that `ChatOpenAI` with Azure v1 baseURL produces valid structured JSON from
gpt-5.1-codex-mini using the 3-tier fallback strategy.

**Risk:** HIGH — `ChatOpenAI` + Azure v1 + `useResponsesApi` + `withStructuredOutput` is the
least-tested path **Estimated effort:** 1 day **Depends on:** Phase 1 (shared schemas), Phase 2
(Azure v1 connectivity confirmed) **Blocks:** Phase 4

---

## Parallel Tracks

```
                   3.1 Install + Configure ChatOpenAI
                      │         │         │
              ┌───────┘         │         └───────┐
              ▼                 ▼                  ▼
    Track A: Tier Tests    Track B: Schema    Track C: API Fallback
    3.2 Tier 1 (json_schema)  3.5 ConsensusOutput  3.6 Responses vs
    3.3 Tier 2 (func calling)     test                  Chat Completions
    3.4 Tier 3 (json_object)
              │                 │                  │
              └────────┬────────┘──────────────────┘
                       ▼
              3.7 Finalize structured-output.ts
```

| Track                          | Sub-issues    | Can start after                                                                                                                                                                          |
| ------------------------------ | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Setup**                      | 3.1           | Phase 2                                                                                                                                                                                  |
| **Track A: Tier tests**        | 3.2, 3.3, 3.4 | 3.1 (can develop all 3 tiers in parallel since each is a separate code path; however 3.2→3.3→3.4 build on each other in `structured-output.ts`, so one dev owns this track sequentially) |
| **Track B: Schema validation** | 3.5           | 3.1 (independent — tests ConsensusOutput schema, not tier logic)                                                                                                                         |
| **Track C: API fallback**      | 3.6           | 3.1 (independent — tests alternative LLM config)                                                                                                                                         |
| **Finalize**                   | 3.7           | Track A complete                                                                                                                                                                         |

**2 developers:** One dev owns Track A (the 3-tier fallback, 3.2→3.3→3.4→3.7) since the tiers build
on each other in a single file. The other dev takes Track B (3.5 — consensus schema test) and Track
C (3.6 — Responses API vs Chat Completions). Both start after 3.1 is done (single-dev task).

---

## Sub-issues

### 3.1 — Install LangChain Dependencies and Configure ChatOpenAI

**Description:** Add LangChain packages and create a correctly configured `ChatOpenAI` instance
targeting Azure v1.

**Changes:**

Add to `server/package.json` dependencies:

- `@langchain/openai ^0.5.0`
- `@langchain/core ^0.3.0`

Create `server/src/grading/llm.ts` — shared LLM instance:

```typescript
const llm = new ChatOpenAI({
  model: process.env.AZURE_OPENAI_DEPLOYMENT!,
  openAIApiKey: process.env.AZURE_OPENAI_API_KEY,
  configuration: { baseURL: AZURE_BASE_URL },
  useResponsesApi: true,
  maxOutputTokens: 2000,
  // NO temperature — reasoning model
  // NO maxTokens — use maxOutputTokens
});
```

**Acceptance criteria:**

- `ChatOpenAI` instantiates without errors
- A simple `.invoke([["human", "Say hello"]])` call returns a valid response from Azure
  gpt-5.1-codex-mini
- No `temperature`, `maxTokens`, or `top_p` are present in the outgoing request (verify via verbose
  LangChain logging or network inspection)
- `maxOutputTokens` is correctly passed (not silently dropped)

**Code quality:**

- LLM instance created in a single module (`llm.ts`) and exported for reuse by judge and consensus
  chains
- Azure base URL constructed from env var, matching the pattern established in Phase 2
- The `!` assertion on `process.env.AZURE_OPENAI_DEPLOYMENT` is acceptable here because startup
  validation (Phase 2.6) guarantees it exists

---

### 3.2 — Test Tier 1: `withStructuredOutput` (json_schema strict mode)

**Description:** Test the preferred structured output path:
`withStructuredOutput(JudgeOutput, { strict: true })`.

**Changes:**

Create `server/src/grading/structured-output.ts`:

- Export an `invokeWithStructuredOutput` function that takes a `ChatPromptTemplate`-piped chain and
  input
- Implement Tier 1: `llm.withStructuredOutput(schema, { name, strict: true })`

Create a test script or integration test (`server/src/grading/__tests__/structured-output.test.ts`
or a standalone script):

- Construct a minimal prompt: system message with evaluator instructions, user message with a short
  hardcoded document (~200 words) and the rubric text
- Call `invokeWithStructuredOutput` with the `JudgeOutput` schema
- Validate the result against the Zod schema

**Acceptance criteria:**

- Tier 1 returns a valid `JudgeOutputType` object
- All fields are present and correctly typed: `overall_score` (1-5 int), `confidence` (0-1 float),
  `criteria` (exactly 3 items), `key_evidence` (2-6 items), `strengths` (1-3 items), `improvements`
  (1-3 items)
- `evidence_quotes` per criterion contain actual text from the input document
- The Zod `.parse()` call succeeds on the raw result

**Failure handling:**

- If Tier 1 fails with a provider rejection (e.g., `json_schema` not supported), log the exact error
  message and fall through to Tier 2
- Document whether the error is a 4xx from Azure or a LangChain-level error

**Code quality:**

- The test uses a realistic document excerpt, not a trivial one-liner
- Error logging includes the tier number and the error type for debugging

---

### 3.3 — Test Tier 2: `withStructuredOutput` (function calling)

**Description:** Test the first fallback:
`withStructuredOutput(schema, { method: "functionCalling" })`.

**Changes:**

Extend `invokeWithStructuredOutput` in `structured-output.ts`:

- Catch Tier 1 errors
- Attempt Tier 2: `llm.withStructuredOutput(schema, { name, method: "functionCalling" })`

Test:

- Force Tier 2 by either skipping Tier 1 or using a flag
- Validate the result matches `JudgeOutput` schema

**Acceptance criteria:**

- Tier 2 returns a valid `JudgeOutputType` object with the same quality bar as Tier 1
- The function calling mechanism correctly constrains output to the Zod schema
- If Tier 1 also works, Tier 2 is confirmed as a viable fallback

**Code quality:**

- The fallback is clean — Tier 1 catch block logs a warning, then Tier 2 executes as a fresh call
- No state leaks between tiers

---

### 3.4 — Test Tier 3: json_object Mode + Runtime Zod Validation

**Description:** Test the last-resort fallback: `response_format: { type: "json_object" }` with
runtime Zod parsing.

**Changes:**

Extend `invokeWithStructuredOutput` in `structured-output.ts`:

- Catch Tier 2 errors
- Attempt Tier 3: `llm.bind({ response_format: { type: "json_object" } })`, invoke, then
  `JSON.parse` + `schema.parse()`

Test:

- Force Tier 3 by skipping Tiers 1 and 2
- Validate the result matches `JudgeOutput` schema

**Acceptance criteria:**

- Tier 3 returns a valid `JudgeOutputType` object
- The Zod `.parse()` catches any schema violations that the model might produce (since this tier has
  no schema enforcement at the API level)
- If the model produces invalid JSON, the error is caught and reported clearly

**Code quality:**

- `JSON.parse` is wrapped in a try/catch with a descriptive error message
- Zod validation errors include the path to the failing field (Zod does this by default)
- The response content extraction handles both string and object `content` types from LangChain

---

### 3.5 — Test with ConsensusOutput Schema

**Description:** Verify structured output also works for the `ConsensusOutput` schema, which has a
different shape (nested `agreement` object, different field constraints).

**Changes:**

Create a consensus test:

- Hardcode 3 sample `JudgeOutput` results
- Construct a consensus prompt with the arbiter system prompt from SPEC §4.6
- Call `invokeWithStructuredOutput` with `ConsensusOutput` schema
- Validate the result

**Acceptance criteria:**

- `ConsensusOutput` parses correctly with all tiers
- `agreement.scores` contains all 3 rater scores
- `agreement.agreement_level` is one of `"strong"`, `"moderate"`, `"weak"`
- `agreement.spread` is a valid integer 0-4
- `final_score` is within `[min(judge scores), max(judge scores)]`

**Code quality:**

- Test uses the exact consensus prompt templates from SPEC §4.6
- Sample judge outputs are realistic and include edge cases (e.g., spread of 0, spread of 3)

---

### 3.6 — Validate Responses API vs Chat Completions Fallback

**Description:** If `useResponsesApi: true` causes issues, validate the fallback to Chat Completions
API with `max_completion_tokens`.

**Changes:**

Create an alternative LLM config:

```typescript
const llmFallback = new ChatOpenAI({
  model: process.env.AZURE_OPENAI_DEPLOYMENT!,
  openAIApiKey: process.env.AZURE_OPENAI_API_KEY,
  configuration: { baseURL: AZURE_BASE_URL },
  useResponsesApi: false, // Use Chat Completions instead
  maxCompletionTokens: 2000, // Chat Completions parameter name
});
```

Test:

- Run the same Tier 1 structured output test with this fallback config
- Compare results

**Acceptance criteria:**

- If Responses API works: document it as the primary path, keep `useResponsesApi: true`
- If Responses API fails: document the exact failure, switch to Chat Completions as the default
- Either path produces valid structured output from gpt-5.1-codex-mini

**Code quality:**

- The chosen API path is documented with a comment in `llm.ts` explaining why it was selected
- The alternative config is kept as a comment (not dead code) for reference if the primary path
  breaks in the future

---

### 3.7 — Finalize structured-output.ts with Logging

**Description:** Clean up the 3-tier fallback implementation with proper logging for observability.

**Changes:**

Finalize `server/src/grading/structured-output.ts`:

- Export `invokeWithStructuredOutput<T>(chain, input, schema, schemaName)` — generic over the schema
  type
- Each tier logs: `[structured-output] Attempting tier N (method) for <schemaName>`
- On tier failure, log:
  `[structured-output] Tier N (method) failed for <schemaName>: <error message>`
- On success, log: `[structured-output] Tier N (method) succeeded for <schemaName>`
- Return the parsed result along with metadata: `{ result: T, tier: 1 | 2 | 3 }`
- If all tiers fail, throw a descriptive error with the tier-by-tier failure reasons

**Acceptance criteria:**

- Calling `invokeWithStructuredOutput` returns `{ result, tier }` on success
- The `tier` field allows the orchestrator to log which tier was used per judge call (for
  observability, SPEC §12)
- All 3 tiers fail → error message includes all 3 failure reasons
- Logs never include document content, only schema name and error messages

**Code quality:**

- Function is generic: works with both `JudgeOutput` and `ConsensusOutput` schemas
- Type-safe: return type is inferred from the Zod schema
- No side effects beyond logging
