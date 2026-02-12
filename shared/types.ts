import type { ConsensusOutputType, JudgeOutputType } from "./schemas";

/**
 * Phase represents the current state of the grading process
 */
export type Phase = "idle" | "rater_a" | "rater_b" | "rater_c" | "consensus" | "done" | "error";

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
  proposal?: {
    id: number;
    title?: string;
    actionItems: string[];
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

/**
 * TestState for validating state emission pipeline (Phase 2.4)
 * TODO: Remove before Phase 4 when real grading UI is implemented
 */
export interface TestState {
  step: number;
  message?: string;
}

/**
 * Initial state for test action
 */
export const INITIAL_TEST_STATE: TestState = {
  step: 0,
};
