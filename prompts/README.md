# Prompt Templates — Multi-Judge Grading System

> **⚠️ IMPORTANT**: These are **illustrative documentation templates** showing the prompt structure
> used in the grading system. The actual prompts remain in the TypeScript codebase and are loaded at
> runtime. These files are for documentation and review purposes only—they are **not** execution
> templates. See the source files listed below for the authoritative implementation.

## Architecture Overview

The multi-judge grading system uses a pipeline with three calibrated judges and a consensus arbiter:

```
User Input (Action Items)
    ↓
Content Safety Check (binary classifier)
    ↓
Judge A ("The Professor")  ─┐
Judge B ("The Editor")     ├─→ Consensus Arbiter → Final Score + Rationale
Judge C ("The Practitioner")─┘
```

Each judge receives:

1. **System Prompt** — Shared rubric with scoring anchors (1-5 scale)
2. **User Prompt** — Few-shot calibration examples + proposal details

The arbiter receives:

1. **System Prompt** — Role definition and synthesis rules
2. **User Prompt** — All three judge evaluations

## File Guide

### Grading System Prompts

| File                                                   | Purpose                               | Format          |
| ------------------------------------------------------ | ------------------------------------- | --------------- |
| [`judge-system.md`](#judge-system-prompt)              | Shared evaluation rubric (all judges) | Markdown        |
| [`judge-user.md.j2`](#judge-user-prompt)               | Judge prompt with proposal + examples | Jinja2 Template |
| [`consensus-system.md`](#consensus-system-prompt)      | Arbiter role + synthesis rules        | Markdown        |
| [`consensus-user.md.j2`](#consensus-user-prompt)       | Arbiter prompt with judge results     | Jinja2 Template |
| [`content-safety.md.j2`](#content-safety-prompt)       | Binary safety classifier              | Jinja2 Template |
| [`few-shot-example.md`](#few-shot-calibration-example) | Example calibration format            | Markdown        |

### Utility Prompts

The `utility/` directory contains reusable prompts for common data analysis and transformation
tasks:

| File                           | Purpose                                                     |
| ------------------------------ | ----------------------------------------------------------- |
| `utility/carryovers.md`        | Analyze year-over-year action item continuity and overlap   |
| `utility/data-translation.md`  | Transform multi-row action data into structured narratives  |
| `utility/data-analysis.md`     | Calculate inter-rater reliability metrics (ICC, Kappa, AC1) |
| `utility/duplicates.md`        | Identify programs with similar or duplicate action plans    |
| `utility/rater-reliability.md` | Measure rater agreement and consistency across evaluators   |

---

## Judge System Prompt

**File:** [`judge-system.md`](./judge-system.md)

**Purpose:** Defines the shared evaluation framework for all three judges.

**Content:**

- Evaluator role and primary objective
- Input/output schema definition
- Scoring anchors (1-5 scale with definitions)
- Comment style guidelines
- Validation checklist
- Failure mode handling

**Raters:** Applied identically to Rater A, Rater B, and Rater C. The few-shot examples (calibration
examples) provide persona-specific tone and scoring patterns.

**Source:** [`server/src/resources/rubric.txt`](../server/src/resources/rubric.txt)

---

## Judge User Prompt

**File:** [`judge-user.md.j2`](./judge-user.md.j2)

**Purpose:** Shows the structure of the user prompt sent to each judge, with variables for dynamic
content.

**Variables:**

- `{{ fewShotExamples }}` — 5 calibration examples specific to the rater's persona
- `{{ proposalId }}` — Integer proposal identifier
- `{{ evaluatorId }}` — Integer rater ID (1=Rater A, 2=Rater B, 3=Rater C)
- `{{ evaluatorName }}` — Human-readable rater name
- `{{ actionItemsText }}` — Formatted list of action items with stable IDs

**Structure:**

1. Calibration examples (persona-specific)
2. Proposal metadata (ID, evaluator, name)
3. Action items to evaluate
4. Evaluation instruction

**Source:** [`server/src/grading/judge-chain.ts`](../server/src/grading/judge-chain.ts) (lines
170-184)

---

## Consensus System Prompt

**File:** [`consensus-system.md`](./consensus-system.md)

**Purpose:** Defines the consensus arbiter's role and rules for synthesizing judge evaluations.

**Content:**

- Arbiter role as consensus synthesizer
- Rater persona descriptions ("The Professor", "The Editor", "The Practitioner")
- Seven core rules:
  1. Final score must be within judge score range
  2. Rationale grounded in judge feedback (no new claims)
  3. Identify agreements and shared themes
  4. Explain disagreements based on rater perspectives
  5. Acknowledge missing judges if applicable
  6. Deduplicate and consolidate improvement suggestions
  7. Return only valid JSON

**Source:** [`server/src/grading/consensus-chain.ts`](../server/src/grading/consensus-chain.ts)
(lines 132-163)

---

## Consensus User Prompt

**File:** [`consensus-user.md.j2`](./consensus-user.md.j2)

**Purpose:** Shows the structure of the user prompt sent to the consensus arbiter.

**Variables:**

- `{{ rater_a_score }}` — Rater A's overall score
- `{{ rater_a_result }}` — Rater A's full structured evaluation (JSON)
- `{{ rater_b_score }}` — Rater B's overall score
- `{{ rater_b_result }}` — Rater B's full structured evaluation (JSON)
- `{{ rater_c_score }}` — Rater C's overall score
- `{{ rater_c_result }}` — Rater C's full structured evaluation (JSON)
- `{{ missingJudgeCount }}` — Number of judges that failed (0-1)

**Structure:**

1. Rater A evaluation subsection
2. Rater B evaluation subsection
3. Rater C evaluation subsection
4. Missing judge note (if applicable)
5. Synthesis instruction

**Notes:**

- If a judge fails, only 2-3 evaluations are present
- The arbiter must acknowledge reduced confidence with missing judges
- Each rater's evaluation is presented as formatted JSON for clarity

**Source:** [`server/src/grading/consensus-chain.ts`](../server/src/grading/consensus-chain.ts)
(function `formatConsensusUserPrompt()`, lines 172-216)

---

## Content Safety Prompt

**File:** [`content-safety.md.j2`](./content-safety.md.j2)

**Purpose:** Binary classifier that detects prompt injection attempts and inappropriate content
before evaluation begins.

**Variables:**

- `{{ TEXT }}` — User-submitted proposal text to classify

**Output:** One word only

- `"SAFE"` — Legitimate proposal, safe to process
- `"UNSAFE"` — Injection attempt, inappropriate content, or malicious input

**Detection targets:**

- Prompt injection attempts ("ignore previous instructions", meta-instructions)
- Inappropriate content violating usage policies
- Malicious content designed to manipulate judges

**Security boundary:** This is the only point where untrusted user input enters the grading
pipeline. All other inputs (rubric, examples, system prompts) are controlled server-side.

**Fallback layers:**

1. Azure DefaultV2 guardrail (pre-deployed)
2. LLM zero-shot classifier
3. Both return `isSafe: false` if triggered

**Source:** [`server/src/grading/content-safety.ts`](../server/src/grading/content-safety.ts) (lines
54-70)

---

## Few-Shot Calibration Example

**File:** [`few-shot-example.md`](./few-shot-example.md)

**Purpose:** Illustrates the calibration format used to customize judge behavior by rater persona.

**Content:**

- Structure of a few-shot example (User message → Assistant response)
- Real example with Surgery action item and Rater A evaluation
- Schema field annotations
- Rater tone variations

**Rater Personas:**

| Rater | Persona            | Calibration Style                                                                            |
| ----- | ------------------ | -------------------------------------------------------------------------------------------- |
| A     | "The Professor"    | Strict on structure, quantitative targets, metric specificity. Demands detailed methodology. |
| B     | "The Editor"       | Generous on feasibility and clarity. Values achievable, well-articulated plans.              |
| C     | "The Practitioner" | Strict on actionability, data richness, practical impact. Focuses on implementation.         |

**Calibration approach:**

- Each judge receives 5 few-shot examples matching their rater's persona
- Examples show scoring tendencies (avg. score per rater)
- Examples show comment style (length, detail level, tone)
- Judge LLM learns to emulate the rater's pattern

**Schema fields:**

- `proposal_id` — Matches current request (not example)
- `evaluator_id` — Rater ID (1, 2, or 3)
- `evaluator_name` — Rater name ("Rater A", etc.)
- `items[]` — Per-item evaluations with `action_item_id`, `comment`, `score`
- `overall_score` — Holistic assessment (1-5)

**Source:** [`server/src/grading/few-shot-sets.ts`](../server/src/grading/few-shot-sets.ts) —
Generates examples from calibration JSON files

---

## Utility Prompts

**Directory:** [`utility/`](./utility)

**Purpose:** Reusable prompt templates for common data analysis, transformation, and validation
tasks outside the core grading pipeline.

**Available Prompts:**

### Analyze Year-Over-Year Carryovers

**File:** [`utility/carryovers.md`](./utility/carryovers.md)

Analyze action items across two consecutive years to identify continuity and changes in program
priorities. Produces a summary with percentage overlap and interpretations.

### Data Translation: Action Items to Narrative Format

**File:** [`utility/data-translation.md`](./utility/data-translation.md)

Transform multi-row action item data into leadership-ready structured narratives. Aggregates action
plan data for each program into a single narrative per action item with explicit section headings.

**Key features:**

- Verbatim text retention (no summarization)
- Exact deduplication of repeated content
- SMART Objective validation rules
- Excel workbook output with formatting

### Data Analysis: Reliability Metrics

**File:** [`utility/data-analysis.md`](./utility/data-analysis.md)

Calculate inter-rater reliability metrics to measure agreement between evaluators. Supports multiple
statistical measures:

- **ICC(2,1)** and **ICC(2,3)** for continuous/interval scale ratings
- **Cohen's Kappa** for two-rater categorical agreement
- **Gwet's AC1** for robust categorical agreement

### Duplicate Detection: Similar Action Items

**File:** [`utility/duplicates.md`](./utility/duplicates.md)

Identify programs with highly similar action plans and flag potential duplicates or redundant
planning. Provides similarity scoring and recommendations for consolidation.

### Rater Reliability Analysis

**File:** [`utility/rater-reliability.md`](./utility/rater-reliability.md)

Comprehensive guide for measuring inter-rater agreement and consistency. Covers common statistical
methods, data requirements, and output interpretation.

---

## Related Files

**Prompt source implementations:**

- [`server/src/resources/rubric.txt`](../server/src/resources/rubric.txt) — Judge system prompt
- [`server/src/grading/judge-chain.ts`](../server/src/grading/judge-chain.ts) — Judge implementation
- [`server/src/grading/consensus-chain.ts`](../server/src/grading/consensus-chain.ts) — Consensus
  implementation
- [`server/src/grading/content-safety.ts`](../server/src/grading/content-safety.ts) — Safety
  classifier
- [`server/src/grading/few-shot-sets.ts`](../server/src/grading/few-shot-sets.ts) — Calibration
  example generation

**Authoritative specification:**

- [`SPEC.md`](../SPEC.md) — §4.6 for authoritative prompt specifications
- [`SPEC.md`](../SPEC.md) — §5.1-5.4 for backend architecture
- [`SPEC.md`](../SPEC.md) — §7.1-7.5 for frontend implementation

**Schemas (Zod):**

- [`shared/schemas`](../shared/schemas) — `JudgeOutput`, `ConsensusOutput` schemas (source of truth)

---

## Template Syntax

These files use **Jinja2-style syntax** for template variables to avoid confusion with actual
values:

```jinja2
{{ variable }}     {# Jinja2 template variable #}
{# comment #}      {# Jinja2 comment (ignored at runtime) #}
{% if %}...{% endif %}  {# Jinja2 conditional #}
```

This syntax is used for documentation clarity only. At runtime:

- The actual prompts are loaded as strings from TypeScript source
- Variables are substituted dynamically by the judge and consensus chains
- No actual Jinja2 template engine is used in the production system

---

## Synchronization

These templates are **illustrative documentation** and must be manually kept in sync with source
code:

1. **Code review process:** When prompt changes are reviewed, the corresponding template files
   should be updated
2. **No automated sync:** We don't auto-generate these from code (too fragile)
3. **Change tracking:** Code reviews flag discrepancies between templates and source
4. **SPEC.md:** Remains the authoritative source for prompt specifications

---

## Key Architectural Decisions

1. **Three calibrated judges** — Each with distinct persona (Professor, Editor, Practitioner) to
   capture different evaluation perspectives
2. **Consensus arbiter** — Synthesizes judge perspectives without re-reading the original proposal
   (prevents bias)
3. **Few-shot calibration** — Judges learn evaluation patterns from human rater examples, not
   generic instructions
4. **Shared rubric** — All judges use identical evaluation framework (1-5 scoring anchors)
5. **Content safety boundary** — Only user input is untrusted; system inputs (prompts, examples) are
   controlled
6. **Deterministic statistics** — Agreement metrics computed by code, never trusted from LLM

---

## Questions?

For implementation details, see the source files and SPEC.md. For architectural decisions, see
CLAUDE.md.
