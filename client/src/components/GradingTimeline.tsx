import type { GradingState, JudgeState, Phase } from "@shared/types";
import { JUDGE_ORDER, JUDGE_PERSONAS } from "../utils/judge-personas";
import { getScoreStyle } from "../utils/score-colors";

interface GradingTimelineProps {
  state: GradingState;
}

type StepStatus = "pending" | "running" | "done" | "error";

interface TimelineStep {
  id: string;
  label: string;
  status: StepStatus;
  score?: number;
  latencyMs?: number;
  description?: string;
  accentHex: string;
}

function deriveSteps(state: GradingState): TimelineStep[] {
  const judgeSteps: TimelineStep[] = JUDGE_ORDER.map((raterId) => {
    const persona = JUDGE_PERSONAS[raterId];
    const judge: JudgeState | undefined = state.judges[raterId as keyof typeof state.judges];

    return {
      id: raterId,
      label: persona.title,
      status: judge?.status ?? "pending",
      score: judge?.result?.overall_score,
      latencyMs: judge?.latencyMs,
      description: judge?.status === "running" ? persona.focusDescription : undefined,
      accentHex: persona.accentHex,
    };
  });

  const consensusStatus: StepStatus =
    state.phase === "consensus"
      ? "running"
      : state.consensus
        ? "done"
        : state.phase === "error" && judgeSteps.every((s) => s.status !== "running")
          ? "error"
          : "pending";

  const consensusStep: TimelineStep = {
    id: "consensus",
    label: "Consensus",
    status: consensusStatus,
    score: state.consensus?.final_score,
    description: consensusStatus === "running" ? "Reconciling judge evaluations..." : undefined,
    accentHex: "#004c97",
  };

  return [...judgeSteps, consensusStep];
}

function getPhaseBanner(phase: Phase): string {
  switch (phase) {
    case "evaluating":
      return "All judges are evaluating the proposal in parallel...";
    case "rater_a":
    case "rater_b":
    case "rater_c":
      return "Judges are evaluating the proposal...";
    case "consensus":
      return "The arbiter is reconciling judge scores and rationales...";
    case "done":
      return "Evaluation complete. Review the results below.";
    case "error":
      return "An error occurred during evaluation.";
    default:
      return "";
  }
}

function StepCircle({ step, index }: { step: TimelineStep; index: number }) {
  if (step.status === "done") {
    return (
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold"
        style={{ backgroundColor: step.accentHex }}
      >
        <svg
          className="w-5 h-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={3}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
    );
  }

  if (step.status === "error") {
    return (
      <div className="w-10 h-10 rounded-full flex items-center justify-center bg-red-500 text-white text-sm font-bold">
        <svg
          className="w-5 h-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={3}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </div>
    );
  }

  if (step.status === "running") {
    return (
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold animate-pulse-ring"
        style={{ backgroundColor: "#009ee2" }}
      >
        {index + 1}
      </div>
    );
  }

  return (
    <div className="w-10 h-10 rounded-full flex items-center justify-center bg-surface-700 text-text-secondary text-sm font-medium">
      {index + 1}
    </div>
  );
}

function Connector({ completed }: { completed: boolean }) {
  return (
    <div className="flex-1 mx-1 sm:mx-2 h-0.5 rounded-full relative overflow-hidden bg-surface-700 min-w-[12px] sm:min-w-[24px]">
      <div
        className={`absolute inset-0 rounded-full transition-all duration-700 ease-out ${
          completed ? "bg-accent w-full" : "w-0"
        }`}
      />
    </div>
  );
}

export default function GradingTimeline({ state }: GradingTimelineProps) {
  const steps = deriveSteps(state);
  const banner = getPhaseBanner(state.phase);

  return (
    <div className="w-full animate-fade-in">
      {/* Timeline steps */}
      <div className="flex items-center justify-center px-4">
        {steps.map((step, i) => (
          <div key={step.id} className="contents">
            {/* Step */}
            <div className="flex flex-col items-center min-w-[60px] sm:min-w-[80px]">
              <StepCircle step={step} index={i} />

              <span
                className={`mt-2 text-xs font-medium text-center ${
                  step.status === "running"
                    ? "text-text-primary font-semibold"
                    : step.status === "done"
                      ? "text-text-primary"
                      : "text-text-secondary"
                }`}
              >
                {step.label}
              </span>

              {/* Score badge */}
              {step.status === "done" && step.score != null && (
                <div className="mt-1 animate-score-reveal">
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded-full ${getScoreStyle(step.score).bgClass} text-white`}
                  >
                    {step.score}/5
                  </span>
                </div>
              )}

              {/* Latency */}
              {step.status === "done" && step.latencyMs != null && (
                <span className="mt-0.5 text-[10px] text-text-secondary">
                  {(step.latencyMs / 1000).toFixed(1)}s
                </span>
              )}
            </div>

            {/* Connector between steps */}
            {i < steps.length - 1 && <Connector completed={step.status === "done"} />}
          </div>
        ))}
      </div>

      {/* Phase banner */}
      {banner && (
        <p className="text-center text-sm text-text-secondary mt-4 animate-fade-in">{banner}</p>
      )}
    </div>
  );
}
