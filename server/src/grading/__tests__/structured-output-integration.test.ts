import { JudgeOutput, type JudgeOutputType } from "@shared/schemas";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { invokeWithStructuredOutput } from "../structured-output";

/**
 * Integration tests for structured output with real Azure OpenAI API (Issue #30)
 *
 * These tests verify that the 3-tier fallback works with actual API calls.
 * They are skipped by default and only run when RUN_INTEGRATION_TESTS=true.
 *
 * To run:
 * RUN_INTEGRATION_TESTS=true npm test --workspace=@grading/server -- structured-output-integration
 *
 * Requires real Azure credentials in .env:
 * - AZURE_OPENAI_API_KEY
 * - AZURE_OPENAI_RESOURCE
 * - AZURE_OPENAI_DEPLOYMENT
 */

describe("Structured Output Integration Tests", () => {
  const originalEnv = { ...process.env };

  beforeAll(() => {
    // Set required environment variables for tests
    // These will be overridden by real values if RUN_INTEGRATION_TESTS=true
    process.env.AZURE_OPENAI_API_KEY = process.env.AZURE_OPENAI_API_KEY || "test-key";
    process.env.AZURE_OPENAI_RESOURCE = process.env.AZURE_OPENAI_RESOURCE || "test-resource";
    process.env.AZURE_OPENAI_DEPLOYMENT =
      process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-5.1-codex-mini";
    process.env.AZURE_OPENAI_API_VERSION =
      process.env.AZURE_OPENAI_API_VERSION || "2024-10-01-preview";
  });

  afterAll(() => {
    // Restore original environment
    process.env = originalEnv;
  });
  it.skipIf(!process.env.RUN_INTEGRATION_TESTS)(
    "should produce valid JudgeOutput with real Azure OpenAI",
    async () => {
      const systemPrompt = `You are an expert program evaluator. Produce a single, schema-valid tool call named log_review that logs your evaluation for the listed action items and the proposal overall.

SCORING ANCHORS:
- 1 = Poor: fundamental gaps; lacks feasibility, clarity, or alignment
- 2 = Weak: notable issues; partial feasibility or unclear execution
- 3 = Adequate: meets minimum; feasible but needs improvements
- 4 = Strong: solid plan with minor refinements suggested
- 5 = Excellent: clear, feasible, well-aligned, high impact

Return ONLY valid JSON matching the required schema.`;

      const userPrompt = `## Proposal to Evaluate

Proposal ID: 1
Evaluator ID: 1
Evaluator Name: The Professor

### Action Items

**Action Item 1:** Implement a progressive-responsibility framework defining expected resident roles for index procedures by PGY level, from assistant to primary with distant supervision.

**Action Item 2:** Launch faculty development workshops on graded autonomy using validated scales.

**Action Item 3:** Pilot pre-op autonomy contracts and post-op debrief forms for high-yield index procedures.

Evaluate these action items and return your assessment as JSON.`;

      const result = await invokeWithStructuredOutput<JudgeOutputType>(JudgeOutput, {
        system: systemPrompt,
        user: userPrompt,
        // Use default (16000) — reasoning models need high token budgets for internal CoT
      });

      // Log which tier was used
      console.info(`✓ Integration test succeeded using Tier ${result.tier}`);
      console.info(
        `  Tokens: ${result.usage.totalTokens} (${result.usage.promptTokens} prompt + ${result.usage.completionTokens} completion)`
      );

      // Verify result structure
      expect(result).toBeDefined();
      expect(result.tier).toBeGreaterThanOrEqual(1);
      expect(result.tier).toBeLessThanOrEqual(3);

      // Verify JudgeOutput schema compliance (log_review format)
      const judge = result.result;
      expect(judge.proposal_id).toBe(1);
      expect(judge.evaluator_id).toBe(1);
      expect(judge.evaluator_name).toBeDefined();
      expect(judge.overall_score).toBeGreaterThanOrEqual(1);
      expect(judge.overall_score).toBeLessThanOrEqual(5);

      // Verify items array
      expect(judge.items).toBeDefined();
      expect(judge.items.length).toBeGreaterThanOrEqual(1);

      for (const item of judge.items) {
        expect(item.action_item_id).toBeDefined();
        expect(item.comment).toBeDefined();
        expect(typeof item.comment).toBe("string");
        expect(item.score).toBeGreaterThanOrEqual(1);
        expect(item.score).toBeLessThanOrEqual(5);
      }

      console.info(`  Overall Score: ${judge.overall_score}/5`);
      console.info(`  Items reviewed: ${judge.items.length}`);
      for (const item of judge.items) {
        console.info(`    Item ${item.action_item_id}: score=${item.score}`);
      }
    },
    60000 // 60 second timeout for real API call
  );

  it.skipIf(!process.env.RUN_INTEGRATION_TESTS)(
    "should handle proposals with different numbers of action items",
    async () => {
      const systemPrompt =
        "You are an expert program evaluator. Return valid JSON matching the log_review schema.";
      const userPrompt = `Proposal ID: 2, Evaluator ID: 1, Evaluator Name: Test Evaluator

Action Item 1: Implement a new training curriculum.

Evaluate and return JSON.`;

      const result = await invokeWithStructuredOutput<JudgeOutputType>(JudgeOutput, {
        system: systemPrompt,
        user: userPrompt,
        // Use default (16000) — reasoning models need high token budgets for internal CoT
      });

      expect(result.result.overall_score).toBeGreaterThanOrEqual(1);
      expect(result.result.overall_score).toBeLessThanOrEqual(5);
      expect(result.result.items.length).toBeGreaterThanOrEqual(1);

      console.info(`✓ Single-item proposal test succeeded using Tier ${result.tier}`);
    },
    60000
  );
});
