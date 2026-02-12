import { CopilotKit } from "@copilotkit/react-core";
import "@copilotkit/react-ui/styles.css";
import GradingView from "./components/GradingView";

export default function App() {
  return (
    <CopilotKit runtimeUrl="/api/copilotkit">
      <div className="flex h-screen">
        <GradingView />
      </div>
    </CopilotKit>
  );
}
