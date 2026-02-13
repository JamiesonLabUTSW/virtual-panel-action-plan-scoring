import { useEffect, useRef } from "react";

interface TermsModalProps {
  open: boolean;
  onClose: () => void;
}

export default function TermsModal({ open, onClose }: TermsModalProps) {
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
          <h2 id="terms-modal-title" className="text-2xl font-semibold text-text-primary">
            Terms of Use & Legal Information
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
          {/* Terms of Use */}
          <section>
            <h3 className="text-xl font-semibold text-text-primary mb-3">Terms of Use</h3>
            <div className="space-y-3 text-text-secondary leading-relaxed">
              <p>
                This application is a <strong>research demonstration tool</strong> developed by The
                University of Texas Southwestern Medical Center for academic and educational
                purposes only.
              </p>
              <p>
                <strong>Academic Use Only:</strong> This software is intended solely for research,
                education, and demonstration purposes. Commercial use, clinical application, or use
                in medical decision-making is expressly prohibited without prior written permission
                from The University of Texas Southwestern Medical Center.
              </p>
              <p>
                <strong>Not for Clinical Decision-Making:</strong> This application must not be used
                for clinical diagnosis, treatment planning, patient care, or any other medical
                decision-making purpose.
              </p>
              <p>
                By using this application, you acknowledge that you have read, understood, and agree
                to be bound by these terms and the warranty disclaimer below.
              </p>
            </div>
          </section>

          {/* Warranty Disclaimer */}
          <section>
            <h3 className="text-xl font-semibold text-text-primary mb-3">Warranty Disclaimer</h3>
            <div className="space-y-3 text-text-secondary leading-relaxed">
              <div className="bg-surface-900 border border-amber-500/30 rounded-lg p-4">
                <p className="text-amber-400 font-semibold mb-2">⚠️ IMPORTANT DISCLAIMER</p>
                <p className="text-text-secondary">
                  <strong>NO WARRANTY ON ACCURACY OR FITNESS FOR ANY PURPOSE.</strong> This software
                  is provided "AS IS" without warranty of any kind, either express or implied,
                  including but not limited to the implied warranties of merchantability, fitness
                  for a particular purpose, or non-infringement.
                </p>
              </div>

              <p>
                <strong>NOT A MEDICAL DEVICE:</strong> This software has not been approved or
                cleared by the U.S. Food and Drug Administration (FDA) or any other regulatory
                authority for clinical or diagnostic use. It is not a medical device and is not
                intended for use in the diagnosis, cure, mitigation, treatment, or prevention of
                disease.
              </p>

              <p>
                <strong>AI-GENERATED OUTPUTS:</strong> All outputs of this application are generated
                by artificial intelligence and may contain errors, biases, inaccuracies, or
                hallucinations. Users must independently verify all outputs before relying on them
                for any purpose.
              </p>

              <p>
                <strong>NOT FOR DIAGNOSTIC USE:</strong> Under no circumstances should the outputs
                of this application be used for clinical diagnosis, patient care, or any medical
                decision-making purpose.
              </p>

              <p>
                <strong>Limitation of Liability:</strong> In no event shall The University of Texas
                Southwestern Medical Center, its affiliates, or contributors be liable for any
                direct, indirect, incidental, special, exemplary, or consequential damages
                (including, but not limited to, procurement of substitute goods or services; loss of
                use, data, or profits; or business interruption) however caused and on any theory of
                liability, whether in contract, strict liability, or tort (including negligence or
                otherwise) arising in any way out of the use of this software, even if advised of
                the possibility of such damage.
              </p>
            </div>
          </section>

          {/* License */}
          <section>
            <h3 className="text-xl font-semibold text-text-primary mb-3">License</h3>
            <div className="space-y-3 text-text-secondary leading-relaxed">
              <p className="font-semibold">BSD 3-Clause License</p>
              <p>Copyright (c) 2026, The University of Texas Southwestern Medical Center</p>
              <p>
                Redistribution and use in source and binary forms, with or without modification, are
                permitted provided that the following conditions are met:
              </p>
              <ol className="list-decimal list-inside space-y-2 ml-4">
                <li>
                  Redistributions of source code must retain the above copyright notice, this list
                  of conditions and the following disclaimer.
                </li>
                <li>
                  Redistributions in binary form must reproduce the above copyright notice, this
                  list of conditions and the following disclaimer in the documentation and/or other
                  materials provided with the distribution.
                </li>
                <li>
                  Neither the name of the copyright holder nor the names of its contributors may be
                  used to endorse or promote products derived from this software without specific
                  prior written permission.
                </li>
              </ol>
              <p className="text-sm italic">
                For the complete license text including additional restrictions for academic
                research use, see the{" "}
                <a
                  href="/LICENSE.txt"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#009ee2] hover:text-accent-light underline"
                >
                  full license file
                </a>
                .
              </p>
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
