import { EventType } from "@ag-ui/client";
import type { BaseEvent } from "@ag-ui/client";
import { firstValueFrom, toArray } from "rxjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the grading pipeline
const mockRunGradingPipeline = vi.fn();

vi.mock("../../grading/orchestrator", () => ({
  runGradingPipeline: mockRunGradingPipeline,
}));

const { GradeDocumentAgent } = (await import("../grade-document-agent")) as any;

/**
 * Collect all events from the agent Observable
 */
function collectEvents(agent: any, input: any): Promise<BaseEvent[]> {
  return firstValueFrom(agent.run(input).pipe(toArray()));
}

describe("GradeDocumentAgent", () => {
  let agent: any;

  beforeEach(() => {
    agent = new GradeDocumentAgent();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const baseInput = {
    threadId: "thread-1",
    runId: "run-1",
    state: {
      proposal: {
        id: 42,
        title: "Test Proposal",
        actionItems: ["Item 1", "Item 2"],
      },
    },
  };

  it("has correct agentId", () => {
    expect(agent.agentId).toBe("gradeDocument");
  });

  it("happy path: emits RUN_STARTED → STATE_SNAPSHOTs → RUN_FINISHED", async () => {
    const finalState = {
      phase: "done",
      judges: {
        rater_a: { status: "done", label: "Rater A", result: { overall_score: 4 } },
      },
      consensus: { final_score: 4 },
    };

    mockRunGradingPipeline.mockImplementation(async ({ emitState }: any) => {
      emitState({ phase: "evaluating", judges: {} });
      emitState({ judges: { rater_a: { status: "done", label: "Rater A" } } });
      return finalState;
    });

    const events = await collectEvents(agent, baseInput);
    const types = events.map((e) => e.type);

    expect(types[0]).toBe(EventType.RUN_STARTED);
    expect(types).toContain(EventType.STATE_SNAPSHOT);
    expect(types[types.length - 1]).toBe(EventType.RUN_FINISHED);

    // Verify pipeline was called with correct params
    expect(mockRunGradingPipeline).toHaveBeenCalledTimes(1);
    const callArgs = mockRunGradingPipeline.mock.calls[0][0];
    expect(callArgs.proposalId).toBe(42);
    expect(callArgs.actionItems).toEqual(["Item 1", "Item 2"]);
  });

  it("state accumulator merges partial updates", async () => {
    mockRunGradingPipeline.mockImplementation(async ({ emitState }: any) => {
      // Emit partial state without phase
      emitState({ judges: { rater_a: { status: "done", label: "Rater A" } } });
      return { phase: "done", judges: {} };
    });

    const events = await collectEvents(agent, baseInput);
    const snapshots = events
      .filter((e) => e.type === EventType.STATE_SNAPSHOT)
      .map((e) => (e as any).snapshot);

    // The accumulated state should have both phase (from initial) and judges (from partial)
    const lastPipelineSnapshot = snapshots[snapshots.length - 2]; // Before final state
    expect(lastPipelineSnapshot.phase).toBeDefined();
    expect(lastPipelineSnapshot.judges).toBeDefined();
  });

  it("empty action items: emits error state + RUN_ERROR (no RUN_FINISHED)", async () => {
    const input = {
      ...baseInput,
      state: {
        proposal: {
          id: 1,
          actionItems: [],
        },
      },
    };

    const events = await collectEvents(agent, input);
    const types = events.map((e) => e.type);

    expect(types).toContain(EventType.RUN_STARTED);
    expect(types).toContain(EventType.STATE_SNAPSHOT);
    expect(types).toContain(EventType.RUN_ERROR);
    // AG-UI does not allow events after RUN_ERROR
    expect(types).not.toContain(EventType.RUN_FINISHED);

    // Pipeline should not have been called
    expect(mockRunGradingPipeline).not.toHaveBeenCalled();

    // Error state should have phase "error"
    const errorSnapshot = events.find(
      (e) => e.type === EventType.STATE_SNAPSHOT && (e as any).snapshot?.phase === "error"
    );
    expect(errorSnapshot).toBeDefined();
  });

  it("pipeline error: emits RUN_ERROR and completes", async () => {
    mockRunGradingPipeline.mockRejectedValueOnce(new Error("Pipeline exploded"));

    const events = await collectEvents(agent, baseInput);
    const types = events.map((e) => e.type);

    expect(types).toContain(EventType.RUN_STARTED);
    expect(types).toContain(EventType.RUN_ERROR);

    // Should find error message
    const errorEvent = events.find((e) => e.type === EventType.RUN_ERROR);
    expect((errorEvent as any).message).toBe("Pipeline exploded");
  });

  it("missing state.proposal: emits RUN_ERROR for empty action items", async () => {
    const input = {
      threadId: "thread-1",
      runId: "run-1",
      state: {},
    };

    const events = await collectEvents(agent, input);
    const types = events.map((e) => e.type);

    // With no proposal in state, actionItems is empty → validation error
    expect(types).toContain(EventType.RUN_ERROR);
    expect(mockRunGradingPipeline).not.toHaveBeenCalled();
  });

  it("cancellation: unsubscribe prevents further emissions", async () => {
    let emitStateFn: ((state: any) => void) | undefined;

    mockRunGradingPipeline.mockImplementation(async ({ emitState }: any) => {
      emitStateFn = emitState;
      // Simulate a long-running pipeline by returning a promise that resolves after emissions
      await new Promise((resolve) => setTimeout(resolve, 50));
      return { phase: "done", judges: {} };
    });

    const events: BaseEvent[] = [];
    const observable = agent.run(baseInput);
    const subscription = observable.subscribe({
      next: (event: BaseEvent) => events.push(event),
    });

    // Wait for pipeline to start
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Cancel
    subscription.unsubscribe();

    // Try emitting after cancellation — should be a no-op
    if (emitStateFn) {
      emitStateFn({ phase: "should-not-appear" });
    }

    // The events collected before cancellation should not include the post-cancel emission
    const postCancelSnapshots = events.filter(
      (e) =>
        e.type === EventType.STATE_SNAPSHOT && (e as any).snapshot?.phase === "should-not-appear"
    );
    expect(postCancelSnapshots).toHaveLength(0);
  });
});
