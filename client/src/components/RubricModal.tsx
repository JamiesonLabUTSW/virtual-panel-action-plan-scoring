import { useEffect, useRef } from "react";

interface RubricModalProps {
  open: boolean;
  onClose: () => void;
}

export default function RubricModal({ open, onClose }: RubricModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Manage dialog open/close state
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      dialog.showModal();
    } else {
      dialog.close();
    }
  }, [open]);

  // Handle dialog close event (including Escape key and backdrop click)
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => {
      onClose();
    };

    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, [onClose]);

  // Handle backdrop click
  const handleDialogClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    // Check if click was on the backdrop (outside dialog content)
    const rect = dialog.getBoundingClientRect();
    if (
      e.clientX < rect.left ||
      e.clientX > rect.right ||
      e.clientY < rect.top ||
      e.clientY > rect.bottom
    ) {
      dialog.close();
    }
  };

  // Handle keyboard events on dialog (for accessibility)
  const handleDialogKeyDown = (e: React.KeyboardEvent<HTMLDialogElement>) => {
    // Escape key is already handled by native dialog behavior
    // This handler is here for accessibility compliance with useKeyWithClickEvents
    if (e.key === "Escape") {
      e.preventDefault();
      dialogRef.current?.close();
    }
  };

  return (
    <dialog
      ref={dialogRef}
      onClick={handleDialogClick}
      onKeyDown={handleDialogKeyDown}
      className="backdrop:bg-black/60 backdrop:backdrop-blur-sm bg-transparent p-4 max-w-4xl w-full rounded-xl"
    >
      <div className="relative w-full bg-surface-800 border border-[var(--border-card)] rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-internal)]">
          <h2 id="rubric-modal-title" className="text-2xl font-semibold text-text-primary">
            Grading Rubric
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-text-secondary hover:text-text-primary transition-colors p-1 rounded-lg hover:bg-surface-700"
            aria-label="Close modal"
          >
            <svg
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <title>Close</title>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[80vh] px-6 py-6 space-y-8">
          {/* Scoring Anchors */}
          <section>
            <h3 className="text-xl font-semibold text-text-primary mb-3">Scoring Anchors</h3>
            <div className="space-y-3 text-text-secondary leading-relaxed">
              <p className="mb-4">
                All action items and proposals are evaluated on a consistent 1-5 scale:
              </p>
              <ul className="space-y-2">
                <li>
                  <strong className="text-text-primary">1 = Poor:</strong> fundamental gaps; lacks
                  feasibility, clarity, or alignment
                </li>
                <li>
                  <strong className="text-text-primary">2 = Weak:</strong> notable issues; partial
                  feasibility or unclear execution
                </li>
                <li>
                  <strong className="text-text-primary">3 = Adequate:</strong> meets minimum;
                  feasible but needs improvements
                </li>
                <li>
                  <strong className="text-text-primary">4 = Strong:</strong> solid plan with minor
                  refinements suggested
                </li>
                <li>
                  <strong className="text-text-primary">5 = Excellent:</strong> clear, feasible,
                  well-aligned, high impact
                </li>
              </ul>
            </div>
          </section>

          {/* Comment Style */}
          <section>
            <h3 className="text-xl font-semibold text-text-primary mb-3">Comment Style</h3>
            <div className="space-y-3 text-text-secondary leading-relaxed">
              <p className="mb-4">
                Judges provide specific, actionable feedback following these guidelines:
              </p>
              <ul className="space-y-2 list-disc list-inside">
                <li>
                  Be specific and actionable: cite what is clear/missing, risks, and concrete
                  improvements
                </li>
                <li>
                  Keep it concise (1–3 sentences per item). Avoid generic filler and repetition
                  across items
                </li>
                <li>
                  Reference the action item content (timeline, owner, metrics) where relevant
                </li>
              </ul>
            </div>
          </section>

          {/* Overall Score Guidance */}
          <section>
            <h3 className="text-xl font-semibold text-text-primary mb-3">
              Overall Score Guidance
            </h3>
            <div className="space-y-3 text-text-secondary leading-relaxed">
              <p className="mb-4">
                The overall score reflects the proposal's holistic quality and coherence:
              </p>
              <ul className="space-y-2 list-disc list-inside">
                <li>
                  Reflect the overall plan quality and coherence. It may be close to, but need not
                  equal, the average of item scores
                </li>
                <li>Avoid extreme scores unless clearly warranted by item evidence</li>
                <li>
                  If the program has less than three action items with scores of 3 or higher, you
                  must rate less than 3
                </li>
              </ul>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-4 border-t border-[var(--border-internal)] bg-surface-900">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-accent)] text-white font-medium rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </dialog>
  );
}
