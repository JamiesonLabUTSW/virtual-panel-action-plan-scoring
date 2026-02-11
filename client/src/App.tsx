import { CopilotKit } from "@copilotkit/react-core";
import { CopilotChat } from "@copilotkit/react-ui";
import "@copilotkit/react-ui/styles.css";
import { useCoAgent, useCoAgentStateRender } from "@copilotkit/react-core";
import { useAgent } from "@copilotkitnext/react";

interface TestState {
  step: number;
  message?: string;
}

const INITIAL_TEST_STATE: TestState = {
  step: 0,
};

/**
 * Phase 2: CopilotKit agent integration test.
 * TestAgentView validates the AG-UI state emission pipeline.
 * CopilotChat verifies chat still works alongside agent.
 * TODO: Replace with full grading UI in Phase 4.
 */

function TestAgentView() {
  const { state, running } = useCoAgent<TestState>({
    name: "testAgent",
    initialState: INITIAL_TEST_STATE,
  });

  // WORKAROUND: useCoAgent.run() is broken — it returns agent.runAgent as a detached
  // method reference, losing `this` context. HttpAgent.runAgent() then fails with
  // "Cannot set properties of undefined (setting 'abortController')".
  // Use useAgent() to get the actual agent instance and call runAgent() as a method call.
  const { agent } = useAgent({ agentId: "testAgent" });

  useCoAgentStateRender<TestState>({
    name: "testAgent",
    render: ({ state, status }) => {
      if (!state) return null;
      return (
        <div
          style={{
            padding: "0.75rem",
            backgroundColor: status === "complete" ? "#e8f5e9" : "#e3f2fd",
            border: `1px solid ${status === "complete" ? "#a5d6a7" : "#90caf9"}`,
            borderRadius: "4px",
            margin: "0.5rem 0",
          }}
        >
          <strong>Agent State:</strong> Step {state.step}/3
          {state.message && <span> — {state.message}</span>}
        </div>
      );
    },
  });

  return (
    <div
      style={{
        padding: "2rem",
        borderBottom: "2px solid #ddd",
        backgroundColor: "#fafafa",
      }}
    >
      <h2 style={{ marginTop: 0 }}>Test Agent: State Emission Validation</h2>
      <p style={{ color: "#666", fontSize: "0.9rem" }}>
        Validates the AbstractAgent → Observable → STATE_SNAPSHOT → useCoAgent pipeline.
      </p>

      <button
        type="button"
        onClick={() => agent.runAgent()}
        disabled={running}
        style={{
          padding: "0.5rem 1rem",
          backgroundColor: running ? "#ccc" : "#4caf50",
          color: "white",
          border: "none",
          borderRadius: "4px",
          cursor: running ? "not-allowed" : "pointer",
          fontSize: "0.9rem",
          fontWeight: "bold",
          marginBottom: "1.5rem",
        }}
      >
        {running ? "Running..." : "Trigger Test Agent"}
      </button>

      <div>
        <h3 style={{ marginTop: 0, marginBottom: "1rem" }}>Current State:</h3>
        <div
          style={{
            padding: "1rem",
            backgroundColor: "white",
            border: "1px solid #ddd",
            borderRadius: "4px",
            marginBottom: "1rem",
          }}
        >
          <p style={{ margin: "0.5rem 0" }}>
            <strong>Step:</strong> {state.step}
          </p>
          <p style={{ margin: "0.5rem 0" }}>
            <strong>Message:</strong> {state.message || "(not set)"}
          </p>
          <p style={{ margin: "0.5rem 0" }}>
            <strong>Running:</strong> {running ? "Yes" : "No"}
          </p>
        </div>

        {/* Visual step indicator */}
        <div style={{ marginBottom: "1rem" }}>
          <p style={{ margin: "0 0 0.5rem 0", fontSize: "0.9rem", fontWeight: "bold" }}>
            Progress:
          </p>
          <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
            {[1, 2, 3].map((stepNum) => (
              <div
                key={stepNum}
                style={{
                  width: "60px",
                  height: "60px",
                  borderRadius: "50%",
                  backgroundColor: state.step >= stepNum ? "#4caf50" : "#e0e0e0",
                  color: state.step >= stepNum ? "white" : "#999",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: "bold",
                  fontSize: "1.2rem",
                  transition: "background-color 0.3s ease",
                }}
              >
                {stepNum}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <CopilotKit runtimeUrl="/api/copilotkit">
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100vh",
          fontFamily: "sans-serif",
        }}
      >
        <header
          style={{
            padding: "1.5rem",
            backgroundColor: "#f5f5f5",
            borderBottom: "1px solid #ddd",
          }}
        >
          <h1 style={{ margin: "0" }}>Multi-Judge Grading Demo</h1>
          <p style={{ margin: "0.5rem 0 0 0", color: "#666" }}>
            Phase 2: CopilotKit Agent + Azure OpenAI gpt-5.1-codex-mini
          </p>
        </header>

        <TestAgentView />

        {/* CopilotChat mounted hidden — useCoAgent.run() requires the chat infrastructure
            (abortControllerRef, connectAgent) to be initialized. Without a mounted CopilotChat,
            run() throws "Cannot set properties of undefined (setting 'abortController')".
            See: https://github.com/CopilotKit/CopilotKit/issues/2060
            TODO: Make visible in Phase 4 when full grading UI is built. */}
        <div style={{ display: "none" }}>
          <CopilotChat
            instructions="You are a helpful assistant for the Multi-Judge Grading Demo."
            labels={{
              title: "CopilotKit Chat",
              initial: "Chat initialized.",
            }}
          />
        </div>
      </div>
    </CopilotKit>
  );
}
