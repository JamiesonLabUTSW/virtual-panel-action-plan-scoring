/**
 * CopilotKit agent for the multi-judge grading pipeline
 *
 * Wraps runGradingPipeline as an AbstractAgent, converting orchestrator's
 * emitState callbacks to AG-UI STATE_SNAPSHOT events for live frontend updates.
 *
 * @see {@link SPEC.md} §5.2 for agent specification
 */

import { AbstractAgent, EventType } from "@ag-ui/client";
import type { BaseEvent, RunAgentInput } from "@ag-ui/client";
import type { GradingState } from "@shared/types";
import { INITIAL_GRADING_STATE } from "@shared/types";
import { Observable } from "rxjs";
import { runGradingPipeline } from "../grading/orchestrator";

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
      let cancelled = false;

      (async () => {
        try {
          // EMIT: Run started
          subscriber.next({
            type: EventType.RUN_STARTED,
            threadId: input.threadId,
            runId: input.runId,
          } as BaseEvent);

          // Get proposal params from input state
          const state = (input.state ?? {}) as Partial<GradingState>;
          const proposalId = state.proposal?.id ?? 1;
          const proposalTitle = state.proposal?.title;
          const actionItems = state.proposal?.actionItems ?? [];

          // Early validation: ensure actionItems is non-empty
          if (!actionItems || actionItems.length === 0) {
            if (!cancelled) {
              subscriber.next({
                type: EventType.STATE_SNAPSHOT,
                snapshot: {
                  phase: "error",
                  judges: {},
                  error:
                    "No action items provided. Submit at least 1 action item to begin evaluation.",
                } as GradingState,
              } as BaseEvent);

              subscriber.next({
                type: EventType.RUN_ERROR,
                message: "No action items provided",
              } as BaseEvent);
            }

            subscriber.next({
              type: EventType.RUN_FINISHED,
              threadId: input.threadId,
              runId: input.runId,
            } as BaseEvent);

            subscriber.complete();
            return;
          }

          // Emit initial idle state
          if (!cancelled) {
            subscriber.next({
              type: EventType.STATE_SNAPSHOT,
              snapshot: INITIAL_GRADING_STATE,
            } as BaseEvent);
          }

          // Run grading pipeline with emitState callback
          const result = await runGradingPipeline({
            proposalId,
            proposalTitle,
            actionItems,
            emitState: (partialState) => {
              if (!cancelled) {
                subscriber.next({
                  type: EventType.STATE_SNAPSHOT,
                  snapshot: partialState,
                } as BaseEvent);
              }
            },
          });

          if (!cancelled) {
            // Emit final state
            subscriber.next({
              type: EventType.STATE_SNAPSHOT,
              snapshot: result,
            } as BaseEvent);

            // Emit run finished
            subscriber.next({
              type: EventType.RUN_FINISHED,
              threadId: input.threadId,
              runId: input.runId,
            } as BaseEvent);
          }

          subscriber.complete();
        } catch (error) {
          if (!cancelled) {
            subscriber.next({
              type: EventType.RUN_ERROR,
              message: error instanceof Error ? error.message : String(error),
            } as BaseEvent);
          }

          subscriber.complete();
        }
      })();

      // Cleanup on unsubscribe (handles cancellation)
      return () => {
        cancelled = true;
      };
    });
  }
}
