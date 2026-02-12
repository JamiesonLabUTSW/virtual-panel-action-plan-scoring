# Phase 5 — Frontend Grading UI

**Goal:** Build the full grading interface with document input, progress timeline, judge cards with
evidence, and consensus panel.

**Risk:** MEDIUM **Estimated effort:** 2 days **Depends on:** Phase 4 (working pipeline with state
emission) **Blocks:** Phase 7 (chat integration uses the same layout)

---

## Parallel Tracks

This phase is **highly parallelizable** — most components are independent presentational units with
well-defined props.

```
    5.8 Score Color Utility (start first — other components depend on it)
         │
         ├──────────┬──────────────┬───────────────┬──────────────┐
         ▼          ▼              ▼               ▼              ▼
    Track A     Track B       Track C        Track D        Track E
    5.1 Doc     5.2 Grading   5.3 JudgeCard  5.5 Consensus  5.6 Download
    Input       Timeline           │          Panel          RunButton
                                   ▼
                              5.4 JudgeCards
                                   Grid
         │          │              │               │              │
         └──────────┴──────┬───────┴───────────────┴──────────────┘
                           ▼
                   5.7 Assemble GradingView
```

| Track                    | Sub-issues | Can start after                                                 |
| ------------------------ | ---------- | --------------------------------------------------------------- |
| **Foundation**           | 5.8        | Phase 4 (or earlier — no backend dependency, just shared types) |
| **Track A: Input**       | 5.1        | 5.8 (only uses shared types, no score colors)                   |
| **Track B: Timeline**    | 5.2        | 5.8 (uses score colors for done-state badges)                   |
| **Track C: Judge cards** | 5.3, 5.4   | 5.8 (5.4 depends on 5.3)                                        |
| **Track D: Consensus**   | 5.5        | 5.8 (uses score colors extensively)                             |
| **Track E: Download**    | 5.6        | Phase 4 (no dependency on 5.8 — just serializes state)          |
| **Assembly**             | 5.7        | All tracks complete                                             |

**3+ developers:** After 5.8 (quick, one dev), assign each track to a different developer. Tracks
A-E are fully independent — they touch different files with no shared mutable state. One dev can own
Track C (5.3 + 5.4 are sequential). Assembly (5.7) is a single-dev integration task at the end.

**2 developers:** Dev A takes 5.1 + 5.2 + 5.6 (lighter components). Dev B takes 5.3 + 5.4 + 5.5
(heavier data display components). Either can start with 5.8. Then they jointly assemble 5.7.

---

## Sub-issues

### 5.1 — DocumentInput Component

**Description:** Build the document submission form shown when `phase === "idle"`.

**Changes:**

Create `client/src/components/DocumentInput.tsx`:

- Textarea for pasting document text
- `.txt` file upload button that reads file contents via `FileReader` into the textarea
- Live character count display: `"X / 20,000 characters"`
- Warning when count exceeds `MAX_DOC_CHARS` (20,000 default) — visually highlight the counter (red
  text)
- Disable the submit button when text is empty or exceeds the limit
- Optional title input field
- "Start Grading" button that calls `onSubmit(text, title)`
- Props: `onSubmit: (text: string, title?: string) => void`

**Acceptance criteria:**

- Pasting text updates the character count in real time
- Uploading a `.txt` file populates the textarea and updates the count
- Uploading a non-`.txt` file is rejected (or only `.txt` is selectable via `accept=".txt"`)
- Character count turns red/warning when over the limit
- Submit button is disabled when text is empty
- Submit button is disabled when character count exceeds the limit
- Clicking "Start Grading" calls `onSubmit` with the text and optional title
- The component unmounts when `phase` leaves `"idle"` (parent controls visibility)

**Code quality:**

- `FileReader` usage is properly typed and handles errors (e.g., unreadable file)
- Character limit is a constant (not magic number), importable for potential server-side reuse
- No unnecessary re-renders — character count updates are efficient

---

### 5.2 — GradingTimeline Component

**Description:** Horizontal stepper showing the progression through Rater A → Rater B → Rater C →
Consensus.

**Changes:**

Create `client/src/components/GradingTimeline.tsx`:

- Props: `phase: Phase`, `judges: GradingState["judges"]`
- Renders 4 steps in a horizontal row connected by lines/arrows:
  1. Rater A ("The Professor")
  2. Rater B ("The Editor")
  3. Rater C ("The Practitioner")
  4. Consensus
- Each step shows a status indicator per SPEC §7.5:
  - **Pending:** Gray dot, muted label
  - **Running:** Pulsing blue dot with animated ring, bold label
  - **Done:** Green check with score badge overlay + latency (e.g., "2.1s")
  - **Error:** Red X with tooltip showing error message
- Step status is derived from:
  - Judge steps: `judges[raterId]?.status` (pending if undefined)
  - Consensus step: `phase === "consensus"` → running, `phase === "done"` → done
- Score badge on done judges shows `result.overall_score` with the score color coding

**Acceptance criteria:**

- Timeline renders all 4 steps in a horizontal row
- Steps update in real-time as the pipeline progresses
- Running step has a visible animation (pulsing blue)
- Done steps show the score badge with correct color (1=red → 5=green)
- Done steps show latency in seconds (e.g., "2.1s")
- Error steps show red X and the error message is accessible (tooltip or inline)
- Timeline is responsive — wraps gracefully on narrow screens

**Code quality:**

- Score colors match SPEC §7.5 exactly: `1=#DC2626, 2=#F97316, 3=#EAB308, 4=#22C55E, 5=#16A34A`
- Animation uses CSS (not JS intervals) for the pulsing effect
- Component is purely presentational — no side effects or state management

---

### 5.3 — JudgeCard Component

**Description:** Single judge result card displaying all structured output data with evidence
quotes.

**Changes:**

Create `client/src/components/JudgeCard.tsx`:

- Props: `judgeState: JudgeState`, `raterId: string`
- Card layout per SPEC §7.3 and §7.5:
  - **Header:** Rater name + persona tag + calibration chip
    - Calibration chips per SPEC §7.5: "Penalizes: weak structure, logic gaps" (A), "Penalizes:
      unclear phrasing, poor readability" (B), "Penalizes: vague claims, missing evidence" (C)
  - **Status badge:** pending | running | done | error
  - **When running:** Skeleton pulse animation on score/criteria areas
  - **When done:**
    - Score badge (large, color-coded 1-5)
    - Confidence indicator with operational legend (0.9=clear, 0.6=borderline, 0.3=ambiguous)
    - Criteria breakdown: 3 rows, each with criterion name, score (color-coded), notes, and evidence
      quotes in quote-block style
    - Key evidence list (expandable/collapsible)
    - Rationale summary (collapsed by default, expandable)
    - Strengths list
    - Improvements list
  - **When error:** Red border, error message, note: "This judge's evaluation failed. Consensus will
    proceed with remaining judges."

**Acceptance criteria:**

- Pending state: muted card with rater name
- Running state: skeleton animation visible in score and criteria areas
- Done state: all fields from `JudgeOutputType` are displayed
- Evidence quotes are visually distinct (quote-block styling)
- Per-criterion evidence quotes are shown inline with each criterion
- Score colors match the spec for both overall score and per-criterion scores
- Confidence value has the operational legend nearby (tooltip or inline)
- Collapsed sections (rationale, evidence) expand on click
- Error state: red border, error message text, informational note about consensus
- Card has min-width of 320px per SPEC §7.5

**Code quality:**

- Calibration chip text is derived from a mapping constant (not hardcoded per instance)
- Expandable sections use a simple toggle — no heavy accordion library
- All text content is derived from the `JudgeState` data, not hardcoded

---

### 5.4 — JudgeCards Grid Component

**Description:** Responsive 3-column grid containing the three judge cards.

**Changes:**

Create `client/src/components/JudgeCards.tsx`:

- Props: `judges: GradingState["judges"]`
- Renders 3 `JudgeCard` components in a responsive grid
- Grid behavior: 3 columns on desktop, 2 on tablet, 1 on mobile
- Each card uses 320px min-width
- Cards for judges that haven't started yet still render in pending state (empty card with rater
  name)

**Acceptance criteria:**

- All 3 judge cards render even before the pipeline starts (in pending state)
- Grid is responsive: collapses from 3 → 2 → 1 columns as viewport narrows
- Cards maintain min-width of 320px
- Cards update independently as each judge completes

**Code quality:**

- Grid uses CSS Grid with `auto-fill` / `minmax` for responsiveness (no JS media queries)
- Judge order is fixed: Rater A, Rater B, Rater C (left to right)

---

### 5.5 — ConsensusPanel Component

**Description:** Full-width panel displaying the consensus result, agreement analysis, and download
button.

**Changes:**

Create `client/src/components/ConsensusPanel.tsx`:

- Props: `consensus: ConsensusOutputType`, `judges: GradingState["judges"]`
- Layout per SPEC §7.3 and §7.5:
  - **Score row:**
    - Final consensus score at 48px font size, centered, color-coded
    - Mean score (smaller, muted) with label "Mean"
    - Median score (smaller, muted) with label "Median"
    - This row communicates that consensus adds interpretation beyond arithmetic
  - **Agreement visualization:**
    - Three small colored dots (one per judge, color-coded by their overall score)
    - Lines converging to a central larger dot (the consensus score)
    - `agreement_level` badge: "Strong Agreement" (green), "Moderate Agreement" (yellow), "Weak
      Agreement" (red)
    - Spread value displayed
  - **Disagreement analysis:** Always visible text from `agreement.disagreement_analysis`
  - **Consolidated criteria:** 3 rows with reconciled per-criterion scores and evidence
  - **Improvements list:** Deduplicated improvement suggestions
  - **Rationale:** Consensus rationale text

**Acceptance criteria:**

- Final score renders at 48px with correct score color
- Mean and median scores are visible alongside the final score
- Agreement visualization shows judge score dots converging to consensus
- Agreement level badge has correct color: strong=green, moderate=yellow, weak=red
- Disagreement analysis text is always visible (not collapsed)
- Criteria rows show reconciled scores with evidence
- Improvements list is rendered as a bulleted list
- Panel is full-width (spans all 3 column widths of the judge cards grid)

**Code quality:**

- Agreement visualization uses CSS/SVG — no heavy charting library for 3 dots and lines
- Score color mapping is shared with JudgeCard (same utility function)
- The panel only renders when `consensus` prop is defined

---

### 5.6 — DownloadRunButton Component

**Description:** Button that exports the full `GradingState` as a downloadable JSON file.

**Changes:**

Create `client/src/components/DownloadRunButton.tsx`:

- Props: `state: GradingState`
- On click: creates a JSON blob from the full state, triggers a browser download
- Filename: `grading-run-<timestamp>.json` (ISO timestamp, sanitized for filenames)
- Only visible when `phase === "done"`

**Acceptance criteria:**

- Clicking the button downloads a `.json` file
- The file contains the full `GradingState` including all judge results and consensus
- The JSON is formatted with 2-space indentation (human-readable)
- The filename includes a timestamp
- The button is not visible during grading (only after completion)

**Code quality:**

- Uses `URL.createObjectURL` + `<a>` click pattern for downloads (no external library)
- Blob is revoked after download to prevent memory leaks

---

### 5.7 — Assemble GradingView and Wire State

**Description:** Compose all components into the main `GradingView` container, wired to
`useCoAgent<GradingState>`.

**Changes:**

Update `client/src/components/GradingView.tsx`:

- Use `useCoAgent<GradingState>({ name: "gradeDocument", initialState: INITIAL_GRADING_STATE })`
- Use `useCoAgentStateRender({ name: "gradeDocument", render: ... })` for in-progress rendering
- Conditional rendering based on `state.phase`:
  - `"idle"`: Show `<DocumentInput onSubmit={handleStartGrading} />`
  - Any other phase: Show `<GradingTimeline>`, `<JudgeCards>`, and conditionally
    `<ConsensusPanel>` + `<DownloadRunButton>`
- `handleStartGrading` calls `run({ proposal })` with the proposal object (id, title, actionItems)
- Add a "Grade Another Proposal" button when `phase === "done"` that resets state to idle
- Layout: main content area (left) with space for chat sidebar (right) — sidebar wired in Phase 7

Update `client/src/App.tsx`:

- Render `<GradingView />` inside the `<CopilotKit>` provider

**Acceptance criteria:**

- Full grading flow works end-to-end: input → timeline updates → judge cards populate → consensus
  appears
- State transitions are smooth — no flash of wrong state
- "Grade Another Document" resets to the input screen
- The layout has space reserved for the chat sidebar (even though it's not wired yet)
- `useCoAgentStateRender` fires during in-progress states and renders the timeline

**Code quality:**

- State is managed entirely by `useCoAgent` — no redundant `useState` for grading state
- Component composition is clean: GradingView orchestrates, child components are presentational
- No prop drilling more than 2 levels — if needed, refactor to context or pass individual fields

---

### 5.8 — Score Color Utility

**Description:** Create a shared utility for score-to-color mapping used across all components.

**Changes:**

Create `client/src/utils/score-colors.ts`:

- Export `getScoreColor(score: number): string` returning the hex color
- Export `getScoreLabel(score: number): string` returning the text label
- Color mapping per SPEC §7.5:
  - 1 → `#DC2626` ("Poor")
  - 2 → `#F97316` ("Below Average")
  - 3 → `#EAB308` ("Adequate")
  - 4 → `#22C55E` ("Good")
  - 5 → `#16A34A` ("Excellent")

**Acceptance criteria:**

- All score displays across the app use this utility (timeline, judge cards, consensus panel)
- Colors match SPEC §7.5 exactly
- Scores outside 1-5 fall back to a neutral color (gray)

**Code quality:**

- Single source of truth for score colors — no color values duplicated in CSS or components
- TypeScript input validation: accepts `number`, handles edge cases
