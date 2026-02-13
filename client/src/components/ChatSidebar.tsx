import { useCopilotReadable } from "@copilotkit/react-core";
import type { GradingState } from "@shared/types";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

interface ChatSidebarProps {
  state: GradingState;
  visible: boolean;
  children: ReactNode;
}

const SUGGESTED_QUESTIONS = [
  "Why did the judges disagree?",
  "What should I improve first?",
  "Compare Rater A and Rater C's perspectives",
];

export default function ChatSidebar({ state, visible, children }: ChatSidebarProps) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 1280px)");
    setIsOpen(mediaQuery.matches); // Open on desktop, closed on mobile

    const handleChange = (e: MediaQueryListEvent) => {
      setIsOpen(e.matches);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  useCopilotReadable({
    description: "Current grading results including judge scores, consensus, and improvements",
    value: JSON.stringify(state, null, 2),
  });

  // When not visible, keep the component mounted (to preserve CopilotChat threadId/runId)
  // but hide it from the DOM layout entirely.
  if (!visible) {
    return <div className="hidden">{children}</div>;
  }

  return (
    <>
      {/* Mobile toggle button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="xl:hidden fixed bottom-6 right-6 z-50 bg-primary hover:bg-accent
          text-white rounded-full w-12 h-12 flex items-center justify-center shadow-lg
          shadow-[rgba(0,158,226,0.20)] transition-colors"
        aria-label={isOpen ? "Close chat" : "Open chat"}
      >
        {isOpen ? (
          <svg
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
            />
          </svg>
        )}
      </button>

      {/* Sidebar panel */}
      <div
        className={`
          fixed inset-0 z-40 xl:relative xl:inset-auto
          transition-transform duration-300 ease-out
          ${isOpen ? "translate-x-0" : "translate-x-full"}
          xl:translate-x-0 xl:animate-slide-in-right
        `}
      >
        {/* Mobile backdrop */}
        {isOpen && (
          <div
            className="absolute inset-0 bg-black/50 xl:hidden"
            onClick={() => setIsOpen(false)}
            onKeyDown={() => {}}
            role="presentation"
          />
        )}

        {/* Chat panel */}
        <div
          className="absolute right-0 top-0 bottom-0 w-full max-w-[384px] xl:relative xl:w-96
          bg-surface-800 border-l border-[var(--border-structural)] flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-internal)]">
            <div>
              <h3 className="text-base font-semibold text-text-primary">Grading Assistant</h3>
              <p className="text-sm text-text-secondary">Ask about the evaluation results</p>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="xl:hidden p-1 text-text-secondary hover:text-text-primary transition-colors"
              aria-label="Close sidebar"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Suggested questions */}
          <div className="px-4 py-3 border-b border-[var(--border-internal)] space-y-2">
            <p className="text-xs text-text-secondary">Try asking:</p>
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  type="button"
                  className="text-xs bg-surface-700 hover:bg-surface-600 text-text-secondary
                    hover:text-text-primary px-2.5 py-1 rounded-full transition-colors"
                  onClick={() => {
                    const textarea = document.querySelector<HTMLTextAreaElement>(
                      ".copilotKitChat textarea"
                    );
                    if (textarea) {
                      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
                        window.HTMLTextAreaElement.prototype,
                        "value"
                      )?.set;
                      nativeInputValueSetter?.call(textarea, q);
                      textarea.dispatchEvent(new Event("input", { bubbles: true }));
                      textarea.focus();
                    }
                  }}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* CopilotChat (passed from App.tsx to preserve threadId/runId) */}
          <div className="flex-1 overflow-y-auto copilotKitChat">{children}</div>
        </div>
      </div>
    </>
  );
}
