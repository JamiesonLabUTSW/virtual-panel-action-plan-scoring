import { CopilotKit } from "@copilotkit/react-core";
import { CopilotChat } from "@copilotkit/react-ui";
import "@copilotkit/react-ui/styles.css";
import GradingView from "./components/GradingView";

export default function App() {
  return (
    <CopilotKit runtimeUrl="/api/copilotkit">
      <div className="flex h-screen">
        <GradingView />
      </div>

      {/* CopilotChat mounted hidden — useCoAgent requires the chat infrastructure
          (abortControllerRef, connectAgent) to be initialized. Without a mounted CopilotChat,
          the agent infrastructure crashes. The ChatSidebar mounts a visible CopilotChat when
          grading completes, but this hidden one is needed before that point.
          See: https://github.com/CopilotKit/CopilotKit/issues/2060 */}
      <div className="hidden">
        <CopilotChat
          instructions="You are a helpful assistant for the Multi-Judge Grading Demo."
          labels={{
            title: "Grading Assistant",
            initial: "Evaluation complete. Ask me about the results.",
          }}
        />
      </div>
    </CopilotKit>
  );
}
