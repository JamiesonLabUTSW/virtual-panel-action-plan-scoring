import type { ConsensusOutputType } from "@shared/schemas";
import type { GradingState } from "@shared/types";
import { getAgreementStyle } from "../utils/agreement-styles";
import { JUDGE_ORDER, JUDGE_PERSONAS } from "../utils/judge-personas";
import { getScoreStyle } from "../utils/score-colors";

interface ConsensusPanelProps {
  state: GradingState;
}

function ConvergenceSVG({ consensus }: { consensus: ConsensusOutputType }) {
  const scores = consensus.agreement.scores;
  const judgeScoreEntries = JUDGE_ORDER.map((id) => ({
    id,
    persona: JUDGE_PERSONAS[id],
    score: scores[id as keyof typeof scores],
  }));

  const svgWidth = 400;
  const svgHeight = 120;
  const leftX = 60;
  const rightX = 340;
  const centerY = svgHeight / 2;

  return (
    <svg
      viewBox={`0 0 ${svgWidth} ${svgHeight}`}
      className="w-full max-w-md mx-auto"
      role="img"
      aria-label="Score convergence visualization"
    >
      {/* Convergence lines and judge circles */}
      {judgeScoreEntries.map((entry, i) => {
        const y = 25 + i * 35;
        const scoreStyle = getScoreStyle(entry.score);
        const isFailed = entry.score == null;

        return (
          <g key={entry.id}>
            {/* Animated convergence line */}
            <line
              x1={leftX + 16}
              y1={y}
              x2={rightX - 24}
              y2={centerY}
              stroke={isFailed ? "#6B7280" : entry.persona.accentHex}
              strokeWidth={2}
              strokeDasharray="200"
              strokeDashoffset="0"
              opacity={isFailed ? 0.3 : 0.6}
              className="animate-converge"
              style={{ animationDelay: `${i * 200}ms` }}
            />

            {/* Judge circle */}
            <circle
              cx={leftX}
              cy={y}
              r={14}
              fill={isFailed ? "#374151" : entry.persona.accentHex}
              opacity={isFailed ? 0.5 : 1}
            />

            {/* Judge score or X */}
            <text
              x={leftX}
              y={y + 1}
              textAnchor="middle"
              dominantBaseline="central"
              className="text-xs font-bold fill-white"
            >
              {isFailed ? "\u2715" : entry.score}
            </text>

            {/* Judge label */}
            <text
              x={leftX - 24}
              y={y + 1}
              textAnchor="end"
              dominantBaseline="central"
              className="text-[10px] fill-text-secondary"
            >
              {entry.persona.name.replace("Rater ", "")}
            </text>

            {/* Score color indicator */}
            {!isFailed && <circle cx={leftX + 20} cy={y - 8} r={4} fill={scoreStyle.hex} />}
          </g>
        );
      })}

      {/* Central consensus circle */}
      <circle
        cx={rightX}
        cy={centerY}
        r={22}
        fill={getScoreStyle(consensus.final_score).hex}
        className="animate-score-reveal"
        style={{ animationDelay: "600ms" }}
      />
      <text
        x={rightX}
        y={centerY + 1}
        textAnchor="middle"
        dominantBaseline="central"
        className="text-lg font-black fill-white animate-score-reveal"
        style={{ animationDelay: "600ms" }}
      >
        {consensus.final_score}
      </text>
    </svg>
  );
}

export default function ConsensusPanel({ state }: ConsensusPanelProps) {
  const consensus = state.consensus;
  if (!consensus) return null;

  const scoreStyle = getScoreStyle(consensus.final_score);
  const agreementStyle = getAgreementStyle(consensus.agreement.agreement_level);

  return (
    <section className="animate-fade-in-up">
      <div className="mb-6">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-text-secondary mb-1">
          Consensus Result
        </h2>
        <p className="text-sm text-text-secondary/70">
          The arbiter reconciles all judge evaluations into a final assessment
        </p>
      </div>

      <div className="bg-surface-800 rounded-xl border border-surface-700 p-6 space-y-6">
        {/* SVG Convergence */}
        <ConvergenceSVG consensus={consensus} />

        {/* Score row */}
        <div className="flex items-center justify-center gap-8 flex-wrap">
          <div className="text-center">
            <p className="text-xs text-text-secondary mb-1">Final Score</p>
            <span
              className="text-5xl font-black animate-score-reveal"
              style={{ color: scoreStyle.hex }}
            >
              {consensus.final_score}
            </span>
            <p className="text-sm mt-1" style={{ color: scoreStyle.hex }}>
              {scoreStyle.label}
            </p>
          </div>

          <div className="flex gap-6 text-center">
            <div>
              <p className="text-xs text-text-secondary mb-1">Mean</p>
              <span className="text-lg font-semibold text-text-primary">
                {consensus.agreement.mean_score.toFixed(1)}
              </span>
            </div>
            <div>
              <p className="text-xs text-text-secondary mb-1">Median</p>
              <span className="text-lg font-semibold text-text-primary">
                {consensus.agreement.median_score}
              </span>
            </div>
            <div>
              <p className="text-xs text-text-secondary mb-1">Spread</p>
              <span className="text-lg font-semibold text-text-primary">
                {consensus.agreement.spread}
              </span>
            </div>
          </div>

          <div>
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold text-white"
              style={{ backgroundColor: agreementStyle.hex }}
            >
              {agreementStyle.label}
            </span>
          </div>
        </div>

        {/* Disagreement analysis */}
        <div className="border-l-4 border-surface-600 pl-4 py-2 bg-surface-900/50 rounded-r-lg">
          <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
            Why Judges Differed
          </p>
          <p className="text-sm text-text-secondary/80 leading-relaxed">
            {consensus.agreement.disagreement_analysis}
          </p>
        </div>

        {/* Rationale */}
        <div className="animate-fade-in">
          <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
            Rationale
          </p>
          <p className="text-sm text-text-primary/90 leading-relaxed">{consensus.rationale}</p>
        </div>

        {/* Improvements */}
        {consensus.improvements.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">
              Suggested Improvements
            </p>
            <ol className="space-y-2">
              {consensus.improvements.map((improvement, idx) => (
                <li
                  key={`improvement-${idx}-${improvement.slice(0, 20)}`}
                  className="flex gap-3 animate-fade-in-up"
                  style={{ animationDelay: `${idx * 100}ms` }}
                >
                  <span className="flex-shrink-0 text-accent mt-0.5">
                    <svg
                      className="w-4 h-4"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                      aria-hidden="true"
                    >
                      <path d="M11 3a1 1 0 10-2 0v7.586L7.707 9.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V3z" />
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  </span>
                  <span className="text-sm text-text-primary/80 leading-relaxed">
                    {improvement}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </section>
  );
}
