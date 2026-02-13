import { CopilotKit } from "@copilotkit/react-core";
import "@copilotkit/react-ui/styles.css";
import { useState } from "react";
import CookieConsent from "react-cookie-consent";
import Footer from "./components/Footer";
import GradingView from "./components/GradingView";
import TermsModal from "./components/TermsModal";

export default function App() {
  const [isTermsOpen, setIsTermsOpen] = useState(false);

  return (
    <CopilotKit runtimeUrl="/api/copilotkit">
      {/* Cookie Consent Banner */}
      <CookieConsent
        location="bottom"
        buttonText="I Understand"
        cookieName="gradingDemoConsent"
        expires={365}
        style={{
          background: "var(--color-surface-800)",
          borderTop: "1px solid var(--border-structural)",
          padding: "16px 24px",
        }}
        buttonStyle={{
          background: "var(--color-primary)",
          color: "#fff",
          fontSize: "14px",
          fontWeight: "500",
          padding: "8px 24px",
          borderRadius: "8px",
          transition: "background-color 0.2s",
        }}
        contentStyle={{
          flex: "1 1 auto",
          margin: "0",
          fontSize: "14px",
          color: "var(--color-text-secondary)",
        }}
      >
        This research application logs usage data for academic purposes.{" "}
        <button
          type="button"
          onClick={() => setIsTermsOpen(true)}
          className="text-[#009ee2] hover:text-accent-light underline"
        >
          Learn more
        </button>
      </CookieConsent>

      {/* Main Layout */}
      <div className="flex flex-col h-screen">
        {/* Main Content Area */}
        <div className="flex-1 flex overflow-hidden">
          <GradingView />
        </div>

        {/* Footer */}
        <Footer onOpenTerms={() => setIsTermsOpen(true)} />
      </div>

      {/* Terms Modal */}
      <TermsModal open={isTermsOpen} onClose={() => setIsTermsOpen(false)} />
    </CopilotKit>
  );
}
