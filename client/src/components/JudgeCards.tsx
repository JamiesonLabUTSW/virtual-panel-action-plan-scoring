import type { GradingState } from "@shared/types";
import { JUDGE_ORDER } from "../utils/judge-personas";
import JudgeCard from "./JudgeCard";

interface JudgeCardsProps {
  state: GradingState;
}

export default function JudgeCards({ state }: JudgeCardsProps) {
  const allRunning = JUDGE_ORDER.every(
    (id) => state.judges[id as keyof typeof state.judges]?.status === "running"
  );

  return (
    <section className="animate-fade-in-up">
      <div className="mb-6">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-text-secondary mb-1">
          Evaluation Panel
        </h2>
        <p className="text-sm text-text-secondary/70">
          Three calibrated judges evaluate the proposal independently
        </p>
      </div>

      <div
        className={`grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 ${
          allRunning ? "animate-pulse" : ""
        }`}
      >
        {JUDGE_ORDER.map((raterId) => (
          <JudgeCard
            key={raterId}
            raterId={raterId}
            judgeState={state.judges[raterId as keyof typeof state.judges]}
          />
        ))}
      </div>
    </section>
  );
}
