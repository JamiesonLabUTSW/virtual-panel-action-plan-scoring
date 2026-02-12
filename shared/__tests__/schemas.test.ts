import { describe, expect, it } from "vitest";
import { ActionItemReview, ConsensusOutput, JudgeOutput } from "../schemas";

describe("ActionItemReview schema", () => {
  const validReview = {
    action_item_id: 1,
    comment: "Clear timeline and measurable targets. Consider adding interim milestones.",
    score: 4,
  };

  it("parses valid action item review", () => {
    const result = ActionItemReview.parse(validReview);
    expect(result).toEqual(validReview);
  });

  it("rejects missing action_item_id", () => {
    expect(() =>
      ActionItemReview.parse({
        comment: "Good item.",
        score: 4,
      })
    ).toThrow();
  });

  it("rejects non-integer action_item_id", () => {
    expect(() =>
      ActionItemReview.parse({
        ...validReview,
        action_item_id: 1.5,
      })
    ).toThrow();
  });

  it("rejects missing comment", () => {
    expect(() =>
      ActionItemReview.parse({
        action_item_id: 1,
        score: 4,
      })
    ).toThrow();
  });

  it("rejects score outside 1-5 range", () => {
    expect(() =>
      ActionItemReview.parse({
        ...validReview,
        score: 6,
      })
    ).toThrow();

    expect(() =>
      ActionItemReview.parse({
        ...validReview,
        score: 0,
      })
    ).toThrow();
  });

  it("rejects non-integer score", () => {
    expect(() =>
      ActionItemReview.parse({
        ...validReview,
        score: 3.5,
      })
    ).toThrow();
  });

  it("accepts scores 1 through 5", () => {
    for (let score = 1; score <= 5; score++) {
      const result = ActionItemReview.parse({ ...validReview, score });
      expect(result.score).toBe(score);
    }
  });
});

describe("JudgeOutput schema", () => {
  const validJudgeOutput = {
    proposal_id: 42,
    evaluator_id: 1,
    evaluator_name: "The Professor",
    items: [
      {
        action_item_id: 1,
        comment: "Strong framework with clear quantitative targets and phased implementation.",
        score: 5,
      },
      {
        action_item_id: 2,
        comment: "Faculty development plan is solid but lacks detail on compliance tracking.",
        score: 4,
      },
      {
        action_item_id: 3,
        comment: "Pilot design is reasonable. Consider adding control group metrics.",
        score: 4,
      },
    ],
    overall_score: 4,
  };

  it("parses valid judge output", () => {
    const result = JudgeOutput.parse(validJudgeOutput);
    expect(result).toEqual(validJudgeOutput);
  });

  it("rejects missing proposal_id", () => {
    const { proposal_id: _, ...rest } = validJudgeOutput;
    expect(() => JudgeOutput.parse(rest)).toThrow();
  });

  it("rejects missing evaluator_id", () => {
    const { evaluator_id: _, ...rest } = validJudgeOutput;
    expect(() => JudgeOutput.parse(rest)).toThrow();
  });

  it("rejects missing evaluator_name", () => {
    const { evaluator_name: _, ...rest } = validJudgeOutput;
    expect(() => JudgeOutput.parse(rest)).toThrow();
  });

  it("rejects empty items array", () => {
    expect(() =>
      JudgeOutput.parse({
        ...validJudgeOutput,
        items: [],
      })
    ).toThrow();
  });

  it("rejects overall_score outside 1-5", () => {
    expect(() =>
      JudgeOutput.parse({
        ...validJudgeOutput,
        overall_score: 6,
      })
    ).toThrow();

    expect(() =>
      JudgeOutput.parse({
        ...validJudgeOutput,
        overall_score: 0,
      })
    ).toThrow();
  });

  it("rejects non-integer overall_score", () => {
    expect(() =>
      JudgeOutput.parse({
        ...validJudgeOutput,
        overall_score: 3.5,
      })
    ).toThrow();
  });

  it("rejects non-integer proposal_id", () => {
    expect(() =>
      JudgeOutput.parse({
        ...validJudgeOutput,
        proposal_id: 1.5,
      })
    ).toThrow();
  });

  it("accepts single item", () => {
    const result = JudgeOutput.parse({
      ...validJudgeOutput,
      items: [validJudgeOutput.items[0]],
    });
    expect(result.items).toHaveLength(1);
  });

  it("accepts overall_score values 1 through 5", () => {
    for (let score = 1; score <= 5; score++) {
      const result = JudgeOutput.parse({
        ...validJudgeOutput,
        overall_score: score,
      });
      expect(result.overall_score).toBe(score);
    }
  });

  it("rejects missing required fields", () => {
    const fields = ["proposal_id", "evaluator_id", "evaluator_name", "items", "overall_score"];

    for (const field of fields) {
      const incomplete = { ...validJudgeOutput };
      delete incomplete[field as keyof typeof validJudgeOutput];
      expect(() => JudgeOutput.parse(incomplete)).toThrow();
    }
  });
});

describe("ConsensusOutput schema", () => {
  const validConsensusOutput = {
    final_score: 4,
    rationale:
      "The judges converge on a score of 4 based on strong action items with clear targets, with minor gaps in faculty compliance tracking.",
    agreement: {
      scores: {
        rater_a: 4,
        rater_b: 4,
        rater_c: 3,
      },
      mean_score: 3.7,
      median_score: 4,
      spread: 1,
      agreement_level: "strong" as const,
      disagreement_analysis:
        "Rater C scored one point lower due to concern about missing interim milestone data.",
    },
    improvements: [
      "Add interim milestone checkpoints at 6-month intervals",
      "Clarify faculty compliance tracking mechanisms",
    ],
  };

  it("parses valid consensus output", () => {
    const result = ConsensusOutput.parse(validConsensusOutput);
    expect(result).toEqual(validConsensusOutput);
  });

  it("rejects final_score outside 1-5", () => {
    expect(() =>
      ConsensusOutput.parse({
        ...validConsensusOutput,
        final_score: 6,
      })
    ).toThrow();
  });

  it("accepts null scores for missing judges", () => {
    const result = ConsensusOutput.parse({
      ...validConsensusOutput,
      agreement: {
        ...validConsensusOutput.agreement,
        scores: {
          rater_a: 4,
          rater_b: null,
          rater_c: 3,
        },
      },
    });
    expect(result.agreement.scores.rater_b).toBeNull();
  });

  it("rejects score of 0 (sentinel value)", () => {
    expect(() =>
      ConsensusOutput.parse({
        ...validConsensusOutput,
        agreement: {
          ...validConsensusOutput.agreement,
          scores: {
            rater_a: 0,
            rater_b: 4,
            rater_c: 3,
          },
        },
      })
    ).toThrow();
  });

  it("rejects agreement scores outside 1-5", () => {
    expect(() =>
      ConsensusOutput.parse({
        ...validConsensusOutput,
        agreement: {
          ...validConsensusOutput.agreement,
          scores: {
            rater_a: 6,
            rater_b: 4,
            rater_c: 3,
          },
        },
      })
    ).toThrow();
  });

  it("rejects spread outside 0-4", () => {
    expect(() =>
      ConsensusOutput.parse({
        ...validConsensusOutput,
        agreement: {
          ...validConsensusOutput.agreement,
          spread: 5,
        },
      })
    ).toThrow();
  });

  it("rejects invalid agreement_level", () => {
    expect(() =>
      ConsensusOutput.parse({
        ...validConsensusOutput,
        agreement: {
          ...validConsensusOutput.agreement,
          agreement_level: "invalid" as any,
        },
      })
    ).toThrow();
  });

  it("accepts all agreement_level values", () => {
    const levels = ["strong", "moderate", "weak"] as const;
    for (const level of levels) {
      const result = ConsensusOutput.parse({
        ...validConsensusOutput,
        agreement: {
          ...validConsensusOutput.agreement,
          agreement_level: level,
        },
      });
      expect(result.agreement.agreement_level).toBe(level);
    }
  });

  it("rejects empty improvements", () => {
    expect(() =>
      ConsensusOutput.parse({
        ...validConsensusOutput,
        improvements: [],
      })
    ).toThrow();
  });

  it("rejects more than 5 improvements", () => {
    expect(() =>
      ConsensusOutput.parse({
        ...validConsensusOutput,
        improvements: ["i1", "i2", "i3", "i4", "i5", "i6"],
      })
    ).toThrow();
  });

  it("accepts 1-5 improvements", () => {
    for (let count = 1; count <= 5; count++) {
      const improvements = Array(count).fill("improvement");
      const result = ConsensusOutput.parse({
        ...validConsensusOutput,
        improvements,
      });
      expect(result.improvements).toHaveLength(count);
    }
  });

  it("rejects missing required fields", () => {
    const fields = ["final_score", "rationale", "agreement", "improvements"];

    for (const field of fields) {
      const incomplete = { ...validConsensusOutput };
      delete incomplete[field as keyof typeof validConsensusOutput];
      expect(() => ConsensusOutput.parse(incomplete)).toThrow();
    }
  });
});
