import OpenAI from "openai";

/**
 * Shared OpenAI client for Azure Responses API (reasoning models).
 *
 * Targets gpt-5.1-codex-mini via Azure OpenAI Responses API (/openai/v1/responses) with 3-tier
 * structured output fallback (json_schema strict → json_schema non-strict → json_object + Zod validation).
 *
 * **Important for Azure Responses API:**
 * - Use standard OpenAI client (not AzureOpenAI) with Azure base_url
 * - Endpoint: https://{resource}.openai.azure.com/openai/v1/
 * - Uses max_output_tokens (not max_completion_tokens)
 *
 * **Important constraints for reasoning models (gpt-5.1-codex-mini):**
 * - No `temperature` or `top_p` — these parameters error with reasoning models
 * - Responses API uses `max_output_tokens` (not `max_completion_tokens`)
 * - `reasoning_effort` defaults to `none`; set explicitly if needed
 *
 * Note: Lazy-initialized to allow tests to set environment variables before client creation
 */
let _client: OpenAI | null = null;

export const client: OpenAI = new Proxy({} as OpenAI, {
  get(_target, prop) {
    if (!_client) {
      _client = new OpenAI({
        // biome-ignore lint/style/noNonNullAssertion: Safe — values validated at startup (Phase 2.6)
        apiKey: process.env.AZURE_OPENAI_API_KEY!,
        baseURL: `https://${process.env.AZURE_OPENAI_RESOURCE!}.openai.azure.com/openai/v1/`,
      });
    }
    return _client[prop as keyof OpenAI];
  },
});

/**
 * Model deployment name from environment
 */
// biome-ignore lint/style/noNonNullAssertion: Safe — values validated at startup
export const MODEL = process.env.AZURE_OPENAI_DEPLOYMENT!;

/**
 * Default maximum output tokens for reasoning models.
 * Set high (16000) because reasoning models use internal chain-of-thought
 * tokens that count against max_output_tokens.
 */
export const MAX_COMPLETION_TOKENS = 16000;
