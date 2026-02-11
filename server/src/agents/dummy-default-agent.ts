import { AbstractAgent, EventType } from "@ag-ui/client";
import type { BaseEvent, RunAgentInput } from "@ag-ui/client";
import { Observable } from "rxjs";

/**
 * Dummy 'default' agent to satisfy CopilotKit provider's requirement.
 * CopilotKit's internal CopilotListeners always looks for a 'default' agent.
 * When only custom agents are registered, the provider crashes without this.
 * TODO: Remove when we figure out proper multi-agent + chat coexistence pattern.
 */
export class DummyDefaultAgent extends AbstractAgent {
  constructor() {
    super({
      agentId: "default",
      description: "Placeholder default agent for CopilotKit provider compatibility",
    });
  }

  run(_input: RunAgentInput): Observable<BaseEvent> {
    return new Observable((subscriber) => {
      subscriber.next({ type: EventType.RUN_STARTED } as BaseEvent);
      subscriber.next({ type: EventType.RUN_FINISHED } as BaseEvent);
      subscriber.complete();
    });
  }
}
