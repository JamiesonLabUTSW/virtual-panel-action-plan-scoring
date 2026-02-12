import { CopilotKit } from "@copilotkit/react-core";
import { CopilotChat } from "@copilotkit/react-ui";
import "@copilotkit/react-ui/styles.css";
import { useCoAgent, useCopilotChat } from "@copilotkit/react-core";
import { useAgent } from "@copilotkitnext/react";
import type { GradingState } from "@shared/types";
import { INITIAL_GRADING_STATE } from "@shared/types";
import { useState } from "react";

/**
 * Minimal grading UI for Phase 4.5-4.7
 *
 * Validates the multi-judge pipeline end-to-end with live state updates.
 * Will be replaced by full UI in Phase 5.
 */

// Sample action items for dropdown
const ACTION_ITEM_EXAMPLES: Record<string, string[]> = {
  "Surgery Program": [
    "Implement progressive-responsibility framework for junior residents",
    "Establish structured mentorship program with faculty pairing",
    "Create monthly case review sessions with outcomes tracking",
  ],
  "Emergency Medicine": [
    "Launch resuscitation skill refresher training quarterly",
    "Develop trauma response protocol with simulation drills",
    "Implement peer review process for critical procedures",
  ],
  "Internal Medicine": [
    "Establish morning report teaching with case presentations",
    "Create rotational curriculum with defined learning objectives",
    "Launch quality improvement project with measurable metrics",
  ],
};

function ProposalInput({
  proposalTitle,
  setProposalTitle,
  actionItemsInput,
  setActionItemsInput,
  selectedExample,
  setSelectedExample,
  isLoading,
  onGrade,
}: {
  proposalTitle: string;
  setProposalTitle: (v: string) => void;
  actionItemsInput: string;
  setActionItemsInput: (v: string) => void;
  selectedExample: string;
  setSelectedExample: (v: string) => void;
  isLoading: boolean;
  onGrade: () => void;
}) {
  const handleExampleChange = (programName: string) => {
    setSelectedExample(programName);
    if (programName && ACTION_ITEM_EXAMPLES[programName]) {
      setActionItemsInput(ACTION_ITEM_EXAMPLES[programName].join("\n"));
    }
  };

  return (
    <div
      style={{
        backgroundColor: "white",
        border: "1px solid #ddd",
        borderRadius: "4px",
        padding: "1.5rem",
        marginBottom: "1.5rem",
      }}
    >
      <h3 style={{ marginTop: 0, marginBottom: "1rem" }}>Proposal Input</h3>

      {/* Proposal Title */}
      <div style={{ marginBottom: "1rem" }}>
        <label
          htmlFor="proposal-title"
          style={{ display: "block", marginBottom: "0.5rem", fontWeight: "bold" }}
        >
          Proposal Title (optional):
        </label>
        <input
          id="proposal-title"
          type="text"
          value={proposalTitle}
          onChange={(e) => setProposalTitle(e.target.value)}
          placeholder="Enter proposal title..."
          disabled={isLoading}
          style={{
            width: "100%",
            padding: "0.5rem",
            borderRadius: "4px",
            border: "1px solid #ccc",
            boxSizing: "border-box",
            opacity: isLoading ? 0.6 : 1,
          }}
        />
      </div>

      {/* Example Dropdown */}
      <div style={{ marginBottom: "1rem" }}>
        <label
          htmlFor="example-select"
          style={{ display: "block", marginBottom: "0.5rem", fontWeight: "bold" }}
        >
          Load Example:
        </label>
        <select
          id="example-select"
          value={selectedExample}
          onChange={(e) => handleExampleChange(e.target.value)}
          disabled={isLoading}
          style={{
            width: "100%",
            padding: "0.5rem",
            borderRadius: "4px",
            border: "1px solid #ccc",
            opacity: isLoading ? 0.6 : 1,
          }}
        >
          <option value="">-- Select a program --</option>
          {Object.keys(ACTION_ITEM_EXAMPLES).map((program) => (
            <option key={program} value={program}>
              {program}
            </option>
          ))}
        </select>
      </div>

      {/* Action Items */}
      <div style={{ marginBottom: "1rem" }}>
        <label
          htmlFor="action-items"
          style={{ display: "block", marginBottom: "0.5rem", fontWeight: "bold" }}
        >
          Action Items (one per line):
        </label>
        <textarea
          id="action-items"
          value={actionItemsInput}
          onChange={(e) => setActionItemsInput(e.target.value)}
          placeholder="1. Item one&#10;2. Item two&#10;3. Item three"
          disabled={isLoading}
          rows={5}
          style={{
            width: "100%",
            padding: "0.5rem",
            borderRadius: "4px",
            border: "1px solid #ccc",
            fontFamily: "monospace",
            fontSize: "0.85rem",
            boxSizing: "border-box",
            opacity: isLoading ? 0.6 : 1,
          }}
        />
      </div>

      {/* Grade Button */}
      <button
        type="button"
        onClick={onGrade}
        disabled={isLoading || actionItemsInput.trim().length === 0}
        style={{
          padding: "0.75rem 1.5rem",
          backgroundColor: isLoading ? "#ccc" : "#2196F3",
          color: "white",
          border: "none",
          borderRadius: "4px",
          cursor: isLoading ? "not-allowed" : "pointer",
          fontSize: "1rem",
          fontWeight: "bold",
        }}
      >
        {isLoading ? "Grading..." : "Grade Proposal"}
      </button>
    </div>
  );
}

function StatusDisplay({ state }: { state: GradingState | null }) {
  const phase = state?.phase ?? "idle";
  const judges = state?.judges ?? {};

  const getJudgeStatus = (judgeName: string) => {
    const judge = judges[judgeName as keyof typeof judges];
    if (!judge) return "pending";
    if (judge.status === "done") {
      return judge.result ? `✓ Done (${judge.result.overall_score}/5)` : "Done";
    }
    if (judge.status === "error") {
      return `✗ Error: ${judge.error || "Unknown error"}`;
    }
    return "Running...";
  };

  const phaseLabels: Record<string, string> = {
    idle: "Ready",
    evaluating: "Evaluating (All Judges)",
    rater_a: "Evaluating (Rater A)",
    rater_b: "Evaluating (Rater B)",
    rater_c: "Evaluating (Rater C)",
    consensus: "Consensus",
    done: "Complete",
    error: "Error",
  };

  return (
    <div
      style={{
        backgroundColor: "white",
        border: "1px solid #ddd",
        borderRadius: "4px",
        padding: "1.5rem",
      }}
    >
      <h3 style={{ marginTop: 0, marginBottom: "1rem" }}>Grading Status</h3>

      {/* Current Phase */}
      <div
        style={{
          padding: "1rem",
          backgroundColor: phase === "done" ? "#e8f5e9" : phase === "error" ? "#ffebee" : "#e3f2fd",
          border: `1px solid ${
            phase === "done" ? "#81c784" : phase === "error" ? "#ef5350" : "#64b5f6"
          }`,
          borderRadius: "4px",
          marginBottom: "1rem",
        }}
      >
        <p style={{ margin: "0 0 0.5rem 0" }}>
          <strong>Phase:</strong> {phaseLabels[phase]}
        </p>
        {state?.error && (
          <p style={{ margin: "0", color: "#c62828" }}>
            <strong>Error:</strong> {state.error}
          </p>
        )}
      </div>

      {/* Judge Status */}
      <div style={{ marginBottom: "1rem" }}>
        <p style={{ margin: "0 0 0.75rem 0", fontWeight: "bold" }}>Judge Evaluations:</p>
        <div style={{ display: "grid", gap: "0.75rem" }}>
          {["rater_a", "rater_b", "rater_c"].map((raterKey) => (
            <div
              key={raterKey}
              style={{
                padding: "0.75rem",
                backgroundColor: "#f5f5f5",
                border: "1px solid #e0e0e0",
                borderRadius: "4px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontWeight: "bold" }}>
                  {raterKey === "rater_a"
                    ? "Rater A (Professor)"
                    : raterKey === "rater_b"
                      ? "Rater B (Editor)"
                      : "Rater C (Practitioner)"}
                </span>
                <span>{getJudgeStatus(raterKey)}</span>
              </div>
              {judges[raterKey as keyof typeof judges]?.latencyMs && (
                <p style={{ margin: "0.5rem 0 0 0", fontSize: "0.85rem", color: "#666" }}>
                  Latency: {judges[raterKey as keyof typeof judges]?.latencyMs}ms
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Consensus Result */}
      {state?.consensus && (
        <div
          style={{
            padding: "1rem",
            backgroundColor: "#f3e5f5",
            border: "1px solid #ce93d8",
            borderRadius: "4px",
          }}
        >
          <p style={{ margin: "0 0 0.5rem 0", fontWeight: "bold" }}>
            Consensus Final Score: {state.consensus.final_score}/5
          </p>
          <p style={{ margin: "0", fontSize: "0.9rem", color: "#555" }}>
            Agreement Level: {state.consensus.agreement.agreement_level} (spread:{" "}
            {state.consensus.agreement.spread})
          </p>
        </div>
      )}

      {/* Full State Debug */}
      <details style={{ marginTop: "1.5rem" }}>
        <summary style={{ cursor: "pointer", fontWeight: "bold", color: "#666" }}>
          Full State (JSON)
        </summary>
        <pre
          style={{
            backgroundColor: "#f5f5f5",
            padding: "1rem",
            borderRadius: "4px",
            overflow: "auto",
            fontSize: "0.75rem",
            margin: "0.5rem 0 0 0",
          }}
        >
          {JSON.stringify(state, null, 2)}
        </pre>
      </details>
    </div>
  );
}

function GradingView() {
  const { state } = useCoAgent<GradingState>({
    name: "gradeDocument",
    initialState: INITIAL_GRADING_STATE,
  });

  // WORKAROUND: useCoAgent.run() is broken — use useAgent() to get agent instance
  const { agent } = useAgent({ agentId: "gradeDocument" });

  // Use useCopilotChat().isLoading for actual execution status (not useCoAgent.running)
  const { isLoading } = useCopilotChat();

  // Local state for input
  const [proposalTitle, setProposalTitle] = useState<string>("");
  const [actionItemsInput, setActionItemsInput] = useState<string>("");
  const [selectedExample, setSelectedExample] = useState<string>("");

  // Trigger grading pipeline
  const handleGrade = async () => {
    const items = actionItemsInput
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    if (items.length === 0) {
      alert("Please enter at least one action item");
      return;
    }

    // biome-ignore lint/suspicious/noExplicitAny: RunAgentInput is untyped in CopilotKit
    await agent.runAgent({
      proposal: {
        id: Date.now(),
        title: proposalTitle || "Untitled Proposal",
        actionItems: items,
      },
    } as any);
  };

  return (
    <div
      style={{
        padding: "2rem",
        borderBottom: "2px solid #ddd",
        backgroundColor: "#fafafa",
      }}
    >
      <h2 style={{ marginTop: 0 }}>Multi-Judge Grading Pipeline</h2>
      <p style={{ color: "#666", fontSize: "0.9rem" }}>
        Phase 4: Orchestrator + Agent + Frontend wiring. Live state updates as judges evaluate.
      </p>

      <ProposalInput
        proposalTitle={proposalTitle}
        setProposalTitle={setProposalTitle}
        actionItemsInput={actionItemsInput}
        setActionItemsInput={setActionItemsInput}
        selectedExample={selectedExample}
        setSelectedExample={setSelectedExample}
        isLoading={isLoading}
        onGrade={handleGrade}
      />

      <StatusDisplay state={state} />
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
            Phase 4: Multi-Judge Orchestrator + CopilotKit Agent + Live UI Updates
          </p>
        </header>

        <GradingView />

        {/* CopilotChat mounted hidden — useCoAgent requires the chat infrastructure
            (abortControllerRef, connectAgent) to be initialized. Without a mounted CopilotChat,
            the agent infrastructure crashes.
            See: https://github.com/CopilotKit/CopilotKit/issues/2060 */}
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
