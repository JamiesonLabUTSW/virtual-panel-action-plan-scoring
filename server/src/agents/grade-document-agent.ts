/**
 * CopilotKit agent for the multi-judge grading pipeline
 *
 * Wraps runGradingPipeline as an AbstractAgent, converting orchestrator's
 * emitState callbacks to AG-UI STATE_SNAPSHOT events for live frontend updates.
 *
 * @see {@link SPEC.md} §5.2 for agent specification
 */

import type { BaseEvent, RunAgentInput } from "@ag-ui/client";
import { AbstractAgent, EventType } from "@ag-ui/client";
import type { GradingState } from "@shared/types";
import { INITIAL_GRADING_STATE } from "@shared/types";
import { Observable } from "rxjs";
import { runGradingPipeline } from "../grading/orchestrator";
import { logger } from "../utils/logger";

const agentLogger = logger.child({ component: "gradeDocumentAgent" });

interface ValidatedInput {
  proposalId: number;
  proposalTitle: string | undefined;
  actionItems: string[];
}

function validateAgentInput(rawState: unknown): ValidatedInput {
  const state = (rawState ?? {}) as Partial<GradingState>;
  const proposal = state.proposal;
  const proposalId = proposal?.id ?? 1;
  const proposalTitle = proposal?.title;
  const actionItems = proposal?.actionItems ?? [];

  if (!actionItems || actionItems.length === 0) {
    throw new Error("No action items provided");
  }

  return { proposalId, proposalTitle, actionItems };
}

function createGuardedEmitter(
  subscriber: { next: (event: BaseEvent) => void },
  cancelledRef: { current: boolean }
) {
  return function emit(event: BaseEvent): void {
    if (!cancelledRef.current) {
      subscriber.next(event);
    }
  };
}

/**
 * CopilotKit agent that orchestrates the multi-judge grading pipeline
 *
 * Converts emitState callbacks from the orchestrator into AG-UI STATE_SNAPSHOT
 * events, enabling real-time progressive UI updates as judges execute.
 */
export class GradeDocumentAgent extends AbstractAgent {
  constructor() {
    super({
      agentId: "gradeDocument",
      description:
        "Multi-judge grading pipeline with 3 evaluators (Rater A, B, C) and consensus arbiter",
    });
  }

  run(input: RunAgentInput): Observable<BaseEvent> {
    return new Observable((subscriber) => {
      const cancelledRef = { current: false };
      const emit = createGuardedEmitter(subscriber, cancelledRef);

      (async () => {
        try {
          emit({
            type: EventType.RUN_STARTED,
            threadId: input.threadId,
            runId: input.runId,
          } as BaseEvent);

          const rawState = input.state ?? {};
          const { proposalId, proposalTitle, actionItems } = validateAgentInput(rawState);

          agentLogger.info(
            { stateKeys: Object.keys(rawState), actionItemCount: actionItems.length },
            "Agent input received"
          );

          let currentState: Record<string, unknown> = { ...INITIAL_GRADING_STATE };

          emit({
            type: EventType.STATE_SNAPSHOT,
            snapshot: currentState,
          } as BaseEvent);

          const result = await runGradingPipeline({
            proposalId,
            proposalTitle,
            actionItems,
            emitState: (partialState) => {
              currentState = { ...currentState, ...partialState };
              emit({
                type: EventType.STATE_SNAPSHOT,
                snapshot: currentState,
              } as BaseEvent);
            },
          });

          emit({
            type: EventType.STATE_SNAPSHOT,
            snapshot: result,
          } as BaseEvent);

          emit({
            type: EventType.RUN_FINISHED,
            threadId: input.threadId,
            runId: input.runId,
          } as BaseEvent);

          subscriber.complete();
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);

          emit({
            type: EventType.STATE_SNAPSHOT,
            snapshot: {
              phase: "error",
              judges: {},
              error:
                errorMessage === "No action items provided"
                  ? "No action items provided. Submit at least 1 action item to begin evaluation."
                  : errorMessage,
            } as GradingState,
          } as BaseEvent);

          emit({
            type: EventType.RUN_ERROR,
            message: errorMessage,
          } as BaseEvent);

          subscriber.complete();
        }
      })();

      return () => {
        cancelledRef.current = true;
      };
    });
  }
}
