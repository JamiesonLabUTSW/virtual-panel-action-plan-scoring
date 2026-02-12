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

          // Read proposal from input.state (AG-UI standard)
          const rawState = input.state ?? {};
          const state = rawState as Partial<GradingState>;
          const proposal = state.proposal;
          const proposalId = proposal?.id ?? 1;
          const proposalTitle = proposal?.title;
          const actionItems = proposal?.actionItems ?? [];

          console.info(
            `[agent] received state keys=${Object.keys(rawState).join(",")} actionItems=${actionItems.length}`
          );

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

            // AG-UI does not allow events after RUN_ERROR, so just complete.
            subscriber.complete();
            return;
          }

          // State accumulator: deep-merge partial updates before emitting full snapshots
          let currentState: Record<string, unknown> = { ...INITIAL_GRADING_STATE };

          // Emit initial idle state
          if (!cancelled) {
            subscriber.next({
              type: EventType.STATE_SNAPSHOT,
              snapshot: currentState,
            } as BaseEvent);
          }

          // Run grading pipeline with emitState callback
          const result = await runGradingPipeline({
            proposalId,
            proposalTitle,
            actionItems,
            emitState: (partialState) => {
              currentState = { ...currentState, ...partialState };
              if (!cancelled) {
                subscriber.next({
                  type: EventType.STATE_SNAPSHOT,
                  snapshot: currentState,
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
