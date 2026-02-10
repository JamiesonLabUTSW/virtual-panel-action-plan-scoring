# Phase 4 — Judge Pipeline & Consensus Arbiter

**Goal:** Build the full grading orchestrator: three sequential judge calls with progressive state emission, plus the consensus arbiter chain.

**Risk:** MEDIUM — relies on Phase 2 + 3 integrations
**Estimated effort:** 1.5 days
**Depends on:** Phase 2 (CopilotKit action + state emission), Phase 3 (structured output + LLM config)
**Blocks:** Phase 5, Phase 6

---

## Parallel Tracks

```
    Track A: Content Constants       Track B: LLM Chains
    4.1 Rubric Module                4.3 Judge Chain ◄── needs 4.1, Phase 3
    4.2 Placeholder Few-Shots        4.4 Consensus Chain ◄── needs Phase 3
         │                                  │
         │                           (4.3 and 4.4 are parallel — different files, different schemas)
         │                                  │
         └─────────┐               ┌────────┘
                   ▼               ▼
              4.5 Grading Orchestrator ◄── needs 4.3 + 4.4
                         │
                         ▼
              4.6 CopilotKit Action
                         │
                         ▼
              4.7 Frontend Wiring
```

| Track | Sub-issues | Can start after |
|-------|-----------|-----------------|
| **Track A: Content** | 4.1, 4.2 | Phase 3 complete (no code deps, just need the project set up) |
| **Track B: Judge chain** | 4.3 | 4.1 + Phase 3 |
| **Track B: Consensus chain** | 4.4 | Phase 3 (does not need 4.1/4.2 — uses its own prompt) |
| **Integration** | 4.5 | 4.3 + 4.4 |
| **Wiring** | 4.6, 4.7 | 4.5 (sequential — action wraps orchestrator, frontend consumes action) |

**2 developers:** Dev A starts with 4.1 + 4.2 (content constants, fast), then picks up 4.3 (judge chain). Dev B starts with 4.4 (consensus chain — independent of rubric/few-shots). Once both chains are done, one dev builds 4.5 (orchestrator), then 4.6 → 4.7 flows sequentially. Dev B can start on Phase 5 utility work (5.8) or Phase 6 authoring while 4.5–4.7 are completed.

---

## Sub-issues

### 4.1 — Create Rubric Module

**Description:**
Create the shared rubric text constant used by all judge chains and the consensus arbiter.

**Changes:**

Create `server/src/grading/rubric.ts`:
- Export `RUBRIC_TEXT` as a string constant containing the rubric table from SPEC §4.3
- Three criteria: Clarity (1-5), Reasoning (1-5), Completeness (1-5)
- Include the anchor descriptions for scores 1, 3, and 5
- Include the note that `overall_score` is holistic, not an average

**Acceptance criteria:**
- `RUBRIC_TEXT` is a well-formatted string suitable for prompt injection
- All three criteria and their score anchors are present
- The holistic scoring note is included

**Code quality:**
- Template literal with clear formatting (the LLM reads this, so readability matters)
- No dynamic content — this is a pure constant

---

### 4.2 — Create Placeholder Few-Shot Sets

**Description:**
Create temporary calibration examples (1-2 per rater) so the judge pipeline can be tested before the full 15-example set is written in Phase 6.

**Changes:**

Create `server/src/grading/few-shot-sets.ts`:
- Export `RATER_A_EXAMPLES`, `RATER_B_EXAMPLES`, `RATER_C_EXAMPLES` as formatted strings
- Each contains 1-2 example `(document_excerpt, JudgeOutput JSON)` pairs
- Rater A examples emphasize structure/logic concerns
- Rater B examples emphasize clarity/prose concerns
- Rater C examples emphasize actionability/evidence concerns
- Follow the example format from SPEC §8.2

**Acceptance criteria:**
- Each rater has at least 1 complete example with all `JudgeOutput` fields
- Examples include `evidence_quotes` per criterion
- Each rater's examples reflect their persona's tendencies
- Placeholder examples are clearly marked with a `// TODO: Replace with full 5-example sets in Phase 6` comment

**Code quality:**
- Examples are formatted as readable strings (not minified JSON)
- Evidence quotes are realistic (could plausibly come from the document excerpt)

---

### 4.3 — Implement Judge Chain

**Description:**
Create the LangChain judge chain that takes document text, rubric, and few-shot examples, and returns a validated `JudgeOutput`.

**Changes:**

Create `server/src/grading/judge-chain.ts`:
- Import the shared `llm` instance from `llm.ts`
- Import `invokeWithStructuredOutput` from `structured-output.ts`
- Import `JudgeOutput` schema from `@shared/schemas`
- Create `ChatPromptTemplate` with:
  - System message: judge system prompt from SPEC §4.6 (evaluator rules, confidence scale, injection defense)
  - User message: rubric text, calibration examples, document in `<document>` tags
- Export `runJudge({ documentText, rubricText, fewShotExamples })` function
- The function constructs the prompt, calls `invokeWithStructuredOutput`, and returns `{ result: JudgeOutputType, tier: number }`
- 30-second timeout per call (using `AbortController` or LangChain timeout config)

**Acceptance criteria:**
- `runJudge` with a sample document returns a valid `JudgeOutputType`
- `overall_score` is 1-5 integer
- `confidence` is between 0 and 1
- `criteria` has exactly 3 items (Clarity, Reasoning, Completeness)
- `evidence_quotes` in each criterion contain text that appears in the input document
- `key_evidence` items have valid `supports` and `valence` fields
- A 30-second timeout is enforced; exceeding it throws an error (not a hang)

**Code quality:**
- The judge system prompt matches SPEC §4.6 exactly (copy-paste, then verify)
- Document text is wrapped in `<document>` tags per SPEC §10
- No `temperature` or `maxTokens` in the chain configuration
- The prompt template uses LangChain's `{variable}` interpolation, not string concatenation

---

### 4.4 — Implement Consensus Chain

**Description:**
Create the LangChain consensus arbiter chain that reconciles judge outputs into a final grade.

**Changes:**

Create `server/src/grading/consensus-chain.ts`:
- Import the shared `llm` instance from `llm.ts`
- Import `invokeWithStructuredOutput` from `structured-output.ts`
- Import `ConsensusOutput` schema from `@shared/schemas`
- Create `ChatPromptTemplate` with:
  - System message: consensus arbiter prompt from SPEC §4.6 (arbiter rules, score constraint, no new document analysis)
  - User message: rubric text + formatted judge outputs (per SPEC §4.6 consensus user prompt template)
- Export `runConsensus({ judgeResults, rubricText, missingJudgeCount })` function
- The function formats judge results into the prompt template, calls `invokeWithStructuredOutput`, and returns the consensus
- Handle 2-judge case: when `missingJudgeCount > 0`, the prompt notes the missing perspective

**Acceptance criteria:**
- `runConsensus` with 3 judge outputs returns a valid `ConsensusOutputType`
- `final_score` is within `[min(judge scores), max(judge scores)]`
- `agreement.scores` contains all provided rater scores
- `agreement.mean_score` is correct (arithmetic mean, 1 decimal)
- `agreement.median_score` is correct
- `agreement.spread` equals `max - min` of judge scores
- `agreement.agreement_level` matches the spread rules: 0-1 = strong, 2 = moderate, 3-4 = weak
- `rationale` references judge perspectives, not the original document
- With only 2 judges, the consensus acknowledges the missing perspective

**Code quality:**
- `mean_score`, `median_score`, `spread`, and `agreement_level` should be computed deterministically in code after the LLM call, NOT trusted from the LLM output — the LLM provides qualitative synthesis, code provides the math
- Alternatively, if the full output is LLM-generated, add post-processing validation that corrects the deterministic fields
- The consensus prompt matches SPEC §4.6 exactly
- Judge output formatting in the user prompt includes rater labels and scores for quick reference

---

### 4.5 — Implement Grading Orchestrator

**Description:**
Create the orchestrator that runs 3 judges sequentially, emits state updates, handles failures, and invokes the consensus arbiter.

**Changes:**

Create `server/src/grading/orchestrator.ts`:
- Import `runJudge`, `runConsensus`, few-shot sets, `RUBRIC_TEXT`, shared types
- Export `runGradingPipeline({ documentText, documentTitle, emitState })` following SPEC §5.3
- Pipeline steps:
  1. Validate document size (`MAX_DOC_CHARS`), truncate if needed, set `wasTruncated`
  2. For each judge (rater_a, rater_b, rater_c) sequentially:
     - Set judge status to `running`, emit state with current phase
     - Call `runJudge` with the rater's few-shot examples
     - On success: set status to `done`, record `result` and `latencyMs`, log metrics, emit state
     - On failure: set status to `error`, record error message and `latencyMs`, log error, emit state, continue to next judge
  3. After all judges: count successes
     - If < 2 succeeded: emit `phase: "error"`, throw error
     - If >= 2 succeeded: emit `phase: "consensus"`, call `runConsensus`
  4. On consensus success: emit `phase: "done"` with full `GradingState`
  5. Return the final `GradingState`

**Acceptance criteria:**
- With 3 successful judges: pipeline completes with `phase: "done"` and a valid consensus
- With 1 failed judge: pipeline completes, consensus acknowledges missing perspective
- With 2 failed judges: pipeline emits `phase: "error"` and throws
- State emissions arrive in order: `rater_a` (running) → `rater_a` (done) → `rater_b` (running) → ... → `consensus` → `done`
- Each state emission contains the full cumulative judges object (not just deltas)
- `latencyMs` is recorded for every judge call (including failures)
- Stdout logs per SPEC §12: `[judge:rater_a] score=X confidence=Y latency=Zms`, `[consensus] final_score=X agreement=Y spread=Z`

**Code quality:**
- Sequential execution is explicit (for loop with await, not Promise.all)
- State is built up immutably: each emission creates a new judges object
- Document text is never logged
- The `emitState` callback type matches `(state: Partial<GradingState>) => void`

---

### 4.6 — Create CopilotKit gradeDocument Action

**Description:**
Register the grading pipeline as a CopilotKit action that the frontend can trigger with explicit parameters.

**Changes:**

Create `server/src/actions/grade-document.ts`:
- Export `gradeDocumentAction` as a CopilotKit `Action` following SPEC §5.2
- Name: `"gradeDocument"`
- Parameters: `documentText` (string, required), `documentTitle` (string, optional)
- Handler: calls `runGradingPipeline`, passing `context.emitStateUpdate` as the `emitState` callback
- Returns `JSON.stringify(result)` of the final `GradingState`

Update `server/src/index.ts`:
- Import `gradeDocumentAction`
- Register it in the `CopilotRuntime` actions array
- Remove the test action from Phase 2.4

**Acceptance criteria:**
- The action is registered and visible to CopilotKit
- Triggering the action with a document text string runs the full pipeline
- State updates are emitted to the frontend via AG-UI
- The action returns the final GradingState as JSON

**Code quality:**
- Action parameter types match the CopilotKit `Action` interface
- The handler is a thin wrapper — all logic lives in the orchestrator
- Error handling: if the pipeline throws, the action should propagate the error to CopilotKit (which will surface it to the frontend)

---

### 4.7 — Wire Frontend to gradeDocument Action

**Description:**
Update the frontend to trigger the `gradeDocument` action and display live state updates.

**Changes:**

Update `client/src/App.tsx` or create `client/src/components/GradingView.tsx`:
- Use `useCoAgent<GradingState>({ name: "gradeDocument", initialState: INITIAL_GRADING_STATE })`
- Add a simple document input (textarea + submit button — not the full UI, just enough to test)
- On submit: call `run({ documentText: text, documentTitle: "Test" })`
- Display the raw `GradingState` as formatted JSON (or a simple status display showing phase + judge statuses)
- This is a functional test harness, not the final UI (Phase 5)

**Acceptance criteria:**
- Entering text and clicking submit triggers the grading pipeline
- The UI updates as each judge starts and completes (visible phase changes)
- Judge results are visible in the state display
- Consensus result appears after all judges
- The full cycle works: idle → rater_a → rater_b → rater_c → consensus → done
- Errors are visible (e.g., if a judge fails, its error state appears)

**Code quality:**
- The test harness is minimal — it will be replaced by the full UI in Phase 5
- `useCoAgent` types are correctly parameterized with `GradingState`
- No premature UI components — the goal is pipeline validation, not visual design
