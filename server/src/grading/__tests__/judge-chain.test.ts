import { JudgeOutput, type JudgeOutputType } from "@shared/schemas";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StructuredInvokeResult } from "../structured-output";

/**
 * Unit tests for judge chain (Issue #33)
 */

const mockInvokeWithStructuredOutput = vi.fn();

vi.mock("../structured-output", () => ({
  invokeWithStructuredOutput: mockInvokeWithStructuredOutput,
}));

vi.mock("../rubric", () => ({
  RUBRIC_TEXT: "MOCK_RUBRIC_TEXT\nScoring anchors: 1-5\nReturn log_review tool call.",
}));

// biome-ignore lint/suspicious/noExplicitAny: Dynamic import needed for mocks
const { runJudge } = (await import("../judge-chain")) as any;

describe("runJudge", () => {
  beforeEach(() => {
    mockInvokeWithStructuredOutput.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  function createMockJudgeResult(
    overrides?: Partial<JudgeOutputType>
  ): StructuredInvokeResult<JudgeOutputType> {
    return {
      result: {
        proposal_id: 1,
        evaluator_id: 1,
        evaluator_name: "Rater A",
        items: [
          {
            action_item_id: 1,
            comment: "Strong implementation plan with clear milestones.",
            score: 4,
          },
        ],
        overall_score: 4,
        ...overrides,
      },
      tier: 1 as const,
      usage: {
        promptTokens: 1500,
        completionTokens: 400,
        totalTokens: 1900,
      },
    };
  }

  it("should construct system prompt from RUBRIC_TEXT", async () => {
    mockInvokeWithStructuredOutput.mockResolvedValue(createMockJudgeResult());

    await runJudge({
      proposalId: 1,
      evaluatorId: 1,
      evaluatorName: "Rater A",
      actionItemsText: "1. Test item",
      fewShotExamples: "Example few-shot",
    });

    expect(mockInvokeWithStructuredOutput).toHaveBeenCalledTimes(1);
    const callArgs = mockInvokeWithStructuredOutput.mock.calls[0];
    // biome-ignore lint/suspicious/noExplicitAny: Test helper
    const options = callArgs[1] as any;

    expect(options.system).toContain("MOCK_RUBRIC_TEXT");
  });

  it("should construct user prompt with proposal details", async () => {
    mockInvokeWithStructuredOutput.mockResolvedValue(createMockJudgeResult());

    const fewShotExamples = "## Example 1\nUser: ...\nAssistant: {...}";
    const actionItemsText = "1. Implement framework\n\n2. Launch workshops";

    await runJudge({
      proposalId: 42,
      evaluatorId: 2,
      evaluatorName: "Rater B",
      actionItemsText,
      fewShotExamples,
    });

    expect(mockInvokeWithStructuredOutput).toHaveBeenCalledTimes(1);
    const callArgs = mockInvokeWithStructuredOutput.mock.calls[0];
    // biome-ignore lint/suspicious/noExplicitAny: Test helper
    const options = callArgs[1] as any;

    expect(options.user).toContain("## Calibration Examples");
    expect(options.user).toContain(fewShotExamples);
    expect(options.user).toContain("## Proposal to Evaluate");
    expect(options.user).toContain("Proposal ID: 42");
    expect(options.user).toContain("Evaluator ID: 2");
    expect(options.user).toContain("Evaluator Name: Rater B");
    expect(options.user).toContain("### Action Items");
    expect(options.user).toContain(actionItemsText);
  });

  it("should pass JudgeOutput schema", async () => {
    mockInvokeWithStructuredOutput.mockResolvedValue(createMockJudgeResult());

    await runJudge({
      proposalId: 1,
      evaluatorId: 1,
      evaluatorName: "Rater A",
      actionItemsText: "1. Test",
      fewShotExamples: "Examples",
    });

    const callArgs = mockInvokeWithStructuredOutput.mock.calls[0];
    // biome-ignore lint/suspicious/noExplicitAny: Test helper
    const schema = callArgs[0] as any;

    expect(schema).toBe(JudgeOutput);
  });

  it("should pass maxCompletionTokens=4000 and schemaName='log_review'", async () => {
    mockInvokeWithStructuredOutput.mockResolvedValue(createMockJudgeResult());

    await runJudge({
      proposalId: 1,
      evaluatorId: 1,
      evaluatorName: "Rater A",
      actionItemsText: "1. Test",
      fewShotExamples: "Examples",
    });

    const callArgs = mockInvokeWithStructuredOutput.mock.calls[0];
    // biome-ignore lint/suspicious/noExplicitAny: Test helper
    const options = callArgs[1] as any;

    expect(options.maxCompletionTokens).toBe(4000);
    expect(options.schemaName).toBe("log_review");
  });

  it("should return result with tier and usage", async () => {
    const mockResult = createMockJudgeResult({
      proposal_id: 99,
      evaluator_id: 3,
      overall_score: 5,
    });
    mockResult.tier = 2;
    mockResult.usage = {
      promptTokens: 2000,
      completionTokens: 800,
      totalTokens: 2800,
    };

    mockInvokeWithStructuredOutput.mockResolvedValue(mockResult);

    const result = await runJudge({
      proposalId: 99,
      evaluatorId: 3,
      evaluatorName: "Rater C",
      actionItemsText: "1. Test",
      fewShotExamples: "Examples",
    });

    expect(result.result.proposal_id).toBe(99);
    expect(result.result.evaluator_id).toBe(3);
    expect(result.result.overall_score).toBe(5);
    expect(result.tier).toBe(2);
    expect(result.usage.promptTokens).toBe(2000);
    expect(result.usage.completionTokens).toBe(800);
    expect(result.usage.totalTokens).toBe(2800);
  });

  it("should propagate errors from invokeWithStructuredOutput", async () => {
    const mockError = new Error("All 3 tiers failed");
    mockInvokeWithStructuredOutput.mockRejectedValue(mockError);

    await expect(
      runJudge({
        proposalId: 1,
        evaluatorId: 1,
        evaluatorName: "Rater A",
        actionItemsText: "1. Test",
        fewShotExamples: "Examples",
      })
    ).rejects.toThrow("All 3 tiers failed");
  });
});
