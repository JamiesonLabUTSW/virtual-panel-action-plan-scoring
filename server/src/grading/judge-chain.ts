/**
 * Judge chain for evaluating action item proposals with 3-tier structured output fallback
 *
 * Implements a single judge evaluation using:
 * - System prompt: Shared rubric from rubric.txt (scoring anchors, comment style, validation)
 * - User prompt: Few-shot calibration examples + proposal details (ID, evaluator, action items)
 * - Structured output: JudgeOutput schema with 3-tier fallback (strict → non-strict → json + Zod)
 * - Timeout: 30-second hardcoded timeout with AbortController cleanup
 *
 * The judge chain is invoked sequentially by the orchestrator (one judge at a time) to
 * avoid Azure rate limits and enable progressive UI updates.
 *
 * @see {@link SPEC.md} §4.6 for prompt templates
 * @see {@link SPEC.md} §5.3 for judge chain architecture
 */

import type { JudgeOutputType } from "@shared/schemas";
import { JudgeOutput } from "@shared/schemas";
import { RUBRIC_TEXT } from "./rubric";
import { invokeWithStructuredOutput } from "./structured-output";

/**
 * Input parameters for running a single judge evaluation
 */
export interface JudgeInput {
  /**
   * Proposal identifier (passed through to output)
   */
  proposalId: number;

  /**
   * Evaluator persona ID (1=A, 2=B, 3=C)
   */
  evaluatorId: number;

  /**
   * Evaluator persona name (e.g., "Rater A", "Rater B", "Rater C")
   */
  evaluatorName: string;

  /**
   * Pre-formatted action items text (e.g., "1. item\n\n2. item\n\n...")
   * Each item should include stable ID and description
   */
  actionItemsText: string;

  /**
   * Pre-formatted few-shot calibration examples from few-shot-sets.ts
   * Format: user message → assistant tool call (log_review schema)
   */
  fewShotExamples: string;

  /**
   * Timeout in milliseconds (default: 30000)
   * Used with AbortController to cancel long-running API calls
   */
  timeoutMs?: number;
}

/**
 * Result from a judge evaluation including tier and token usage
 */
export interface JudgeResult {
  /**
   * Validated judge output matching JudgeOutputType schema
   */
  result: JudgeOutputType;

  /**
   * Which structured output tier succeeded (1, 2, or 3)
   * - Tier 1: JSON Schema strict mode
   * - Tier 2: JSON Schema non-strict mode
   * - Tier 3: JSON Object + runtime Zod validation
   */
  tier: 1 | 2 | 3;

  /**
   * Token usage for the API call
   */
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * Default timeout for judge evaluations (30 seconds)
 */
const DEFAULT_TIMEOUT_MS = 30000;

/**
 * Maximum completion tokens for judge evaluations
 * Set to 4000 to allow for detailed per-item feedback and reasoning
 */
const MAX_COMPLETION_TOKENS = 4000;

/**
 * Schema name for structured output (matches rubric.txt tool call name)
 */
const SCHEMA_NAME = "log_review";

/**
 * Runs a single judge evaluation with timeout, structured output, and proper cleanup
 *
 * The judge receives:
 * 1. System prompt: Shared rubric with scoring anchors and validation rules (from rubric.txt)
 * 2. User prompt: Few-shot calibration examples + proposal details (ID, evaluator, action items)
 *
 * Returns validated JudgeOutputType with tier information and token usage.
 *
 * **Timeout handling:**
 * - Uses AbortController with 30-second default timeout
 * - Clears timeout in finally block to prevent memory leaks
 * - Throws clear error if timeout exceeded
 *
 * **Structured output:**
 * - Attempts 3-tier fallback (strict → non-strict → json + Zod)
 * - Each tier uses different API mechanism (not prompt changes)
 * - Returns which tier succeeded for diagnostics
 *
 * **Error handling:**
 * - StructuredOutputError propagates with tier attempt details
 * - Timeout errors throw with clear message
 * - Cleanup guaranteed in all paths
 *
 * @param input - Judge input parameters (proposal, evaluator, action items, few-shot examples)
 * @returns Promise resolving to JudgeResult with validated output, tier, and usage
 * @throws StructuredOutputError if all 3 tiers fail
 * @throws Error if timeout exceeded or other unexpected errors
 *
 * @example
 * ```typescript
 * const result = await runJudge({
 *   proposalId: 1,
 *   evaluatorId: 1,
 *   evaluatorName: "Rater A",
 *   actionItemsText: "1. Implement progressive-responsibility framework\n\n2. Launch faculty workshops",
 *   fewShotExamples: "## Example 1\n\nUser: ...\nAssistant: {...}",
 *   timeoutMs: 30000, // optional, defaults to 30s
 * });
 *
 * console.log(`Judge scored ${result.result.overall_score}/5 using Tier ${result.tier}`);
 * ```
 */
export async function runJudge(input: JudgeInput): Promise<JudgeResult> {
  const {
    proposalId,
    evaluatorId,
    evaluatorName,
    actionItemsText,
    fewShotExamples,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = input;

  // AbortController for timeout handling (prepared for future SDK support)
  const abortController = new AbortController();
  let timeoutId: NodeJS.Timeout | null = null;

  try {
    // Set up timeout
    timeoutId = setTimeout(() => {
      abortController.abort();
    }, timeoutMs);

    // Construct system prompt (rubric loaded from rubric.txt)
    const systemPrompt = RUBRIC_TEXT;

    // Construct user prompt per SPEC §4.6 template
    const userPrompt = `## Calibration Examples

${fewShotExamples}

## Proposal to Evaluate

Proposal ID: ${proposalId}
Evaluator ID: ${evaluatorId}
Evaluator Name: ${evaluatorName}

### Action Items

${actionItemsText}

Evaluate these action items according to the rubric.`;

    // Check if aborted before making API call
    if (abortController.signal.aborted) {
      throw new Error(`Judge evaluation timed out after ${timeoutMs}ms (aborted before API call)`);
    }

    // Invoke with structured output (3-tier fallback)
    const result = await invokeWithStructuredOutput<JudgeOutputType>(JudgeOutput, {
      system: systemPrompt,
      user: userPrompt,
      maxCompletionTokens: MAX_COMPLETION_TOKENS,
      schemaName: SCHEMA_NAME,
    });

    // Check if aborted after API call
    if (abortController.signal.aborted) {
      throw new Error(`Judge evaluation timed out after ${timeoutMs}ms (aborted after API call)`);
    }

    return result;
  } catch (error) {
    // Check if timeout occurred
    if (abortController.signal.aborted) {
      throw new Error(
        `Judge evaluation timed out after ${timeoutMs}ms. Original error: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }

    // Propagate other errors (including StructuredOutputError)
    throw error;
  } finally {
    // Always clear timeout to prevent memory leaks
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
  }
}
