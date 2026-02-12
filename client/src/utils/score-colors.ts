/**
 * Score color utilities mapping 1-5 scores to visual styles.
 * Colors match SPEC §4.4 score scale.
 */

export interface ScoreStyle {
  hex: string;
  textClass: string;
  bgClass: string;
  borderClass: string;
  label: string;
}

const SCORE_STYLES: Record<number, ScoreStyle> = {
  1: {
    hex: "#DC2626",
    textClass: "text-score-1",
    bgClass: "bg-score-1",
    borderClass: "border-score-1",
    label: "Poor",
  },
  2: {
    hex: "#F97316",
    textClass: "text-score-2",
    bgClass: "bg-score-2",
    borderClass: "border-score-2",
    label: "Weak",
  },
  3: {
    hex: "#EAB308",
    textClass: "text-score-3",
    bgClass: "bg-score-3",
    borderClass: "border-score-3",
    label: "Adequate",
  },
  4: {
    hex: "#22C55E",
    textClass: "text-score-4",
    bgClass: "bg-score-4",
    borderClass: "border-score-4",
    label: "Strong",
  },
  5: {
    hex: "#16A34A",
    textClass: "text-score-5",
    bgClass: "bg-score-5",
    borderClass: "border-score-5",
    label: "Excellent",
  },
};

const FALLBACK_STYLE: ScoreStyle = {
  hex: "#6B7280",
  textClass: "text-gray-500",
  bgClass: "bg-gray-500",
  borderClass: "border-gray-500",
  label: "N/A",
};

export function getScoreStyle(score: number | null | undefined): ScoreStyle {
  if (score == null || score < 1 || score > 5) return FALLBACK_STYLE;
  return SCORE_STYLES[Math.round(score)] ?? FALLBACK_STYLE;
}
