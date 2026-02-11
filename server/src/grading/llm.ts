import { ChatOpenAI } from "@langchain/openai";

/**
 * Shared LLM instance for judge and consensus chains.
 *
 * Targets gpt-5.1-codex-mini via Azure OpenAI v1 API with 3-tier structured
 * output fallback (json_schema → function calling → json_object + Zod validation).
 *
 * **Important constraints for reasoning models (gpt-5.1-codex-mini):**
 * - No `temperature` or `top_p` — these parameters error with reasoning models
 * - `useResponsesApi: true` required for gpt-5.x models
 * - `maxTokens` controls output length (LangChain 1.2.7, OpenAI SDK 6.x)
 * - `reasoning_effort` defaults to `none`; set explicitly if needed
 */
export const llm = new ChatOpenAI({
  // biome-ignore lint/style/noNonNullAssertion: Safe — values validated at startup (Phase 2.6)
  model: process.env.AZURE_OPENAI_DEPLOYMENT!,
  openAIApiKey: process.env.AZURE_OPENAI_API_KEY,
  configuration: {
    baseURL: `https://${process.env.AZURE_OPENAI_RESOURCE}.openai.azure.com/openai/v1/`,
  },
  // Use Responses API (required for gpt-5.x reasoning models)
  useResponsesApi: true,
  // Maximum tokens for reasoning model output (uses maxTokens in LangChain 0.5.x)
  maxTokens: 2000,
  // NOTE: NO temperature or top_p — these will error with reasoning models
});
