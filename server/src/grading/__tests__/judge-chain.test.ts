import { JudgeOutput, type JudgeOutputType } from "@shared/schemas";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { InvokeOptions } from "../../__tests__/test-types";
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
    const options = callArgs[1] as InvokeOptions;

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
    const options = callArgs[1] as InvokeOptions;

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
    const schema = callArgs[0];

    expect(schema).toBe(JudgeOutput);
  });

  // biome-ignore lint/security/noSecrets: test name, not a secret
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
    const options = callArgs[1] as InvokeOptions;

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

  it("should use custom timeoutMs when provided", async () => {
    const setTimeoutSpy = vi.spyOn(global, "setTimeout");
    mockInvokeWithStructuredOutput.mockResolvedValue(createMockJudgeResult());

    await runJudge({
      proposalId: 1,
      evaluatorId: 1,
      evaluatorName: "Rater A",
      actionItemsText: "1. Test",
      fewShotExamples: "Examples",
      timeoutMs: 5000,
    });

    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 5000);
    setTimeoutSpy.mockRestore();
  });

  it("should use default timeout (60000ms) when timeoutMs not provided", async () => {
    const setTimeoutSpy = vi.spyOn(global, "setTimeout");
    mockInvokeWithStructuredOutput.mockResolvedValue(createMockJudgeResult());

    await runJudge({
      proposalId: 1,
      evaluatorId: 1,
      evaluatorName: "Rater A",
      actionItemsText: "1. Test",
      fewShotExamples: "Examples",
    });

    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 60000);
    setTimeoutSpy.mockRestore();
  });

  it("should call clearTimeout in finally block on success path", async () => {
    const clearTimeoutSpy = vi.spyOn(global, "clearTimeout");
    mockInvokeWithStructuredOutput.mockResolvedValue(createMockJudgeResult());

    await runJudge({
      proposalId: 1,
      evaluatorId: 1,
      evaluatorName: "Rater A",
      actionItemsText: "1. Test",
      fewShotExamples: "Examples",
      timeoutMs: 5000,
    });

    expect(clearTimeoutSpy).toHaveBeenCalled();
    clearTimeoutSpy.mockRestore();
  });

  it("should call clearTimeout in finally block on error path", async () => {
    const clearTimeoutSpy = vi.spyOn(global, "clearTimeout");
    const mockError = new Error("API call failed");
    mockInvokeWithStructuredOutput.mockRejectedValue(mockError);

    await expect(
      runJudge({
        proposalId: 1,
        evaluatorId: 1,
        evaluatorName: "Rater A",
        actionItemsText: "1. Test",
        fewShotExamples: "Examples",
        timeoutMs: 5000,
      })
    ).rejects.toThrow("API call failed");

    expect(clearTimeoutSpy).toHaveBeenCalled();
    clearTimeoutSpy.mockRestore();
  });

  it("should clean up timeout after successful evaluation", async () => {
    const setTimeoutSpy = vi.spyOn(global, "setTimeout");
    const clearTimeoutSpy = vi.spyOn(global, "clearTimeout");
    mockInvokeWithStructuredOutput.mockResolvedValue(createMockJudgeResult());

    await runJudge({
      proposalId: 1,
      evaluatorId: 1,
      evaluatorName: "Rater A",
      actionItemsText: "1. Test",
      fewShotExamples: "Examples",
      timeoutMs: 10000,
    });

    // Verify both setTimeout and clearTimeout were called
    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 10000);
    expect(clearTimeoutSpy).toHaveBeenCalled();

    // Verify clearTimeout was called with a valid timeout ID (number or timeout object)
    const clearTimeoutCall = clearTimeoutSpy.mock.calls[0]?.[0];
    expect(clearTimeoutCall).toBeDefined();

    setTimeoutSpy.mockRestore();
    clearTimeoutSpy.mockRestore();
  });

  it("should clean up timeout even when evaluation fails", async () => {
    const setTimeoutSpy = vi.spyOn(global, "setTimeout");
    const clearTimeoutSpy = vi.spyOn(global, "clearTimeout");
    const mockError = new Error("Evaluation failed");
    mockInvokeWithStructuredOutput.mockRejectedValue(mockError);

    await expect(
      runJudge({
        proposalId: 1,
        evaluatorId: 1,
        evaluatorName: "Rater A",
        actionItemsText: "1. Test",
        fewShotExamples: "Examples",
        timeoutMs: 10000,
      })
    ).rejects.toThrow("Evaluation failed");

    // Verify both setTimeout and clearTimeout were called
    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 10000);
    expect(clearTimeoutSpy).toHaveBeenCalled();

    // Verify clearTimeout was called with a valid timeout ID (number or timeout object)
    const clearTimeoutCall = clearTimeoutSpy.mock.calls[0]?.[0];
    expect(clearTimeoutCall).toBeDefined();

    setTimeoutSpy.mockRestore();
    clearTimeoutSpy.mockRestore();
  });

  /**
   * SKIPPED: Timeout abort branches (lines 187-189, 199-202, 206-213)
   *
   * These branches check abortController.signal.aborted, which is "prepared
   * for future SDK support" (line 156 comment). The abort signal is NOT
   * wired to the OpenAI SDK call in invokeWithStructuredOutput.
   *
   * Current limitation: Even if setTimeout fires and calls abort(), the
   * API call completes normally because the signal isn't passed to the SDK.
   *
   * TODO: Enable when @langchain/openai supports AbortController in Responses API
   */
  describe.skip("timeout abort handling (future SDK support)", () => {
    it("should throw when timeout occurs before API call", async () => {
      // TODO: Implement when SDK supports abort signals
    });

    it("should throw when timeout occurs after API call", async () => {
      // TODO: Implement when SDK supports abort signals
    });

    it("should throw with original error context when timeout in catch block", async () => {
      // TODO: Implement when SDK supports abort signals
    });
  });
});
