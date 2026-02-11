import { AbstractAgent, EventType } from "@ag-ui/client";
import type { BaseEvent, RunAgentInput } from "@ag-ui/client";
import { Observable } from "rxjs";

/**
 * Test agent for validating the AG-UI state emission pipeline.
 * Emits 3 STATE_SNAPSHOT events with 1-second delays (simulating judge progression).
 * TODO: Remove before Phase 4 when real GradeDocumentAgent is implemented.
 */
export class TestAgent extends AbstractAgent {
  constructor() {
    super({
      agentId: "testAgent",
      description:
        "Test agent that emits 3 progressive STATE_SNAPSHOT events to validate the AG-UI streaming pipeline",
    });
  }

  run(input: RunAgentInput): Observable<BaseEvent> {
    return new Observable((subscriber) => {
      let cancelled = false;

      (async () => {
        try {
          subscriber.next({
            type: EventType.RUN_STARTED,
            threadId: input.threadId,
            runId: input.runId,
          } as BaseEvent);

          // Initial state
          subscriber.next({
            type: EventType.STATE_SNAPSHOT,
            snapshot: { step: 0, message: "Starting test agent..." },
          } as BaseEvent);

          for (let step = 1; step <= 3; step++) {
            if (cancelled) return;

            subscriber.next({
              type: EventType.STEP_STARTED,
              stepName: `step_${step}`,
            } as BaseEvent);

            // Wait 1 second (simulating judge work)
            await new Promise((resolve) => {
              setTimeout(resolve, 1000);
            });

            if (cancelled) return;

            subscriber.next({
              type: EventType.STATE_SNAPSHOT,
              snapshot: { step, message: `Completed step ${step} of 3` },
            } as BaseEvent);

            subscriber.next({
              type: EventType.STEP_FINISHED,
              stepName: `step_${step}`,
            } as BaseEvent);
          }

          subscriber.next({
            type: EventType.RUN_FINISHED,
            threadId: input.threadId,
            runId: input.runId,
          } as BaseEvent);

          subscriber.complete();
        } catch (error) {
          subscriber.next({
            type: EventType.RUN_ERROR,
            message: error instanceof Error ? error.message : String(error),
          } as BaseEvent);
          subscriber.complete();
        }
      })();

      // Cleanup on unsubscribe
      return () => {
        cancelled = true;
      };
    });
  }
}
