import { describe, it, expect } from "vitest";
import {
  EvidenceQuote,
  CriterionScore,
  JudgeOutput,
  ConsensusOutput,
} from "../schemas";

describe("EvidenceQuote schema", () => {
  it("parses valid evidence quote", () => {
    const validData = {
      quote: "This is a direct quote from the document demonstrating clarity",
      supports: "Clarity",
      valence: "positive",
    };
    const result = EvidenceQuote.parse(validData);
    expect(result).toEqual(validData);
  });

  it("rejects missing quote field", () => {
    expect(() =>
      EvidenceQuote.parse({
        supports: "Clarity",
        valence: "positive",
      })
    ).toThrow();
  });

  it("rejects invalid support criterion", () => {
    expect(() =>
      EvidenceQuote.parse({
        quote: "Some quote",
        supports: "InvalidCriterion",
        valence: "positive",
      })
    ).toThrow();
  });

  it("rejects invalid valence", () => {
    expect(() =>
      EvidenceQuote.parse({
        quote: "Some quote",
        supports: "Clarity",
        valence: "neutral",
      })
    ).toThrow();
  });

  it("accepts all three support types", () => {
    const criteria = ["Clarity", "Reasoning", "Completeness"] as const;
    criteria.forEach((criterion) => {
      const result = EvidenceQuote.parse({
        quote: "Test quote",
        supports: criterion,
        valence: "positive",
      });
      expect(result.supports).toBe(criterion);
    });
  });

  it("accepts both valence types", () => {
    const valences = ["positive", "negative"] as const;
    valences.forEach((valence) => {
      const result = EvidenceQuote.parse({
        quote: "Test quote",
        supports: "Clarity",
        valence: valence,
      });
      expect(result.valence).toBe(valence);
    });
  });
});

describe("CriterionScore schema", () => {
  it("parses valid criterion score", () => {
    const validData = {
      name: "Clarity",
      score: 4,
      notes: "The document is generally clear. However, the third section uses ambiguous terminology.",
      evidence_quotes: [
        "The introduction clearly states the main argument",
        "Section 3 uses undefined jargon",
      ],
    };
    const result = CriterionScore.parse(validData);
    expect(result).toEqual(validData);
  });

  it("rejects score outside 1-5 range", () => {
    expect(() =>
      CriterionScore.parse({
        name: "Clarity",
        score: 6,
        notes: "Some notes",
        evidence_quotes: ["quote1"],
      })
    ).toThrow();

    expect(() =>
      CriterionScore.parse({
        name: "Clarity",
        score: 0,
        notes: "Some notes",
        evidence_quotes: ["quote1"],
      })
    ).toThrow();
  });

  it("rejects non-integer score", () => {
    expect(() =>
      CriterionScore.parse({
        name: "Clarity",
        score: 3.5,
        notes: "Some notes",
        evidence_quotes: ["quote1"],
      })
    ).toThrow();
  });

  it("rejects empty evidence_quotes array", () => {
    expect(() =>
      CriterionScore.parse({
        name: "Clarity",
        score: 3,
        notes: "Some notes",
        evidence_quotes: [],
      })
    ).toThrow();
  });

  it("rejects more than 3 evidence quotes", () => {
    expect(() =>
      CriterionScore.parse({
        name: "Clarity",
        score: 3,
        notes: "Some notes",
        evidence_quotes: ["q1", "q2", "q3", "q4"],
      })
    ).toThrow();
  });

  it("accepts all three criteria names", () => {
    const names = ["Clarity", "Reasoning", "Completeness"] as const;
    names.forEach((name) => {
      const result = CriterionScore.parse({
        name,
        score: 3,
        notes: "Notes",
        evidence_quotes: ["quote"],
      });
      expect(result.name).toBe(name);
    });
  });

  it("accepts 1-3 evidence quotes", () => {
    for (let count = 1; count <= 3; count++) {
      const quotes = Array(count).fill("quote");
      const result = CriterionScore.parse({
        name: "Clarity",
        score: 3,
        notes: "Notes",
        evidence_quotes: quotes,
      });
      expect(result.evidence_quotes).toHaveLength(count);
    }
  });
});

describe("JudgeOutput schema", () => {
  const validJudgeOutput = {
    overall_score: 4,
    confidence: 0.85,
    rationale:
      "The document presents a clear and well-structured argument with strong evidence. The logical flow is excellent and the examples are relevant.",
    criteria: [
      {
        name: "Clarity" as const,
        score: 4,
        notes: "Clear and well-organized presentation.",
        evidence_quotes: ["The introduction states the thesis clearly"],
      },
      {
        name: "Reasoning" as const,
        score: 4,
        notes: "Strong logical chain with good support.",
        evidence_quotes: ["Evidence is provided for each claim"],
      },
      {
        name: "Completeness" as const,
        score: 3,
        notes: "Covers main points but misses some edge cases.",
        evidence_quotes: ["Most aspects are addressed"],
      },
    ],
    key_evidence: [
      {
        quote: "Strong opening statement",
        supports: "Clarity" as const,
        valence: "positive" as const,
      },
      {
        quote: "Well-supported conclusion",
        supports: "Reasoning" as const,
        valence: "positive" as const,
      },
    ],
    strengths: ["Clear writing", "Logical structure"],
    improvements: ["Add more examples", "Expand on methodology"],
  };

  it("parses valid judge output", () => {
    const result = JudgeOutput.parse(validJudgeOutput);
    expect(result).toEqual(validJudgeOutput);
  });

  it("rejects overall_score outside 1-5", () => {
    expect(() =>
      JudgeOutput.parse({
        ...validJudgeOutput,
        overall_score: 6,
      })
    ).toThrow();
  });

  it("rejects confidence outside 0-1", () => {
    expect(() =>
      JudgeOutput.parse({
        ...validJudgeOutput,
        confidence: 1.5,
      })
    ).toThrow();

    expect(() =>
      JudgeOutput.parse({
        ...validJudgeOutput,
        confidence: -0.1,
      })
    ).toThrow();
  });

  it("rejects wrong number of criteria", () => {
    expect(() =>
      JudgeOutput.parse({
        ...validJudgeOutput,
        criteria: [validJudgeOutput.criteria[0], validJudgeOutput.criteria[1]],
      })
    ).toThrow();

    expect(() =>
      JudgeOutput.parse({
        ...validJudgeOutput,
        criteria: [
          ...validJudgeOutput.criteria,
          validJudgeOutput.criteria[0],
        ],
      })
    ).toThrow();
  });

  it("rejects less than 2 key_evidence", () => {
    expect(() =>
      JudgeOutput.parse({
        ...validJudgeOutput,
        key_evidence: [validJudgeOutput.key_evidence[0]],
      })
    ).toThrow();
  });

  it("rejects more than 6 key_evidence", () => {
    const evidence = Array(7).fill(validJudgeOutput.key_evidence[0]);
    expect(() =>
      JudgeOutput.parse({
        ...validJudgeOutput,
        key_evidence: evidence,
      })
    ).toThrow();
  });

  it("rejects empty strengths array", () => {
    expect(() =>
      JudgeOutput.parse({
        ...validJudgeOutput,
        strengths: [],
      })
    ).toThrow();
  });

  it("rejects more than 3 strengths", () => {
    expect(() =>
      JudgeOutput.parse({
        ...validJudgeOutput,
        strengths: ["s1", "s2", "s3", "s4"],
      })
    ).toThrow();
  });

  it("rejects empty improvements array", () => {
    expect(() =>
      JudgeOutput.parse({
        ...validJudgeOutput,
        improvements: [],
      })
    ).toThrow();
  });

  it("rejects more than 3 improvements", () => {
    expect(() =>
      JudgeOutput.parse({
        ...validJudgeOutput,
        improvements: ["i1", "i2", "i3", "i4"],
      })
    ).toThrow();
  });

  it("rejects missing required fields", () => {
    const fields = [
      "overall_score",
      "confidence",
      "rationale",
      "criteria",
      "key_evidence",
      "strengths",
      "improvements",
    ];

    fields.forEach((field) => {
      const incomplete = { ...validJudgeOutput };
      delete incomplete[field as keyof typeof validJudgeOutput];
      expect(() => JudgeOutput.parse(incomplete)).toThrow();
    });
  });

  it("accepts confidence values 0, 0.5, 1.0", () => {
    const confidences = [0, 0.3, 0.6, 0.9, 1];
    confidences.forEach((conf) => {
      const result = JudgeOutput.parse({
        ...validJudgeOutput,
        confidence: conf,
      });
      expect(result.confidence).toBe(conf);
    });
  });

  it("accepts 2-6 key_evidence", () => {
    for (let count = 2; count <= 6; count++) {
      const evidence = Array(count).fill(validJudgeOutput.key_evidence[0]);
      const result = JudgeOutput.parse({
        ...validJudgeOutput,
        key_evidence: evidence,
      });
      expect(result.key_evidence).toHaveLength(count);
    }
  });
});

describe("ConsensusOutput schema", () => {
  const validConsensusOutput = {
    final_score: 4,
    rationale:
      "The judges converge on a score of 4 based on strong clarity and reasoning, with minor gaps in completeness.",
    agreement: {
      scores: {
        rater_a: 4,
        rater_b: 4,
        rater_c: 3,
      },
      mean_score: 3.7,
      median_score: 4,
      spread: 1,
      agreement_level: "moderate" as const,
      disagreement_analysis:
        "Rater C (The Practitioner) scored one point lower due to concern about missing actionable guidance.",
    },
    criteria: [
      {
        name: "Clarity" as const,
        score: 4,
        notes: "Strong consensus on clarity.",
        evidence_quotes: ["Clear structure"],
      },
      {
        name: "Reasoning" as const,
        score: 4,
        notes: "Well-reasoned argument.",
        evidence_quotes: ["Good evidence"],
      },
      {
        name: "Completeness" as const,
        score: 3,
        notes: "Adequate coverage with minor gaps.",
        evidence_quotes: ["Most areas covered"],
      },
    ],
    improvements: [
      "Add more practical examples",
      "Clarify methodology",
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
    levels.forEach((level) => {
      const result = ConsensusOutput.parse({
        ...validConsensusOutput,
        agreement: {
          ...validConsensusOutput.agreement,
          agreement_level: level,
        },
      });
      expect(result.agreement.agreement_level).toBe(level);
    });
  });

  it("rejects wrong number of criteria", () => {
    expect(() =>
      ConsensusOutput.parse({
        ...validConsensusOutput,
        criteria: [validConsensusOutput.criteria[0]],
      })
    ).toThrow();
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
    const fields = [
      "final_score",
      "rationale",
      "agreement",
      "criteria",
      "improvements",
    ];

    fields.forEach((field) => {
      const incomplete = { ...validConsensusOutput };
      delete incomplete[field as keyof typeof validConsensusOutput];
      expect(() => ConsensusOutput.parse(incomplete)).toThrow();
    });
  });
});
