import type { JudgeOutputType, ConsensusOutputType } from "./schemas";

/**
 * Phase represents the current state of the grading process
 */
export type Phase =
  | "idle"
  | "rater_a"
  | "rater_b"
  | "rater_c"
  | "consensus"
  | "done"
  | "error";

/**
 * JudgeState represents the status of a single judge's evaluation
 */
export interface JudgeState {
  status: "pending" | "running" | "done" | "error";
  label: string;
  result?: JudgeOutputType;
  error?: string;
  latencyMs?: number;
}

/**
 * GradingState represents the complete state of a grading run
 */
export interface GradingState {
  phase: Phase;
  document?: {
    text: string;
    title?: string;
    wasTruncated?: boolean;
  };
  judges: {
    rater_a?: JudgeState;
    rater_b?: JudgeState;
    rater_c?: JudgeState;
  };
  consensus?: ConsensusOutputType;
  error?: string;
  wasTruncated?: boolean;
}

/**
 * Initial state for a new grading session
 */
export const INITIAL_GRADING_STATE: GradingState = {
  phase: "idle",
  judges: {},
};
