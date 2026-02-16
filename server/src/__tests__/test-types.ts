import type { GradingState } from "@shared/types";
import type { invokeWithStructuredOutput } from "../grading/structured-output";

/**
 * Options for structured output invocation
 */
export type InvokeOptions = Parameters<typeof invokeWithStructuredOutput>[1];

/**
 * Callback function for emitting state updates during grading
 */
export type EmitStateCallback = (state: Partial<GradingState>) => void;
