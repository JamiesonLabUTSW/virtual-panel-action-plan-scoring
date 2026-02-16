# Few-Shot Calibration Example

This document illustrates the format used to calibrate judges with rater-specific evaluation
patterns. Each judge receives 5 few-shot examples showing how their assigned rater (A, B, or C)
evaluates residency program action items.

## Example Structure

Each few-shot example consists of:

1. **User Message**: The action item(s) to evaluate (presented with stable IDs)
2. **Assistant Response**: A structured JSON evaluation matching the JudgeOutput schema

---

## Sample Few-Shot Example (Rater A - "The Professor")

### Action Items:

1. Over the past three academic years, multiple data sources have shown that our residents,
   particularly graduating chiefs, perceive suboptimal operative autonomy and have variable
   opportunities for progressive responsibility. The ACGME Resident Survey item on adequate
   operative experience/autonomy has declined from 72% positive in 2021-2022 to 66% in 2023-2024,
   now roughly 18 points below the national mean for general surgery (84%). Our internal annual
   survey shows a parallel trend: the proportion of PGY3-4 residents who agree they have appropriate
   graded responsibility in the OR dropped from 74% to 65% over three years, and for PGY5s the
   decline was steeper, from 70% to 58%.

### Evaluation:

```json
{
  "proposal_id": 101,
  "evaluator_id": 1,
  "evaluator_name": "Rater A",
  "items": [
    {
      "action_item_id": 1,
      "comment": "This is a very strong, well-constructed item with clear linkage from a rich background dataset (multi-year ACGME survey trends, internal surveys) to a focused problem in operative autonomy and progressive responsibility. The objective is specific, time-bound, and includes explicit quantitative targets. The measurement approach is thorough and demonstrates a mature evaluation plan.",
      "score": 5
    }
  ],
  "overall_score": 5
}
```

---

## Schema Field Annotations

The JudgeOutput schema requires these fields:

- **`proposal_id`** (integer): Matches the proposal ID from the current request (not from examples)
- **`evaluator_id`** (integer): Persona ID (1=Rater A, 2=Rater B, 3=Rater C)
- **`evaluator_name`** (string): Persona name ("Rater A", "Rater B", or "Rater C")
- **`items`** (array): One review per action item, containing:
  - **`action_item_id`** (integer): Stable ID matching the input action item
  - **`comment`** (string): Brief, constructive feedback (1-3 sentences)
  - **`score`** (integer 1-5): Item score using the rubric's 5-point scale
- **`overall_score`** (integer 1-5): Holistic assessment of the entire proposal

## Rater Tone Variations

Each rater has a distinct evaluation style reflected in their few-shot examples:

- **Rater A "The Professor"**: Strict on structure, quantitative targets, and metric specificity.
  Looks for robust data linkages and explicit numeric goals. Tends to give detailed, analytical
  feedback.

- **Rater B "The Editor"**: Generous on feasibility and clarity, focuses on achievability. More
  forgiving of minor gaps if the core plan is sound. Provides encouraging, constructive feedback.

- **Rater C "The Practitioner"**: Strict on actionability, data richness, and practical impact.
  Emphasizes operational details and real-world implementation concerns. Feedback is direct and
  practice-focused.

The judge chain uses these calibration examples to ensure each AI judge emulates the scoring
tendencies and comment style of their assigned human rater.
