import type { JudgeState } from "@shared/types";
import type { JudgePersona } from "../utils/judge-personas";
import { JUDGE_PERSONAS } from "../utils/judge-personas";
import { getScoreStyle } from "../utils/score-colors";

interface JudgeCardProps {
  judgeState?: JudgeState;
  raterId: string;
}

function ScoreDistributionBar({ items }: { items: { score: number }[] }) {
  const counts = [0, 0, 0, 0, 0];
  for (const item of items) {
    if (item.score >= 1 && item.score <= 5) counts[item.score - 1]++;
  }
  const total = items.length || 1;

  return (
    <div className="flex h-2 rounded-full overflow-hidden bg-surface-700">
      {counts.map((count, i) => {
        if (count === 0) return null;
        const style = getScoreStyle(i + 1);
        return (
          <div
            key={`score-${i + 1}`}
            className="h-full first:rounded-l-full last:rounded-r-full"
            style={{
              width: `${(count / total) * 100}%`,
              backgroundColor: style.hex,
            }}
            title={`Score ${i + 1}: ${count} item${count !== 1 ? "s" : ""}`}
          />
        );
      })}
    </div>
  );
}

function SkeletonRows() {
  return (
    <div className="space-y-3 mt-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="space-y-2">
          <div className="shimmer h-3 rounded w-1/4" />
          <div className="shimmer h-3 rounded w-full" />
        </div>
      ))}
    </div>
  );
}

function PendingState({ persona }: { persona: JudgePersona }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-text-secondary">
      <svg
        className="w-8 h-8 mb-3 opacity-40"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <p className="text-sm">Waiting to evaluate...</p>
      <p className="text-xs mt-1 opacity-60">{persona.calibrationChip}</p>
    </div>
  );
}

function RunningState({ persona }: { persona: JudgePersona }) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="shimmer w-12 h-12 rounded-lg" />
        <div className="flex-1">
          <div className="shimmer h-4 rounded w-20 mb-2" />
          <div className="shimmer h-3 rounded w-32" />
        </div>
      </div>
      <p className="text-sm text-text-secondary animate-pulse">{persona.focusDescription}</p>
      <SkeletonRows />
    </div>
  );
}

function DoneState({ judgeState, persona }: { judgeState: JudgeState; persona: JudgePersona }) {
  if (!judgeState.result) return null;
  const result = judgeState.result;
  const scoreStyle = getScoreStyle(result.overall_score);

  return (
    <div>
      {/* Score reveal */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-3xl" role="img" aria-label={persona.title}>
            {persona.avatar}
          </span>
          <div>
            <p className="text-sm font-medium text-text-primary">{persona.title}</p>
            <span
              className="text-xs px-2 py-0.5 rounded-full"
              style={{ backgroundColor: `${persona.accentHex}20`, color: persona.accentHex }}
            >
              {persona.calibrationChip}
            </span>
          </div>
        </div>
        <div className="animate-score-reveal text-center">
          <span
            className="text-5xl font-black"
            style={{ color: scoreStyle.hex }}
            aria-label={`Overall score: ${result.overall_score} out of 5, ${scoreStyle.label}`}
          >
            {result.overall_score}
          </span>
          <p className="text-xs text-text-secondary mt-0.5">{scoreStyle.label}</p>
        </div>
      </div>

      {/* Score distribution bar */}
      <div className="mb-4">
        <p className="text-xs text-text-secondary mb-1.5">Score Distribution</p>
        <ScoreDistributionBar items={result.items} />
      </div>

      {/* Action item reviews */}
      <div className="space-y-2.5">
        {result.items.map((item, idx) => {
          const itemScoreStyle = getScoreStyle(item.score);
          return (
            <div
              key={item.action_item_id}
              className="flex gap-3 animate-fade-in-up"
              style={{ animationDelay: `${idx * 150}ms` }}
            >
              <div className="flex-shrink-0 mt-0.5">
                <span
                  className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold text-white"
                  style={{ backgroundColor: itemScoreStyle.hex }}
                >
                  {item.score}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-xs font-mono text-text-secondary">
                  Item #{item.action_item_id}
                </span>
                <p className="text-sm text-text-secondary/80 italic leading-relaxed">
                  {item.comment}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Latency footer */}
      {judgeState.latencyMs != null && (
        <p className="text-xs text-text-secondary/60 mt-4 pt-3 border-t border-surface-700">
          Evaluated in {(judgeState.latencyMs / 1000).toFixed(1)}s
        </p>
      )}
    </div>
  );
}

function ErrorState({ judgeState }: { judgeState: JudgeState }) {
  return (
    <div className="flex flex-col items-center justify-center py-8">
      <svg
        className="w-8 h-8 text-red-400 mb-3"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
        />
      </svg>
      <p className="text-sm text-red-400 text-center mb-1">
        {judgeState.error || "Evaluation failed"}
      </p>
      <p className="text-xs text-text-secondary text-center">
        Consensus will proceed with remaining judges.
      </p>
    </div>
  );
}

export default function JudgeCard({ judgeState, raterId }: JudgeCardProps) {
  const persona = JUDGE_PERSONAS[raterId];
  const status = judgeState?.status ?? "pending";

  const borderColor =
    status === "running"
      ? persona.accentHex
      : status === "error"
        ? "#DC2626"
        : status === "done"
          ? persona.accentHex
          : "transparent";

  return (
    <section
      className={`rounded-xl border-t-4 bg-surface-800 p-4 sm:p-5 min-w-0 sm:min-w-[320px] transition-all duration-300 ${
        status === "running" ? "animate-pulse ring-1 ring-accent/20" : ""
      }`}
      style={{ borderTopColor: borderColor }}
      aria-label={`${persona.name} ${persona.title} evaluation`}
    >
      {/* Card header for pending/running */}
      {(status === "pending" || status === "running") && (
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xl">{persona.avatar}</span>
          <div>
            <p className="text-sm font-semibold text-text-primary">{persona.name}</p>
            <p className="text-xs text-text-secondary">{persona.title}</p>
          </div>
        </div>
      )}

      {status === "pending" && <PendingState persona={persona} />}
      {status === "running" && <RunningState persona={persona} />}
      {status === "done" && judgeState && <DoneState judgeState={judgeState} persona={persona} />}
      {status === "error" && judgeState && <ErrorState judgeState={judgeState} />}
    </section>
  );
}
