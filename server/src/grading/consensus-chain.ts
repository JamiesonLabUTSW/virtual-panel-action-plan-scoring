/**
 * Consensus arbiter chain for reconciling multi-judge evaluations (Issue #34)
 *
 * Implements a consensus pipeline that:
 * - Computes deterministic agreement statistics (mean, median, spread, agreement_level)
 * - Formats judge outputs into a structured prompt for the arbiter LLM
 * - Invokes the arbiter with 3-tier structured output fallback
 * - Overrides LLM-computed stats with deterministic values
 * - Validates final_score constraint (must be within [min, max] of judge scores)
 *
 * The arbiter NEVER re-reads the original proposal; it only synthesizes judge rationales.
 */

import type { ConsensusOutputType, JudgeOutputType } from "@shared/schemas";
import { ConsensusOutput } from "@shared/schemas";
import { invokeWithStructuredOutput } from "./structured-output";

/**
 * Input for consensus arbiter
 */
export interface ConsensusInput {
  /**
   * Judge results (2-3 judges required)
   */
  judgeResults: {
    rater_a?: JudgeOutputType;
    rater_b?: JudgeOutputType;
    rater_c?: JudgeOutputType;
  };

  /**
   * Number of judges that failed (0-1 acceptable, 2+ will throw)
   */
  missingJudgeCount: number;

  /**
   * Timeout override in milliseconds (default: 30000)
   */
  timeoutMs?: number;
}

/**
 * Consensus result with tier and usage information
 */
interface ConsensusResult {
  result: ConsensusOutputType;
  tier: 1 | 2 | 3;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * Agreement statistics computed from judge scores
 */
interface AgreementStats {
  mean_score: number;
  median_score: number;
  spread: number;
  agreement_level: "strong" | "moderate" | "weak";
}

/**
 * Compute deterministic agreement statistics from judge scores
 *
 * This is a pure function for testability. Statistics are computed here
 * rather than trusting LLM arithmetic.
 *
 * @param scores - Array of 2-3 judge scores (integers 1-5)
 * @returns Agreement statistics
 *
 * @example
 * ```typescript
 * computeAgreementStats([5, 5, 5]) // { mean: 5.0, median: 5, spread: 0, level: "strong" }
 * computeAgreementStats([3, 4, 5]) // { mean: 4.0, median: 4, spread: 2, level: "moderate" }
 * computeAgreementStats([2, 3])    // { mean: 2.5, median: 3, spread: 1, level: "strong" }
 * ```
 */
export function computeAgreementStats(scores: number[]): AgreementStats {
  if (scores.length < 2) {
    throw new Error(`Cannot compute stats with ${scores.length} score(s)`);
  }

  // Sort scores ascending
  const sorted = [...scores].sort((a, b) => a - b);

  // Mean: arithmetic average, rounded to 1 decimal
  const sum = sorted.reduce((acc, score) => acc + score, 0);
  const mean_score = Number((sum / sorted.length).toFixed(1));

  // Median: middle value (for even count, round average of two middle values)
  let median_score: number;
  if (sorted.length % 2 === 0) {
    const mid1 = sorted[sorted.length / 2 - 1];
    const mid2 = sorted[sorted.length / 2];
    median_score = Math.round((mid1 + mid2) / 2);
  } else {
    median_score = sorted[Math.floor(sorted.length / 2)];
  }

  // Spread: max - min
  const spread = sorted[sorted.length - 1] - sorted[0];

  // Agreement level based on spread
  //   0-1 = "strong", 2 = "moderate", 3-4 = "weak"
  let agreement_level: "strong" | "moderate" | "weak";
  if (spread <= 1) {
    agreement_level = "strong";
  } else if (spread === 2) {
    agreement_level = "moderate";
  } else {
    agreement_level = "weak";
  }

  return {
    mean_score,
    median_score,
    spread,
    agreement_level,
  };
}

/**
 * Arbiter system prompt
 *
 * Defines the arbiter's role, persona descriptions, and core rules.
 * The arbiter synthesizes judge perspectives without re-reading the proposal.
 */
const ARBITER_SYSTEM_PROMPT = `You are a consensus ARBITER. You receive evaluations from up to three calibrated
judges (Rater A "The Professor", Rater B "The Editor", Rater C "The Practitioner")
who assessed the same program proposal against the same rubric. Each judge was
calibrated with a different human rater's few-shot examples, giving them distinct
scoring tendencies.

RATER PERSONAS:
- Rater A ("The Professor"): strict on structure, quantitative targets, metric
  specificity; demands detailed methodology and clear execution plans
- Rater B ("The Editor"): generous on feasibility and clarity; values achievable,
  well-articulated plans with clear timelines
- Rater C ("The Practitioner"): strict on actionability, data richness, practical
  impact; focuses on real-world implementation and concrete mechanisms

YOUR TASK:
Read each judge's per-item feedback and overall rationale. Synthesize their
perspectives into a single consensus evaluation grounded in their reasoning.

ARBITER RULES:
1. Your final_score MUST be within [min(judge scores), max(judge scores)].
   You may NOT score outside this range.
2. Your rationale must reference specific points from the judges' feedback.
   Do NOT introduce new claims about the proposal — only synthesize what
   the judges observed.
3. When judges agree, note the consensus and shared themes.
4. When judges disagree, explain WHY based on their different calibration
   perspectives and the specific feedback each provided.
5. If fewer than 3 judges succeeded, explicitly acknowledge the missing
   perspective(s) and note reduced confidence in the consensus.
6. Produce consolidated improvement suggestions — deduplicate across judges,
   merging similar points into one clear recommendation.
7. Return ONLY valid JSON matching the required schema. No free-form text.`;

/**
 * Format judge results for user prompt
 *
 * @param judgeResults - Judge outputs (2-3 judges)
 * @param missingJudgeCount - Number of missing judges
 * @returns Formatted user prompt
 */
function formatConsensusUserPrompt(
  judgeResults: ConsensusInput["judgeResults"],
  missingJudgeCount: number
): string {
  const sections: string[] = ["## Judge Evaluations\n"];

  if (judgeResults.rater_a) {
    sections.push(
      `### Rater A (The Professor) — Overall Score: ${judgeResults.rater_a.overall_score}/5`,
      JSON.stringify(judgeResults.rater_a, null, 2),
      ""
    );
  }

  if (judgeResults.rater_b) {
    sections.push(
      `### Rater B (The Editor) — Overall Score: ${judgeResults.rater_b.overall_score}/5`,
      JSON.stringify(judgeResults.rater_b, null, 2),
      ""
    );
  }

  if (judgeResults.rater_c) {
    sections.push(
      `### Rater C (The Practitioner) — Overall Score: ${judgeResults.rater_c.overall_score}/5`,
      JSON.stringify(judgeResults.rater_c, null, 2),
      ""
    );
  }

  if (missingJudgeCount > 0) {
    sections.push(
      `NOTE: ${missingJudgeCount} judge(s) did not complete evaluation. Acknowledge the`,
      "missing perspective and proceed with consensus from available judges.",
      ""
    );
  }

  sections.push(
    "Synthesize these evaluations into a consensus assessment. Return your synthesis",
    "as valid JSON."
  );

  return sections.join("\n");
}

/**
 * Extract judge scores from results
 *
 * @param judgeResults - Judge outputs
 * @returns Object with score for each rater (undefined if missing)
 */
function extractJudgeScores(judgeResults: ConsensusInput["judgeResults"]): {
  rater_a?: number;
  rater_b?: number;
  rater_c?: number;
} {
  return {
    rater_a: judgeResults.rater_a?.overall_score,
    rater_b: judgeResults.rater_b?.overall_score,
    rater_c: judgeResults.rater_c?.overall_score,
  };
}

/**
 * Run consensus arbiter to reconcile judge evaluations
 *
 * Requires at least 2 judges. Computes deterministic agreement statistics,
 * invokes the arbiter LLM, overrides stats, and validates constraints.
 *
 * @param input - Consensus input with judge results
 * @returns Consensus result with tier and usage information
 * @throws If fewer than 2 judges present
 * @throws If final_score violates [min, max] constraint
 *
 * @example
 * ```typescript
 * const result = await runConsensus({
 *   judgeResults: {
 *     rater_a: { proposal_id: 1, evaluator_id: 1, ... },
 *     rater_b: { proposal_id: 1, evaluator_id: 2, ... },
 *     rater_c: { proposal_id: 1, evaluator_id: 3, ... }
 *   },
 *   missingJudgeCount: 0
 * });
 * ```
 */
export async function runConsensus(input: ConsensusInput): Promise<ConsensusResult> {
  const { judgeResults, missingJudgeCount } = input;

  // Extract scores (filter out undefined)
  const judgeScores = extractJudgeScores(judgeResults);
  const scores = Object.values(judgeScores).filter((s): s is number => s !== undefined);

  // Validate at least 2 judges
  if (scores.length < 2) {
    throw new Error(`Cannot run consensus with fewer than 2 judges (received ${scores.length})`);
  }

  // Compute deterministic statistics
  const computedStats = computeAgreementStats(scores);

  // Format prompts
  const systemPrompt = ARBITER_SYSTEM_PROMPT;
  const userPrompt = formatConsensusUserPrompt(judgeResults, missingJudgeCount);

  // Invoke LLM with structured output
  // biome-ignore lint/suspicious/noExplicitAny: Generic type parameter is passed to function
  const {
    result: rawResult,
    tier,
    usage,
  } = await invokeWithStructuredOutput<ConsensusOutputType>(ConsensusOutput, {
    system: systemPrompt,
    user: userPrompt,
    maxCompletionTokens: 4000,
    schemaName: "consensus_output",
  });

  // Override agreement stats with computed values (never trust LLM arithmetic)
  const result: ConsensusOutputType = {
    ...rawResult,
    agreement: {
      ...rawResult.agreement,
      scores: {
        rater_a: judgeScores.rater_a ?? 0,
        rater_b: judgeScores.rater_b ?? 0,
        rater_c: judgeScores.rater_c ?? 0,
      },
      mean_score: computedStats.mean_score,
      median_score: computedStats.median_score,
      spread: computedStats.spread,
      agreement_level: computedStats.agreement_level,
    },
  };

  // Validate final_score constraint
  const minScore = Math.min(...scores);
  const maxScore = Math.max(...scores);

  if (result.final_score < minScore || result.final_score > maxScore) {
    throw new Error(
      `Consensus final_score ${result.final_score} outside judge range [${minScore}, ${maxScore}]`
    );
  }

  return { result, tier, usage };
}
