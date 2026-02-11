import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { z } from "zod";
import type OpenAI from "openai";
import { StructuredOutputError } from "../structured-output-errors";

/**
 * Tests for structured output with 3-tier fallback (Issue #30)
 *
 * These tests verify:
 * - Tier 1 (JSON Schema strict) succeeds with valid response
 * - Tier 2 (JSON Schema non-strict) is tried when Tier 1 fails
 * - Tier 3 (JSON Object + Zod) is tried when Tiers 1 and 2 fail
 * - All tiers failing throws StructuredOutputError with attempt history
 * - Zod validation is applied correctly
 * - Edge cases like empty choices array are handled
 */

// Define a simple test schema
const TestSchema = z.object({
  name: z.string(),
  score: z.number().int().min(1).max(5),
  items: z.array(z.string()).min(1),
});

type TestType = z.infer<typeof TestSchema>;

// Mock the llm module
const mockCreate = vi.fn();

vi.mock("../llm", () => ({
  client: {
    responses: {
      create: mockCreate,
    },
  },
  MODEL: "gpt-5.1-codex-mini",
  MAX_COMPLETION_TOKENS: 2000,
}));

describe("invokeWithStructuredOutput", () => {
  beforeEach(() => {
    mockCreate.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Helper to create a valid Responses API response
   * Responses API uses output_text (convenience) and output array, not content
   */
  function createValidResponse(data: TestType): any {
    return {
      id: "resp_test123",
      object: "response",
      created_at: Date.now(),
      model: "gpt-5.1-codex-mini",
      status: "completed",
      output_text: JSON.stringify(data),
      output: [
        {
          type: "message",
          role: "assistant",
          content: [
            {
              type: "output_text",
              text: JSON.stringify(data),
            },
          ],
        },
      ],
      usage: {
        input_tokens: 100,
        output_tokens: 50,
        total_tokens: 150,
      },
    };
  }

  it("should succeed with Tier 1 (JSON Schema strict mode)", async () => {
    const testData: TestType = {
      name: "Test",
      score: 4,
      items: ["item1", "item2"],
    };

    mockCreate.mockResolvedValueOnce(createValidResponse(testData));

    const { invokeWithStructuredOutput } = await import("../structured-output");

    const result = await invokeWithStructuredOutput<TestType>(TestSchema, {
      system: "You are a test assistant",
      user: "Generate a test response",
    });

    expect(result.tier).toBe(1);
    expect(result.result).toEqual(testData);
    expect(result.usage.totalTokens).toBe(150);

    // Verify Tier 1 was called with strict: true (Responses API uses text.format)
    expect(mockCreate).toHaveBeenCalledTimes(1);
    const call = mockCreate.mock.calls[0][0];
    expect(call.text.format.type).toBe("json_schema");
    expect(call.text.format.strict).toBe(true);
  });

  it("should fallback to Tier 2 when Tier 1 fails", async () => {
    const testData: TestType = {
      name: "Test",
      score: 3,
      items: ["item1"],
    };

    // First call (Tier 1) fails
    mockCreate.mockRejectedValueOnce(new Error("Strict schema not supported"));
    // Second call (Tier 2) succeeds
    mockCreate.mockResolvedValueOnce(createValidResponse(testData));

    const { invokeWithStructuredOutput } = await import("../structured-output");

    const result = await invokeWithStructuredOutput<TestType>(TestSchema, {
      system: "You are a test assistant",
      user: "Generate a test response",
    });

    expect(result.tier).toBe(2);
    expect(result.result.score).toBe(3);

    // Verify both tiers were attempted
    expect(mockCreate).toHaveBeenCalledTimes(2);

    // Verify Tier 2 was called without strict (Responses API uses text.format)
    const tier2Call = mockCreate.mock.calls[1][0];
    expect(tier2Call.text.format.type).toBe("json_schema");
    expect(tier2Call.text.format.strict).toBeUndefined();
  });

  it("should fallback to Tier 3 when Tiers 1 and 2 fail", async () => {
    const testData: TestType = {
      name: "Test",
      score: 5,
      items: ["item1", "item2", "item3"],
    };

    // Tier 1 fails
    mockCreate.mockRejectedValueOnce(new Error("Tier 1 failed"));
    // Tier 2 fails
    mockCreate.mockRejectedValueOnce(new Error("Tier 2 failed"));
    // Tier 3 succeeds
    mockCreate.mockResolvedValueOnce(createValidResponse(testData));

    const { invokeWithStructuredOutput } = await import("../structured-output");

    const result = await invokeWithStructuredOutput<TestType>(TestSchema, {
      system: "You are a test assistant",
      user: "Generate a test response",
    });

    expect(result.tier).toBe(3);
    expect(result.result.score).toBe(5);

    // Verify all three tiers were attempted
    expect(mockCreate).toHaveBeenCalledTimes(3);

    // Verify Tier 3 was called with json_object mode (Responses API uses text.format)
    const tier3Call = mockCreate.mock.calls[2][0];
    expect(tier3Call.text.format).toEqual({ type: "json_object" });
  });

  it("should throw StructuredOutputError when all tiers fail", async () => {
    mockCreate.mockRejectedValue(new Error("All tiers failed"));

    const { invokeWithStructuredOutput } = await import("../structured-output");

    await expect(
      invokeWithStructuredOutput<TestType>(TestSchema, {
        system: "You are a test assistant",
        user: "Generate a test response",
      }),
    ).rejects.toThrow(StructuredOutputError);

    // Verify all three tiers were attempted
    expect(mockCreate).toHaveBeenCalledTimes(3);
  });

  it("should validate with Zod and reject invalid data", async () => {
    // Invalid: score is out of range
    const invalidData = {
      name: "Test",
      score: 10, // Should be 1-5
      items: ["item1"],
    };

    mockCreate.mockResolvedValue(createValidResponse(invalidData as TestType));

    const { invokeWithStructuredOutput } = await import("../structured-output");

    // All tiers will fail because Zod validation fails
    await expect(
      invokeWithStructuredOutput<TestType>(TestSchema, {
        system: "You are a test assistant",
        user: "Generate a test response",
      }),
    ).rejects.toThrow();
  });

  it("should validate required fields are present", async () => {
    // Invalid: missing 'items' field
    const invalidData = {
      name: "Test",
      score: 4,
      // items is missing
    };

    mockCreate.mockResolvedValue(createValidResponse(invalidData as TestType));

    const { invokeWithStructuredOutput } = await import("../structured-output");

    // All tiers will fail because Zod validation fails (missing required field)
    await expect(
      invokeWithStructuredOutput<TestType>(TestSchema, {
        system: "You are a test assistant",
        user: "Generate a test response",
      }),
    ).rejects.toThrow();
  });

  it("should use custom maxCompletionTokens if provided", async () => {
    const testData: TestType = {
      name: "Test",
      score: 4,
      items: ["item1"],
    };

    mockCreate.mockResolvedValueOnce(createValidResponse(testData));

    const { invokeWithStructuredOutput } = await import("../structured-output");

    await invokeWithStructuredOutput<TestType>(TestSchema, {
      system: "You are a test assistant",
      user: "Generate a test response",
      maxCompletionTokens: 500,
    });

    // Verify custom max_output_tokens was used (Responses API)
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        max_output_tokens: 500,
      }),
    );
  });

  it("should handle empty output_text from API", async () => {
    // Responses API with no output_text (e.g. incomplete/filtered)
    mockCreate.mockResolvedValue({
      status: "completed",
      output_text: null,
      output: [],
      usage: { input_tokens: 0, output_tokens: 0, total_tokens: 0 },
    });

    const { invokeWithStructuredOutput } = await import("../structured-output");

    // All 3 tiers will fail with the same error
    await expect(
      invokeWithStructuredOutput<TestType>(TestSchema, {
        system: "You are a test assistant",
        user: "Generate a test response",
      }),
    ).rejects.toThrow(StructuredOutputError);
  });

  it("should handle incomplete response status", async () => {
    // Responses API with incomplete status (e.g. max_output_tokens reached)
    mockCreate.mockResolvedValue({
      status: "incomplete",
      incomplete_details: { reason: "max_output_tokens" },
      output_text: null,
      output: [],
      usage: { input_tokens: 0, output_tokens: 0, total_tokens: 0 },
    });

    const { invokeWithStructuredOutput } = await import("../structured-output");

    // All 3 tiers will fail due to incomplete status
    await expect(
      invokeWithStructuredOutput<TestType>(TestSchema, {
        system: "You are a test assistant",
        user: "Generate a test response",
      }),
    ).rejects.toThrow(StructuredOutputError);
  });

  it("should handle invalid JSON in response", async () => {
    // Response with invalid JSON in output_text
    mockCreate.mockResolvedValue({
      status: "completed",
      output_text: '{"invalid": json}', // Invalid JSON
      output: [],
      usage: { input_tokens: 0, output_tokens: 0, total_tokens: 0 },
    });

    const { invokeWithStructuredOutput } = await import("../structured-output");

    // All 3 tiers will fail with JSON parse error
    await expect(
      invokeWithStructuredOutput<TestType>(TestSchema, {
        system: "You are a test assistant",
        user: "Generate a test response",
      }),
    ).rejects.toThrow(StructuredOutputError);
  });
});
