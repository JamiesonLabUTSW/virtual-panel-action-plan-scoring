# Phase 6 — Few-Shot Calibration Sets

**Goal:** Format and select calibration examples from the real resource data (5 of 8 specialties per
rater), and validate that calibration produces meaningful rater differentiation using holdout
specialties.

**Risk:** LOW — resource data already exists; work is formatting, selection, and validation
**Estimated effort:** 0.5 day **Depends on:** Phase 4 (working judge pipeline to test calibration
effects) **Blocks:** Phase 7 (chat quality depends on having differentiated judge outputs)

---

## Parallel Tracks

```
    Track A              Track B              Track C
    6.1 Format Rater A   6.2 Format Rater B   6.3 Format Rater C
    (5 of 8 selections)  (5 of 8 selections)  (5 of 8 selections)
         │                    │                    │
         └────────────┬───────┴────────────────────┘
                      ▼
              6.5 Integrate into few-shot-sets.ts
                      │
                      ▼
              6.4 Validate with Holdout Specialties
```

| Track                       | Sub-issues | Can start after                             |
| --------------------------- | ---------- | ------------------------------------------- |
| **Track A: Rater A format** | 6.1        | Phase 4 (need working pipeline to validate) |
| **Track B: Rater B format** | 6.2        | Phase 4                                     |
| **Track C: Rater C format** | 6.3        | Phase 4                                     |
| **Integration**             | 6.5        | 6.1 + 6.2 + 6.3 all complete                |
| **Validation**              | 6.4        | 6.5                                         |

---

## Resource Data

### Available Specialties (8)

Surgery, Pediatrics, Emergency Medicine, Internal Medicine, Family Medicine, Anesthesiology,
Psychiatry, Obstetrics & Gynecology

### Score Summary

| Specialty          | Rater A | Rater B | Rater C | Spread |
| ------------------ | ------- | ------- | ------- | ------ |
| Surgery            | 5       | 5       | 5       | 0      |
| Pediatrics         | 5       | 5       | 5       | 0      |
| Emergency Medicine | 5       | 5       | 4       | 1      |
| Internal Medicine  | 3       | 4       | 3       | 1      |
| Family Medicine    | 3       | 3       | 3       | 0      |
| Anesthesiology     | 2       | 3       | 2       | 1      |
| Psychiatry         | 3       | 3       | 3       | 0      |
| OB/GYN             | 2       | 4       | 3       | 2      |

### Selected 5 per Rater (optimized for score range coverage)

- **Rater A** [scores 2-5]: Surgery(5), EM(5), IntMed(3), OB/GYN(2), Anesthesiology(2)
- **Rater B** [scores 3-5]: Surgery(5), EM(5), IntMed(4), FamMed(3), Anesthesiology(3)
- **Rater C** [scores 2-5]: Surgery(5), Pediatrics(5), EM(4), IntMed(3), Anesthesiology(2)

### Holdout per Rater (for Phase 6.4 validation)

- **Rater A holdout:** Pediatrics, FamMed, Psychiatry
- **Rater B holdout:** Pediatrics, OB/GYN, Psychiatry
- **Rater C holdout:** FamMed, OB/GYN, Psychiatry

---

## Sub-issues

### 6.1 — Format Rater A Few-Shot Examples

**Description:** Load 5 selected action item documents and rating JSONs for Rater A, format them
into the few-shot prompt string.

**Source data:**

- `server/src/resources/action_item/{surgery,emergency_medicine,internal_medicine,obstetrics_and_gynecology,anesthesiology}.md`
- `server/src/resources/ratings/rater_a/{surgery,emergency_medicine,internal_medicine,obstetrics_and_gynecology,anesthesiology}.json`

**Output format:** Each example is formatted as a user→assistant pair showing the action item
content and the corresponding `log_review` tool call result (proposal_id, evaluator_id,
evaluator_name, items with per-action-item scores and comments, overall_score).

**Acceptance criteria:**

- All 5 examples are valid `log_review` format
- Score range covers 2-5
- Comments reflect Rater A's persona (structure, quantitative targets, metric specificity)

---

### 6.2 — Format Rater B Few-Shot Examples

**Description:** Same as 6.1 but for Rater B selections.

**Source data:** Surgery, EM, IntMed, FamMed, Anesthesiology from `rater_b/`

**Acceptance criteria:**

- Score range covers 3-5
- Comments reflect Rater B's persona (feasibility, clarity, achievability)

---

### 6.3 — Format Rater C Few-Shot Examples

**Description:** Same as 6.1 but for Rater C selections.

**Source data:** Surgery, Pediatrics, EM, IntMed, Anesthesiology from `rater_c/`

**Acceptance criteria:**

- Score range covers 2-5
- Comments reflect Rater C's persona (actionability, data richness, practical impact)

---

### 6.4 — Validate Rater Differentiation with Holdouts

**Description:** Run the pipeline with all 3 calibration sets against the holdout specialties and
verify meaningful rater differentiation.

**Holdout test cases:**

| Specialty  | In Rater A | In Rater B | In Rater C | Expected                       |
| ---------- | ---------- | ---------- | ---------- | ------------------------------ |
| Psychiatry | holdout    | holdout    | holdout    | Common holdout — compare all 3 |
| OB/GYN     | selected   | holdout    | holdout    | A has context, B/C don't       |
| Pediatrics | holdout    | holdout    | selected   | C has context, A/B don't       |

**Validation criteria:**

- Scores from each rater reflect their persona's tendencies
- Known high-scoring specialties (Surgery, Pediatrics) still score high
- Known lower-scoring specialties (Anesthesiology) still score lower
- Rationales use vocabulary consistent with each rater's persona

---

### 6.5 — Integrate into few-shot-sets.ts

**Description:** Replace placeholder examples with the formatted 5-example sets from 6.1-6.3.

**Changes:**

- Update `server/src/grading/few-shot-sets.ts` with final formatted strings
- Remove placeholder TODO comments
- Verify pipeline works end-to-end with expanded sets

**Acceptance criteria:**

- Each rater has exactly 5 examples in `log_review` format
- Pipeline completes successfully with the new examples
- No prompt length issues (if too long, document the decision to reduce)
