import type { ConsensusOutputType, JudgeOutputType } from "@shared/schemas";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Tests for consensus arbiter chain (Issue #34)
 */

const mockInvokeWithStructuredOutput = vi.fn();

vi.mock("../structured-output", () => ({
  invokeWithStructuredOutput: mockInvokeWithStructuredOutput,
}));

// biome-ignore lint/suspicious/noExplicitAny: Dynamic import needed for mocks
const { computeAgreementStats, runConsensus } = (await import("../consensus-chain")) as any;

describe("computeAgreementStats", () => {
  it("should compute stats for perfect agreement [5, 5, 5]", () => {
    const stats = computeAgreementStats([5, 5, 5]);

    expect(stats.mean_score).toBe(5.0);
    expect(stats.median_score).toBe(5);
    expect(stats.spread).toBe(0);
    expect(stats.agreement_level).toBe("strong");
  });

  it("should compute stats for moderate disagreement [3, 4, 5]", () => {
    const stats = computeAgreementStats([3, 4, 5]);

    expect(stats.mean_score).toBe(4.0);
    expect(stats.median_score).toBe(4);
    expect(stats.spread).toBe(2);
    expect(stats.agreement_level).toBe("moderate");
  });

  it("should compute stats for weak agreement [2, 3, 5]", () => {
    const stats = computeAgreementStats([2, 3, 5]);

    expect(stats.mean_score).toBe(3.3);
    expect(stats.median_score).toBe(3);
    expect(stats.spread).toBe(3);
    expect(stats.agreement_level).toBe("weak");
  });

  it("should compute stats for 2-judge consensus [2, 3]", () => {
    const stats = computeAgreementStats([2, 3]);

    expect(stats.mean_score).toBe(2.5);
    expect(stats.median_score).toBe(3); // Round average of [2, 3] = 2.5 → 3
    expect(stats.spread).toBe(1);
    expect(stats.agreement_level).toBe("strong");
  });

  it("should compute stats for 2-judge weak agreement [5, 1]", () => {
    const stats = computeAgreementStats([5, 1]);

    expect(stats.mean_score).toBe(3.0);
    expect(stats.median_score).toBe(3); // Round average of [1, 5] = 3.0
    expect(stats.spread).toBe(4);
    expect(stats.agreement_level).toBe("weak");
  });

  it("should throw if fewer than 2 scores provided", () => {
    expect(() => computeAgreementStats([5])).toThrow("Cannot compute stats with 1 score(s)");
    expect(() => computeAgreementStats([])).toThrow("Cannot compute stats with 0 score(s)");
  });
});

describe("runConsensus", () => {
  beforeEach(() => {
    mockInvokeWithStructuredOutput.mockClear();
  });

  function createMockJudge(
    evaluatorId: number,
    evaluatorName: string,
    overallScore: number
  ): JudgeOutputType {
    return {
      proposal_id: 1,
      evaluator_id: evaluatorId,
      evaluator_name: evaluatorName,
      items: [
        {
          action_item_id: 1,
          comment: "Test feedback",
          score: overallScore,
        },
      ],
      overall_score: overallScore,
    };
  }

  function createMockConsensusOutput(finalScore: number): ConsensusOutputType {
    return {
      final_score: finalScore,
      rationale: "Test rationale synthesizing judge feedback",
      agreement: {
        scores: {
          rater_a: 4,
          rater_b: 5,
          rater_c: 5,
        },
        mean_score: 4.7,
        median_score: 5,
        spread: 1,
        agreement_level: "strong",
        disagreement_analysis: "Minor disagreement on structural details",
      },
      improvements: ["Improvement 1", "Improvement 2"],
    };
  }

  it("should throw if fewer than 2 judges provided", async () => {
    const input = {
      judgeResults: {
        rater_a: createMockJudge(1, "Rater A", 4),
      },
      missingJudgeCount: 2,
    };

    await expect(runConsensus(input)).rejects.toThrow(
      "Cannot run consensus with fewer than 2 judges"
    );
  });

  it("should succeed with 2 judges", async () => {
    mockInvokeWithStructuredOutput.mockResolvedValueOnce({
      result: createMockConsensusOutput(4),
      tier: 1,
      usage: { promptTokens: 500, completionTokens: 200, totalTokens: 700 },
    });

    const input = {
      judgeResults: {
        rater_a: createMockJudge(1, "Rater A", 4),
        rater_b: createMockJudge(2, "Rater B", 5),
      },
      missingJudgeCount: 1,
    };

    const result = await runConsensus(input);

    expect(result.tier).toBe(1);
    expect(result.result.final_score).toBe(4);
    expect(result.usage.totalTokens).toBe(700);

    // Verify stats were overridden
    expect(result.result.agreement.mean_score).toBe(4.5);
    expect(result.result.agreement.median_score).toBe(5);
    expect(result.result.agreement.spread).toBe(1);
    expect(result.result.agreement.agreement_level).toBe("strong");
  });

  it("should succeed with 3 judges", async () => {
    mockInvokeWithStructuredOutput.mockResolvedValueOnce({
      result: createMockConsensusOutput(4),
      tier: 1,
      usage: { promptTokens: 600, completionTokens: 250, totalTokens: 850 },
    });

    const input = {
      judgeResults: {
        rater_a: createMockJudge(1, "Rater A", 3),
        rater_b: createMockJudge(2, "Rater B", 4),
        rater_c: createMockJudge(3, "Rater C", 5),
      },
      missingJudgeCount: 0,
    };

    const result = await runConsensus(input);

    expect(result.tier).toBe(1);

    // Verify stats were overridden with computed values
    expect(result.result.agreement.mean_score).toBe(4.0);
    expect(result.result.agreement.median_score).toBe(4);
    expect(result.result.agreement.spread).toBe(2);
    expect(result.result.agreement.agreement_level).toBe("moderate");
  });

  it("should format system prompt with arbiter rules", async () => {
    mockInvokeWithStructuredOutput.mockResolvedValueOnce({
      result: createMockConsensusOutput(4),
      tier: 1,
      usage: { promptTokens: 500, completionTokens: 200, totalTokens: 700 },
    });

    const input = {
      judgeResults: {
        rater_a: createMockJudge(1, "Rater A", 4),
        rater_b: createMockJudge(2, "Rater B", 5),
      },
      missingJudgeCount: 1,
    };

    await runConsensus(input);

    expect(mockInvokeWithStructuredOutput).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        system: expect.stringContaining("You are a consensus ARBITER"),
      })
    );

    // biome-ignore lint/suspicious/noExplicitAny: Test helper
    const call = mockInvokeWithStructuredOutput.mock.calls[0][1] as any;
    expect(call.system).toContain("ARBITER RULES");
    expect(call.system).toContain("RATER PERSONAS");
  });

  it("should throw if final_score violates constraint", async () => {
    const invalidOutput = createMockConsensusOutput(2); // Judges are [4, 5], min=4

    mockInvokeWithStructuredOutput.mockResolvedValueOnce({
      result: invalidOutput,
      tier: 1,
      usage: { promptTokens: 500, completionTokens: 200, totalTokens: 700 },
    });

    const input = {
      judgeResults: {
        rater_a: createMockJudge(1, "Rater A", 4),
        rater_b: createMockJudge(2, "Rater B", 5),
      },
      missingJudgeCount: 1,
    };

    await expect(runConsensus(input)).rejects.toThrow(
      "Consensus final_score 2 outside judge range [4, 5]"
    );
  });

  it("should accept final_score at min boundary", async () => {
    const validOutput = createMockConsensusOutput(3); // Judges are [3, 5], min=3

    mockInvokeWithStructuredOutput.mockResolvedValueOnce({
      result: validOutput,
      tier: 1,
      usage: { promptTokens: 500, completionTokens: 200, totalTokens: 700 },
    });

    const input = {
      judgeResults: {
        rater_a: createMockJudge(1, "Rater A", 3),
        rater_b: createMockJudge(2, "Rater B", 5),
      },
      missingJudgeCount: 1,
    };

    const result = await runConsensus(input);
    expect(result.result.final_score).toBe(3);
  });

  it("should accept final_score at max boundary", async () => {
    const validOutput = createMockConsensusOutput(5); // Judges are [3, 5], max=5

    mockInvokeWithStructuredOutput.mockResolvedValueOnce({
      result: validOutput,
      tier: 1,
      usage: { promptTokens: 500, completionTokens: 200, totalTokens: 700 },
    });

    const input = {
      judgeResults: {
        rater_a: createMockJudge(1, "Rater A", 3),
        rater_b: createMockJudge(2, "Rater B", 5),
      },
      missingJudgeCount: 1,
    };

    const result = await runConsensus(input);
    expect(result.result.final_score).toBe(5);
  });
});
