import { useCoAgent, useCopilotChat } from "@copilotkit/react-core";
import { useAgent } from "@copilotkitnext/react";
import type { GradingState } from "@shared/types";
import { INITIAL_GRADING_STATE } from "@shared/types";
import { useCallback, useState } from "react";
import ChatSidebar from "./ChatSidebar";
import ConsensusPanel from "./ConsensusPanel";
import DocumentInput from "./DocumentInput";
import DownloadRunButton from "./DownloadRunButton";
import GradingTimeline from "./GradingTimeline";
import JudgeCards from "./JudgeCards";

export default function GradingView() {
  const { state, setState } = useCoAgent<GradingState>({
    name: "gradeDocument",
    initialState: INITIAL_GRADING_STATE,
  });

  const { agent } = useAgent({ agentId: "gradeDocument" });
  const { isLoading } = useCopilotChat();

  const [hasStarted, setHasStarted] = useState(false);

  const handleSubmit = useCallback(
    async (title: string, text: string) => {
      const items = text
        .split("\n")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      if (items.length === 0) return;

      setState((prev) => ({
        ...(prev ?? INITIAL_GRADING_STATE),
        phase: "evaluating",
        proposal: {
          id: Date.now(),
          title,
          actionItems: items,
        },
        judges: {},
        consensus: undefined,
        error: undefined,
      }));

      setHasStarted(true);
      await agent.runAgent();
    },
    [agent, setState]
  );

  const handleReset = useCallback(() => {
    setState(INITIAL_GRADING_STATE);
    setHasStarted(false);
  }, [setState]);

  const phase = state?.phase ?? "idle";
  const isIdle = phase === "idle" && !hasStarted;
  const showResults = hasStarted || phase !== "idle";

  const showChat = phase === "done" && state != null;

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <header className="border-b border-surface-700 px-6 py-5">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-accent to-purple-400 bg-clip-text text-transparent">
          Multi-Judge Grading Panel
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          AI-calibrated evaluation by three expert judges with consensus arbitration
        </p>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Document Input (idle state) */}
            {isIdle && <DocumentInput onSubmit={handleSubmit} disabled={isLoading} />}

            {/* Grading results */}
            {showResults && (
              <div className="space-y-8">
                {/* Timeline */}
                {state && <GradingTimeline state={state} />}

                {/* Error banner */}
                {phase === "error" && state?.error && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-center justify-between animate-fade-in">
                    <p className="text-sm text-red-400">{state.error}</p>
                    <button
                      type="button"
                      onClick={handleReset}
                      className="text-sm text-red-400 hover:text-red-300 underline underline-offset-2 ml-4 flex-shrink-0"
                    >
                      Try Again
                    </button>
                  </div>
                )}

                {/* Judge cards */}
                {state && <JudgeCards state={state} />}

                {/* Consensus */}
                {state && <ConsensusPanel state={state} />}

                {/* Done actions */}
                {phase === "done" && state && (
                  <div className="flex items-center justify-between pt-4 border-t border-surface-700 animate-fade-in">
                    <DownloadRunButton state={state} />
                    <button
                      type="button"
                      onClick={handleReset}
                      className="inline-flex items-center gap-2 text-sm bg-accent hover:bg-accent-light
                        text-white font-medium rounded-lg px-4 py-2 transition-colors"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
                      </svg>
                      Grade Another Proposal
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </main>

        {/* Chat sidebar (appears after grading completes) */}
        {showChat && <ChatSidebar state={state} />}
      </div>
    </div>
  );
}
