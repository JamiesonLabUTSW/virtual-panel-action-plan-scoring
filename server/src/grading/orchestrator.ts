/**
 * Grading orchestrator: Parallel pipeline of judge evaluations + consensus
 *
 * Implements the core grading logic:
 * - Runs 3 judges in parallel (Promise.all)
 * - Emits state updates as each judge completes
 * - Handles single-judge failures gracefully (continues with 2 judges)
 * - Errors out if 2+ judges fail (cannot form consensus)
 * - Structured logging for diagnostics (key=value format, no proposal content)
 *
 * @see {@link SPEC.md} §5.3 for detailed specification
 */

import type { GradingState, JudgeState } from "@shared/types";
import { runConsensus } from "./consensus-chain";
import { checkContentSafety } from "./content-safety";
import { RATER_A_EXAMPLES, RATER_B_EXAMPLES, RATER_C_EXAMPLES } from "./few-shot-sets";
import { runJudge } from "./judge-chain";

/**
 * Input parameters for the grading pipeline
 */
export interface PipelineInput {
  /** Proposal identifier */
  proposalId: number;

  /** Optional proposal title for context */
  proposalTitle?: string;

  /** Array of action item text to evaluate (will truncate to max 20) */
  actionItems: string[];

  /** State emission callback for progressive UI updates */
  emitState: (state: Partial<GradingState>) => void;
}

/**
 * Judge configuration entry
 */
interface JudgeConfig {
  /** Unique identifier: "rater_a" | "rater_b" | "rater_c" */
  id: "rater_a" | "rater_b" | "rater_c";

  /** Azure OpenAI evaluator persona ID (1=A, 2=B, 3=C) */
  evaluatorId: number;

  /** Display label for UI */
  label: string;

  /** Pre-formatted few-shot calibration examples */
  examples: string;
}

/**
 * Judge configurations in evaluation order
 */
const JUDGES: JudgeConfig[] = [
  {
    id: "rater_a",
    evaluatorId: 1,
    label: "Rater A",
    examples: RATER_A_EXAMPLES,
  },
  {
    id: "rater_b",
    evaluatorId: 2,
    label: "Rater B",
    examples: RATER_B_EXAMPLES,
  },
  {
    id: "rater_c",
    evaluatorId: 3,
    label: "Rater C",
    examples: RATER_C_EXAMPLES,
  },
];

/**
 * Run the complete grading pipeline
 *
 * Orchestrates:
 * 1. Parallel judge evaluations (all 3 judges run concurrently)
 * 2. State emissions as each judge completes
 * 3. Error degradation (1 judge fail continues, 2+ fails throws)
 * 4. Consensus arbiter to reconcile judge outputs
 * 5. Structured logging (diagnostics only, no proposal content)
 *
 * @param input - Pipeline input (proposal, action items, state callback)
 * @returns Final grading state on success
 * @throws Error if 2+ judges fail or consensus fails
 */
export async function runGradingPipeline(input: PipelineInput): Promise<GradingState> {
  const { proposalId, proposalTitle, actionItems, emitState } = input;

  // Truncate action items to max 20
  const truncatedItems = actionItems.slice(0, 20);
  const wasTruncated = actionItems.length > 20;

  // Validate non-empty action items
  if (truncatedItems.length === 0) {
    const errorMsg = "No action items provided. At least 1 action item is required for evaluation.";
    console.error(`[run] FAILED proposal_id=${proposalId}: ${errorMsg}`);
    emitState({
      phase: "error",
      judges: {},
      error: errorMsg,
    });
    throw new Error(errorMsg);
  }

  // Content safety check: Screen proposal text for injection attempts and inappropriate content
  // This is the ONLY untrusted user input in the system - all other inputs (rubric, few-shot
  // examples, system prompts) are controlled server-side.
  console.info("[content-safety] Screening proposal text...");
  const proposalText = truncatedItems.join("\n\n");

  try {
    const safetyResult = await checkContentSafety(proposalText);

    // Log result (never log proposal content)
    if (safetyResult.isSafe) {
      console.info(`[content-safety] result=safe latency=${safetyResult.latencyMs}ms`);
    } else {
      console.warn(
        `[content-safety] result=blocked latency=${safetyResult.latencyMs}ms reason="${safetyResult.reason}"`
      );

      // Emit error state
      const errorMsg =
        "This proposal contains inappropriate content or invalid formatting. Please review and try again.";
      emitState({
        phase: "error",
        judges: {},
        error: errorMsg,
      });
      throw new Error(errorMsg);
    }
  } catch (error) {
    // Re-throw content safety rejections as-is (already have error state emitted)
    if (error instanceof Error && error.message.includes("inappropriate content")) {
      throw error;
    }

    // Infrastructure errors (network, auth, rate limit) — emit error state with sanitized message
    const errorMsg = "Unable to verify content safety. Please try again.";
    console.error(
      `[content-safety] FAILED: ${error instanceof Error ? error.message : String(error)}`
    );
    emitState({
      phase: "error",
      judges: {},
      error: errorMsg,
    });
    throw new Error(errorMsg);
  }

  console.info(`[run] started proposal_id=${proposalId} action_items=${truncatedItems.length}`);

  const runStartTime = Date.now();

  // Local state accumulator (built immutably)
  const judgeResults: Record<string, JudgeState> = {};

  // Format action items as numbered list (shared across all judges)
  const actionItemsText = truncatedItems
    .map((item, idx) => `${idx + 1}. (ID: ${idx + 1}) ${item}`)
    .join("\n\n");

  // Emit initial state for all judges
  for (const judge of JUDGES) {
    judgeResults[judge.id] = {
      status: "running",
      label: judge.label,
    };
  }
  emitState({
    phase: "evaluating",
    judges: { ...judgeResults },
    wasTruncated,
  });

  // Parallel judge execution (Promise.all)
  const judgePromises = JUDGES.map(async (judge) => {
    const judgeStartTime = Date.now();

    try {
      // Run judge evaluation
      const { result, tier, usage } = await runJudge({
        proposalId,
        evaluatorId: judge.evaluatorId,
        evaluatorName: judge.label,
        actionItemsText,
        fewShotExamples: judge.examples,
        timeoutMs: 60000,
      });

      const latencyMs = Date.now() - judgeStartTime;

      // Update local state
      judgeResults[judge.id] = {
        status: "done",
        label: judge.label,
        result,
        latencyMs,
      };

      // Log judge completion
      console.info(
        `[judge:${judge.id}] overall_score=${result.overall_score} latency=${latencyMs}ms tier=${tier} tokens=${usage.totalTokens}`
      );

      // EMIT: Judge completed
      emitState({
        judges: { ...judgeResults },
      });
    } catch (error) {
      const latencyMs = Date.now() - judgeStartTime;

      // Update local state with error
      judgeResults[judge.id] = {
        status: "error",
        label: judge.label,
        error: error instanceof Error ? error.message : "Unknown error",
        latencyMs,
      };

      // Log judge failure
      console.error(
        `[judge:${judge.id}] FAILED after ${latencyMs}ms: ${
          error instanceof Error ? error.message : String(error)
        }`
      );

      // EMIT: Judge failed
      emitState({
        judges: { ...judgeResults },
      });
    }
  });

  // Wait for all judges to complete
  await Promise.all(judgePromises);

  // Validate: At least 2 judges succeeded
  const successfulJudges = Object.entries(judgeResults).filter(
    ([_, state]) => state.status === "done" && state.result
  );

  const failedCount = JUDGES.length - successfulJudges.length;

  if (successfulJudges.length < 2) {
    const errorMsg = `Fewer than 2 judges succeeded (${failedCount} failed). Cannot form consensus.`;
    console.error(`[run] FAILED: ${errorMsg}`);

    emitState({
      phase: "error",
      judges: { ...judgeResults },
      error: errorMsg,
    });

    throw new Error(errorMsg);
  }

  // EMIT: Consensus starting
  emitState({
    phase: "consensus",
    judges: { ...judgeResults },
  });

  try {
    // Extract judge results for consensus (undefined for failed judges)
    const consensusInput = {
      judgeResults: {
        rater_a: judgeResults.rater_a?.status === "done" ? judgeResults.rater_a.result : undefined,
        rater_b: judgeResults.rater_b?.status === "done" ? judgeResults.rater_b.result : undefined,
        rater_c: judgeResults.rater_c?.status === "done" ? judgeResults.rater_c.result : undefined,
      },
      missingJudgeCount: failedCount,
    };

    const consensusStartTime = Date.now();
    const { result: consensus, tier, usage } = await runConsensus(consensusInput);
    const consensusLatencyMs = Date.now() - consensusStartTime;

    // Log consensus completion
    const agreementSpread = consensus.agreement.spread;
    console.info(
      `[consensus] final_score=${consensus.final_score} agreement=${consensus.agreement.agreement_level} spread=${agreementSpread} latency=${consensusLatencyMs}ms tier=${tier} tokens=${usage.totalTokens}`
    );

    // Build final state
    const finalState: GradingState = {
      phase: "done",
      proposal: {
        id: proposalId,
        title: proposalTitle,
        actionItems: truncatedItems,
        wasTruncated,
      },
      judges: { ...judgeResults },
      consensus,
      wasTruncated,
    };

    // EMIT: Final complete state
    emitState(finalState);

    const totalLatencyMs = Date.now() - runStartTime;
    console.info(
      `[run] completed total_latency=${totalLatencyMs}ms judges_succeeded=${successfulJudges.length} judges_failed=${failedCount}`
    );

    return finalState;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[consensus] FAILED: ${errorMsg}`);

    emitState({
      phase: "error",
      judges: { ...judgeResults },
      error: `Consensus failed: ${errorMsg}`,
    });

    throw error;
  }
}
