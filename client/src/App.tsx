import { CopilotKit } from "@copilotkit/react-core";
import { CopilotChat } from "@copilotkit/react-ui";
import "@copilotkit/react-ui/styles.css";
import { INITIAL_GRADING_STATE } from "@shared/types";

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
          <p style={{ margin: "0.5rem 0 0 0", color: "#666" }}>Azure OpenAI gpt-5.1-codex-mini</p>
        </header>

        <div style={{ flex: 1, overflow: "hidden" }}>
          <CopilotChat />
        </div>

        <footer
          style={{
            padding: "1rem",
            backgroundColor: "#f9f9f9",
            borderTop: "1px solid #ddd",
            fontSize: "0.875rem",
            color: "#666",
          }}
        >
          ✓ CopilotKit configured | State: {INITIAL_GRADING_STATE.phase}
        </footer>
      </div>
    </CopilotKit>
  );
}
