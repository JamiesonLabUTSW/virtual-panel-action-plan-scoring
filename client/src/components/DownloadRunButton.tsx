import type { GradingState } from "@shared/types";
import { useCallback } from "react";

interface DownloadRunButtonProps {
  state: GradingState;
}

export default function DownloadRunButton({ state }: DownloadRunButtonProps) {
  if (state.phase !== "done") return null;

  const handleDownload = useCallback(() => {
    const json = JSON.stringify(state, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;

    const a = document.createElement("a");
    a.href = url;
    a.download = `grading-run-${timestamp}.json`;
    a.click();

    URL.revokeObjectURL(url);
  }, [state]);

  return (
    <button
      type="button"
      onClick={handleDownload}
      className="inline-flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary
        border border-[var(--border-card)] hover:border-[rgba(0,158,226,0.25)] rounded-lg px-4 py-2
        transition-colors"
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
          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
        />
      </svg>
      Download JSON
    </button>
  );
}
