import type { JudgeOutputType } from "@shared/schemas";
import type { GradingState } from "@shared/types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock dependencies
const mockRunJudge = vi.fn();
const mockRunConsensus = vi.fn();

vi.mock("../judge-chain", () => ({
  runJudge: mockRunJudge,
}));

vi.mock("../consensus-chain", () => ({
  runConsensus: mockRunConsensus,
}));

vi.mock("../few-shot-sets", () => ({
  RATER_A_EXAMPLES: "mock-rater-a-examples",
  RATER_B_EXAMPLES: "mock-rater-b-examples",
  RATER_C_EXAMPLES: "mock-rater-c-examples",
}));

const { runGradingPipeline } = (await import("../orchestrator")) as any;

// Helpers
function createMockJudgeOutput(
  evaluatorId: number,
  evaluatorName: string,
  overallScore: number
): JudgeOutputType {
  return {
    proposal_id: 1,
    evaluator_id: evaluatorId,
    evaluator_name: evaluatorName,
    items: [{ action_item_id: 1, comment: "Test feedback", score: overallScore }],
    overall_score: overallScore,
  };
}

function createMockJudgeResult(evaluatorId: number, evaluatorName: string, overallScore: number) {
  return {
    result: createMockJudgeOutput(evaluatorId, evaluatorName, overallScore),
    tier: 1 as const,
    usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
  };
}

function createMockConsensusResult(finalScore: number) {
  return {
    result: {
      final_score: finalScore,
      rationale: "Test consensus rationale",
      agreement: {
        scores: { rater_a: 4, rater_b: 4, rater_c: 3 },
        mean_score: 3.7,
        median_score: 4,
        spread: 1,
        agreement_level: "strong" as const,
        disagreement_analysis: "Minor disagreement",
      },
      improvements: ["Improvement 1"],
    },
    tier: 1 as const,
    usage: { promptTokens: 200, completionTokens: 100, totalTokens: 300 },
  };
}

describe("runGradingPipeline", () => {
  // biome-ignore lint/suspicious/noExplicitAny: Mock callback type doesn't match vi.fn() return
  let emitState: any;
  let emittedStates: Partial<GradingState>[];

  beforeEach(() => {
    emittedStates = [];
    emitState = vi.fn((state: Partial<GradingState>) => {
      emittedStates.push(state);
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("happy path: 3 judges succeed → consensus → done", async () => {
    mockRunJudge
      .mockResolvedValueOnce(createMockJudgeResult(1, "Rater A", 4))
      .mockResolvedValueOnce(createMockJudgeResult(2, "Rater B", 5))
      .mockResolvedValueOnce(createMockJudgeResult(3, "Rater C", 4));
    mockRunConsensus.mockResolvedValueOnce(createMockConsensusResult(4));

    const result = await runGradingPipeline({
      proposalId: 1,
      proposalTitle: "Test Proposal",
      actionItems: ["Item 1", "Item 2"],
      emitState,
    });

    // Verify judges were called
    expect(mockRunJudge).toHaveBeenCalledTimes(3);
    expect(mockRunConsensus).toHaveBeenCalledTimes(1);

    // Verify phase progression in emitted states
    const phases = emittedStates.map((s) => s.phase).filter(Boolean);
    expect(phases).toContain("evaluating");
    expect(phases).toContain("consensus");
    expect(phases).toContain("done");

    // Verify final result
    expect(result.phase).toBe("done");
    expect(result.consensus).toBeDefined();
    expect(result.consensus.final_score).toBe(4);
  });

  it("1 judge fails: pipeline continues with 2 judges", async () => {
    mockRunJudge
      .mockResolvedValueOnce(createMockJudgeResult(1, "Rater A", 4))
      .mockRejectedValueOnce(new Error("Judge B failed"))
      .mockResolvedValueOnce(createMockJudgeResult(3, "Rater C", 3));
    mockRunConsensus.mockResolvedValueOnce(createMockConsensusResult(4));

    const result = await runGradingPipeline({
      proposalId: 1,
      actionItems: ["Item 1"],
      emitState,
    });

    expect(result.phase).toBe("done");
    expect(mockRunConsensus).toHaveBeenCalledTimes(1);

    // The consensus input should have missingJudgeCount = 1
    const consensusCall = mockRunConsensus.mock.calls[0][0];
    expect(consensusCall.missingJudgeCount).toBe(1);

    // emitState should show an error for the failed judge
    const judgeStates = emittedStates.filter((s) => s.judges).map((s) => s.judges);
    const lastJudgeState = judgeStates[judgeStates.length - 1];
    expect(lastJudgeState?.rater_b?.status).toBe("error");
  });

  it("2 judges fail: pipeline throws error", async () => {
    mockRunJudge
      .mockRejectedValueOnce(new Error("Judge A failed"))
      .mockRejectedValueOnce(new Error("Judge B failed"))
      .mockResolvedValueOnce(createMockJudgeResult(3, "Rater C", 3));

    await expect(
      runGradingPipeline({
        proposalId: 1,
        actionItems: ["Item 1"],
        emitState,
      })
    ).rejects.toThrow("Fewer than 2 judges succeeded");

    // Verify consensus was never called
    expect(mockRunConsensus).not.toHaveBeenCalled();

    // Verify error phase was emitted
    const phases = emittedStates.map((s) => s.phase).filter(Boolean);
    expect(phases).toContain("error");
  });

  it("truncates action items to max 20", async () => {
    const manyItems = Array.from({ length: 25 }, (_, i) => `Item ${i + 1}`);

    mockRunJudge
      .mockResolvedValueOnce(createMockJudgeResult(1, "Rater A", 4))
      .mockResolvedValueOnce(createMockJudgeResult(2, "Rater B", 4))
      .mockResolvedValueOnce(createMockJudgeResult(3, "Rater C", 4));
    mockRunConsensus.mockResolvedValueOnce(createMockConsensusResult(4));

    const result = await runGradingPipeline({
      proposalId: 1,
      actionItems: manyItems,
      emitState,
    });

    // Verify wasTruncated flag
    expect(result.wasTruncated).toBe(true);
    expect(result.proposal?.actionItems).toHaveLength(20);

    // Verify first emitted state has wasTruncated
    const firstEmit = emittedStates[0];
    expect(firstEmit.wasTruncated).toBe(true);
  });

  it("throws on empty action items", async () => {
    await expect(
      runGradingPipeline({
        proposalId: 1,
        actionItems: [],
        emitState,
      })
    ).rejects.toThrow("No action items provided");

    // Verify error phase was emitted
    const phases = emittedStates.map((s) => s.phase).filter(Boolean);
    expect(phases).toContain("error");
  });
});
