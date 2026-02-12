/**
 * Judge persona metadata for UI display.
 * Maps rater IDs to display names, colors, and calibration descriptions.
 */

export interface JudgePersona {
  id: string;
  name: string;
  title: string;
  avatar: string;
  accentHex: string;
  accentTextClass: string;
  accentBgClass: string;
  accentBorderClass: string;
  calibrationChip: string;
  focusDescription: string;
}

export const JUDGE_PERSONAS: Record<string, JudgePersona> = {
  rater_a: {
    id: "rater_a",
    name: "Rater A",
    title: "The Professor",
    avatar: "\u{1F393}",
    accentHex: "#8B5CF6",
    accentTextClass: "text-judge-a",
    accentBgClass: "bg-judge-a",
    accentBorderClass: "border-judge-a",
    calibrationChip: "Strict on structure",
    focusDescription: "The Professor is evaluating structure and metrics...",
  },
  rater_b: {
    id: "rater_b",
    name: "Rater B",
    title: "The Editor",
    avatar: "\u{1F4DD}",
    accentHex: "#06B6D4",
    accentTextClass: "text-judge-b",
    accentBgClass: "bg-judge-b",
    accentBorderClass: "border-judge-b",
    calibrationChip: "Generous on clarity",
    focusDescription: "The Editor is assessing feasibility and clarity...",
  },
  rater_c: {
    id: "rater_c",
    name: "Rater C",
    title: "The Practitioner",
    avatar: "\u{1FA7A}",
    accentHex: "#F59E0B",
    accentTextClass: "text-judge-c",
    accentBgClass: "bg-judge-c",
    accentBorderClass: "border-judge-c",
    calibrationChip: "Strict on actionability",
    focusDescription: "The Practitioner is checking actionability and data richness...",
  },
};

export const JUDGE_ORDER: string[] = ["rater_a", "rater_b", "rater_c"];
