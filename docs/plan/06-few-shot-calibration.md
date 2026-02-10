# Phase 6 — Few-Shot Calibration Sets

**Goal:** Author the 15 calibration examples (5 per rater) that give each judge its distinct evaluation personality, and validate that calibration produces meaningful rater differentiation.

**Risk:** MEDIUM — quality depends on iterative prompt tuning
**Estimated effort:** 1 day
**Depends on:** Phase 4 (working judge pipeline to test calibration effects)
**Blocks:** Phase 7 (chat quality depends on having differentiated judge outputs)

---

## Parallel Tracks

This phase is **perfectly parallelizable across 3 developers** — each rater's calibration set is independent.

```
    Track A              Track B              Track C
    6.1 Rater A          6.2 Rater B          6.3 Rater C
    "The Professor"      "The Editor"         "The Practitioner"
         │                    │                    │
         └────────────┬───────┴────────────────────┘
                      ▼
              6.5 Replace Placeholders (merge all 3 into few-shot-sets.ts)
                      │
                      ▼
              6.4 Validate Rater Differentiation
```

| Track | Sub-issues | Can start after |
|-------|-----------|-----------------|
| **Track A: Professor** | 6.1 | Phase 4 (need `JudgeOutput` schema to validate examples) |
| **Track B: Editor** | 6.2 | Phase 4 |
| **Track C: Practitioner** | 6.3 | Phase 4 |
| **Integration** | 6.5 | 6.1 + 6.2 + 6.3 all complete |
| **Validation** | 6.4 | 6.5 |

**3 developers:** Each person authors one rater's 5-example set independently. They can share 1-2 document excerpts for cross-calibration testing but otherwise work in isolation. After all 3 merge, one person runs 6.4 validation.

**2 developers:** One dev takes Rater A + Rater C (most different personas — helps maintain focus). Other dev takes Rater B. Both coordinate on shared document excerpts.

---

## Sub-issues

### 6.1 — Author Rater A Calibration Set ("The Professor")

**Description:**
Write 5 calibration examples for Rater A: an experienced academic reviewer who is strict on structure and logical flow, lenient on style.

**Changes:**

Add to `server/src/grading/few-shot-sets.ts` — `RATER_A_EXAMPLES`:

5 examples, each containing:
- Document excerpt (100-200 words)
- Complete `JudgeOutput` JSON with all fields

**Example design requirements:**

| # | Score Band | Purpose |
|---|-----------|---------|
| 1 | 4-5 (high) | Well-structured document with clear logical chain — shows what The Professor values |
| 2 | 3 (mid) | Adequate structure but some logical gaps — shows calibrated "adequate" |
| 3 | 1-2 (low) | Poor organization, no logical flow — shows what The Professor penalizes |
| 4 | 3-4 (borderline) | Good content but weak structure — demonstrates confidence ~0.6 for borderline cases |
| 5 | 2-3 (borderline) | Informal but logically sound — shows leniency on style despite structural issues |

**Per-example requirements:**
- `rationale` reflects The Professor's voice: references "structure," "logical flow," "argumentation," "organization"
- `evidence_quotes` per criterion contain actual text from the document excerpt
- `key_evidence` includes 2-4 items with correct `supports` and `valence`
- `strengths` and `improvements` are specific to structure/logic concerns
- `confidence` follows the operational scale: 0.9 for clear cases, 0.6 for borderlines, 0.3 for ambiguous

**Acceptance criteria:**
- All 5 examples parse successfully against `JudgeOutput.parse()`
- Score range: at least one 1-2, one 3, one 4-5
- At least one example has `confidence <= 0.6` (borderline case)
- Evidence quotes in each example are substrings of the corresponding document excerpt
- The Professor's persona is consistent: strict on structure/logic, lenient on style across all examples
- No example penalizes informal tone or stylistic choices (that's The Editor's domain)

**Code quality:**
- Each example is clearly labeled (`Example 1:`, `Example 2:`, etc.)
- JSON in examples is formatted for readability (2-space indent)
- Document excerpts cover different genres/topics for diversity

---

### 6.2 — Author Rater B Calibration Set ("The Editor")

**Description:**
Write 5 calibration examples for Rater B: a professional editor who is strict on clarity and prose quality, lenient on depth.

**Changes:**

Add to `server/src/grading/few-shot-sets.ts` — `RATER_B_EXAMPLES`:

| # | Score Band | Purpose |
|---|-----------|---------|
| 1 | 4-5 (high) | Crystal-clear prose, well-organized paragraphs — shows what The Editor values |
| 2 | 3 (mid) | Readable but with some unclear passages — calibrated "adequate" |
| 3 | 1-2 (low) | Confusing phrasing, poor readability, jargon-heavy — shows what The Editor penalizes |
| 4 | 3-4 (borderline) | Clear writing but lacks depth — demonstrates leniency on depth |
| 5 | 2-3 (borderline) | Deep analysis but poorly written — shows strictness on clarity despite good content |

**Per-example requirements:**
- `rationale` reflects The Editor's voice: references "clarity," "phrasing," "readability," "prose quality," "sentence structure"
- Evidence quotes highlight specific phrasing issues or strengths
- Improvements focus on rewriting, restructuring sentences, removing jargon

**Acceptance criteria:**
- All 5 examples parse successfully against `JudgeOutput.parse()`
- Score range: at least one 1-2, one 3, one 4-5
- At least one example has `confidence <= 0.6`
- The Editor's persona is consistent: strict on clarity/prose, lenient on depth
- No example penalizes shallow analysis if the writing is clear (that's The Practitioner's domain)
- Evidence quotes specifically point to phrasing-level issues (word choice, sentence structure)

**Code quality:**
- Same formatting standards as Rater A examples
- Document excerpts are different from Rater A's (though they may share 1-2 for cross-calibration testing)

---

### 6.3 — Author Rater C Calibration Set ("The Practitioner")

**Description:**
Write 5 calibration examples for Rater C: an industry professional who is strict on actionability and evidence, lenient on formality.

**Changes:**

Add to `server/src/grading/few-shot-sets.ts` — `RATER_C_EXAMPLES`:

| # | Score Band | Purpose |
|---|-----------|---------|
| 1 | 4-5 (high) | Data-driven, actionable recommendations, concrete evidence — shows what The Practitioner values |
| 2 | 3 (mid) | Some supporting data but vague recommendations — calibrated "adequate" |
| 3 | 1-2 (low) | All assertions, no evidence, no actionable takeaways — shows what The Practitioner penalizes |
| 4 | 3-4 (borderline) | Good evidence but informally presented — demonstrates leniency on formality |
| 5 | 2-3 (borderline) | Formally perfect but contains vague claims — shows strictness on evidence despite good form |

**Per-example requirements:**
- `rationale` reflects The Practitioner's voice: references "evidence," "data," "actionability," "concrete," "measurable," "support"
- Evidence quotes highlight presence or absence of supporting data
- Improvements focus on adding data, specifics, measurable outcomes

**Acceptance criteria:**
- All 5 examples parse successfully against `JudgeOutput.parse()`
- Score range: at least one 1-2, one 3, one 4-5
- At least one example has `confidence <= 0.6`
- The Practitioner's persona is consistent: strict on actionability/evidence, lenient on formality
- No example penalizes informal language if the content is well-supported (that's The Editor's domain)

**Code quality:**
- Same formatting standards as Raters A and B
- Document excerpts include some with quantitative data and some without (to test the practitioner's differentiation)

---

### 6.4 — Validate Rater Differentiation

**Description:**
Run the full pipeline with all 3 calibration sets against 2-3 test documents and verify that different raters produce meaningfully different scores and rationales.

**Test documents:**

| Doc | Characteristics | Expected Differentiation |
|-----|----------------|-------------------------|
| **Test Doc 1:** Well-structured, formal, but vague | Professor: high (good structure), Editor: moderate (good prose), Practitioner: low (vague claims) |
| **Test Doc 2:** Informal, data-rich, poorly organized | Professor: low (poor structure), Editor: low (informal prose), Practitioner: high (strong evidence) |
| **Test Doc 3:** Clear, well-argued, moderate depth | All three: moderate-high, but with different emphasis in rationales |

**Validation process:**
1. Run each test document through the full pipeline
2. Compare the 3 judge scores per document
3. Verify rationales reflect each rater's persona
4. Check that evidence quotes are relevant to each rater's focus area
5. Verify consensus correctly identifies the disagreement patterns

**Acceptance criteria:**
- For Test Doc 1: Practitioner's score is at least 1 point lower than Professor's score
- For Test Doc 2: Professor's score is at least 1 point lower than Practitioner's score
- Rationale text from each rater uses vocabulary consistent with their persona
- Evidence quotes from each rater focus on different aspects of the document
- Consensus `disagreement_analysis` correctly references the calibration perspective differences
- If differentiation is insufficient: adjust few-shot examples and re-test

**Code quality:**
- Test documents are saved as fixtures for future regression testing
- Results are documented (logged or saved) for reference

---

### 6.5 — Replace Placeholder Examples from Phase 4

**Description:**
Replace the 1-2 placeholder examples per rater (from Phase 4.2) with the full 5-example sets.

**Changes:**

Update `server/src/grading/few-shot-sets.ts`:
- Replace `RATER_A_EXAMPLES` with the full 5-example set from 6.1
- Replace `RATER_B_EXAMPLES` with the full 5-example set from 6.2
- Replace `RATER_C_EXAMPLES` with the full 5-example set from 6.3
- Remove `// TODO: Replace with full 5-example sets in Phase 6` comments

**Acceptance criteria:**
- Each rater has exactly 5 examples
- All examples parse against `JudgeOutput` schema
- The pipeline still works end-to-end with the expanded sets (no prompt length issues)
- If prompt length is an issue with 5 examples per rater, reduce to 3 and document the decision

**Code quality:**
- Final few-shot strings are clean, well-formatted, and ready for production
- No leftover placeholder comments or TODO markers
