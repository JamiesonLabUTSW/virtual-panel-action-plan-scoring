/**
 * Agreement level styling utilities.
 * Maps consensus agreement levels to visual styles.
 */

export interface AgreementStyle {
  hex: string;
  textClass: string;
  bgClass: string;
  label: string;
}

const AGREEMENT_STYLES: Record<string, AgreementStyle> = {
  strong: {
    hex: "#22C55E",
    textClass: "text-agreement-strong",
    bgClass: "bg-agreement-strong",
    label: "Strong Agreement",
  },
  moderate: {
    hex: "#EAB308",
    textClass: "text-agreement-moderate",
    bgClass: "bg-agreement-moderate",
    label: "Moderate Agreement",
  },
  weak: {
    hex: "#DC2626",
    textClass: "text-agreement-weak",
    bgClass: "bg-agreement-weak",
    label: "Weak Agreement",
  },
};

const FALLBACK: AgreementStyle = {
  hex: "#6B7280",
  textClass: "text-gray-500",
  bgClass: "bg-gray-500",
  label: "Unknown",
};

export function getAgreementStyle(level: string | null | undefined): AgreementStyle {
  if (!level) return FALLBACK;
  return AGREEMENT_STYLES[level] ?? FALLBACK;
}
