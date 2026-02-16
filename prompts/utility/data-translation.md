# Data Translation: Action Items to Narrative Format

## Input Data

### Setting

- **Dataset:** Excel workbook with action plan data for ~200 programs
- **Program identifier:** Column E
- **Structure:** Each program has up to 5 action items
- **Fields:** Action item data is repeated across multiple columns including:
  - Content areas
  - Background
  - Objectives
  - Measurements
  - Team members
  - Evaluation
  - Planning
  - Action steps
  - Etc.

## Goal

Create a leadership- and reviewer-ready Excel workbook that aggregates all rows for each Program +
Action Item into a single structured narrative per action item, while retaining all original text
verbatim.

## Output: Narrative Structure (Required)

For each Action Item, build a narrative with explicit section headings in this order (when present):

1. **MAJOR CONTENT AREAS**
2. **SPECIFIC CONTENT AREAS**
3. **BACKGROUND**
4. **OBJECTIVE (SMART Objective)**
5. **DATA OR INNOVATION**
6. **MEASUREMENT(S)** - include source, current value, expected value
7. **TEAM MEMBERS**
8. **EVALUATION MECHANISMS**
9. **PLANNING PRELIMINARY WORK**
10. **ITERATIVE EVALUATION(S)**
11. **SUMMATIVE EVALUATION(S)**
12. **ACTION STEPS**
13. **PROPOSED ACTION TO DRIVE CHANGE**

## Critical Business Rules

### Text Processing

- **Do not summarize or paraphrase**
- Combine text across rows
- De-duplicate only exact repeats

### Action Item Inclusion Rules

- **Action Item 4 and Action Item 5 must be DROPPED if the SMART Objective field is blank**
- This check must be performed at the **program level**, not per row
- If no SMART Objective exists anywhere for Action 4 or 5 for a program, that action item must
  remain blank in the final output

## Excel Output Requirements

### Workbook Structure

**Sheet Name:** "Aggregated Action Items"

**Layout:**

- One row per Program
- Columns:
  - A: Program name
  - B: Action 1
  - C: Action 2
  - D: Action 3
  - E: Action 4
  - F: Action 5

### Formatting Requirements

- Action columns contain the full structured narrative
- Text: wrapped, top-aligned
- Column widths: wide for Action fields to accommodate long narratives
- Header row: styled and frozen
- Filters: enabled for easy sorting/searching

## Audience & Validation

**Reviewers:** Senior leadership and external reviewers

**Quality Standards:**

- Readability and clear structure are essential
- Fidelity to submitted data must be maintained
- Programs with fewer than 5 action items must accurately reflect missing items (due to blank
  Objectives)
