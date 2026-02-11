import { EventType } from "@ag-ui/client";
import type { BaseEvent, RunAgentInput } from "@ag-ui/client";
import { describe, expect, it } from "vitest";
import { TestAgent } from "../agents/test-agent";

/**
 * Unit tests for TestAgent Observable event stream (Issues #19).
 * Validates the AbstractAgent → Observable → STATE_SNAPSHOT pipeline.
 */

const TEST_INPUT: RunAgentInput = {
  threadId: "test-thread",
  runId: "test-run",
  messages: [],
  state: {},
  tools: [],
  context: [],
};

function collectEvents(agent: TestAgent): Promise<BaseEvent[]> {
  return new Promise((resolve, reject) => {
    const events: BaseEvent[] = [];
    const observable = agent.run(TEST_INPUT);

    observable.subscribe({
      next: (event) => events.push(event),
      error: (err) => reject(err),
      complete: () => resolve(events),
    });
  });
}

describe("TestAgent Observable event stream", () => {
  it("should emit RUN_STARTED as the first event", async () => {
    const agent = new TestAgent();
    const events = await collectEvents(agent);

    expect(events.length).toBeGreaterThan(0);
    expect(events[0].type).toBe(EventType.RUN_STARTED);
  });

  it("should emit RUN_FINISHED as the last event", async () => {
    const agent = new TestAgent();
    const events = await collectEvents(agent);

    expect(events.length).toBeGreaterThan(0);
    expect(events[events.length - 1].type).toBe(EventType.RUN_FINISHED);
  });

  it("should emit STATE_SNAPSHOT events with steps 0, 1, 2, 3", async () => {
    const agent = new TestAgent();
    const events = await collectEvents(agent);

    const snapshots = events.filter((e) => e.type === EventType.STATE_SNAPSHOT);
    expect(snapshots.length).toBe(4); // initial (0) + 3 steps

    const steps = snapshots.map((e) => (e as any).snapshot.step);
    expect(steps).toEqual([0, 1, 2, 3]);
  });

  it("should emit 3 paired STEP_STARTED/STEP_FINISHED events", async () => {
    const agent = new TestAgent();
    const events = await collectEvents(agent);

    const stepStarted = events.filter((e) => e.type === EventType.STEP_STARTED);
    const stepFinished = events.filter((e) => e.type === EventType.STEP_FINISHED);

    expect(stepStarted.length).toBe(3);
    expect(stepFinished.length).toBe(3);

    // Verify step names
    const startNames = stepStarted.map((e) => (e as any).stepName);
    expect(startNames).toEqual(["step_1", "step_2", "step_3"]);
  });

  it("should emit events in correct order", async () => {
    const agent = new TestAgent();
    const events = await collectEvents(agent);

    const types = events.map((e) => e.type);

    // Verify overall structure
    expect(types[0]).toBe(EventType.RUN_STARTED);
    expect(types[1]).toBe(EventType.STATE_SNAPSHOT); // step 0
    expect(types[types.length - 1]).toBe(EventType.RUN_FINISHED);

    // Each step block: STEP_STARTED → STATE_SNAPSHOT → STEP_FINISHED
    for (let i = 0; i < 3; i++) {
      const blockStart = 2 + i * 3; // offset past RUN_STARTED + initial snapshot
      expect(types[blockStart]).toBe(EventType.STEP_STARTED);
      expect(types[blockStart + 1]).toBe(EventType.STATE_SNAPSHOT);
      expect(types[blockStart + 2]).toBe(EventType.STEP_FINISHED);
    }
  });

  it("should take approximately 3 seconds to complete", async () => {
    const agent = new TestAgent();
    const startTime = Date.now();
    await collectEvents(agent);
    const duration = Date.now() - startTime;

    expect(duration).toBeGreaterThanOrEqual(2900);
    expect(duration).toBeLessThan(5000);
  });
});
