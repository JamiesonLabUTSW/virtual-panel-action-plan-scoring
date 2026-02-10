import { INITIAL_GRADING_STATE } from "@shared/types";

export default function App() {
  return (
    <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>Multi-Judge Grading Demo</h1>
      <p>✓ @shared/types imported successfully</p>
      <pre style={{ backgroundColor: "#f5f5f5", padding: "1rem" }}>
        {JSON.stringify(INITIAL_GRADING_STATE, null, 2)}
      </pre>
      <p>Client and server workspaces are ready!</p>
    </div>
  );
}
