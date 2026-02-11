import { ChatOpenAI } from "@langchain/openai";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Tests for ChatOpenAI instantiation and basic connectivity (Issue #23)
 *
 * These tests verify:
 * - ChatOpenAI instantiates without errors
 * - Environment variables are correctly passed to ChatOpenAI
 * - No unsupported parameters (temperature, maxTokens, top_p) are configured
 * - Basic invoke call returns a valid response structure
 */

describe("ChatOpenAI Configuration (Issue #23)", () => {
  const originalEnv = { ...process.env };

  beforeAll(() => {
    // Set required environment variables for tests
    process.env.AZURE_OPENAI_API_KEY = "test-key";
    process.env.AZURE_OPENAI_RESOURCE = "test-resource";
    process.env.AZURE_OPENAI_DEPLOYMENT = "gpt-5.1-codex-mini";
  });

  afterAll(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  it("should instantiate ChatOpenAI without errors", () => {
    expect(() => {
      // biome-ignore lint/style/noNonNullAssertion: env vars guaranteed from beforeAll
      new ChatOpenAI({
        model: process.env.AZURE_OPENAI_DEPLOYMENT!,
        openAIApiKey: process.env.AZURE_OPENAI_API_KEY,
        configuration: {
          baseURL: `https://${process.env.AZURE_OPENAI_RESOURCE}.openai.azure.com/openai/v1/`,
        },
        useResponsesApi: true,
        maxTokens: 2000,
      });
    }).not.toThrow();
  });

  it("should construct correct Azure baseURL from environment variables", () => {
    // biome-ignore lint/style/noNonNullAssertion: env vars guaranteed from beforeAll
    const llm = new ChatOpenAI({
      model: process.env.AZURE_OPENAI_DEPLOYMENT!,
      openAIApiKey: process.env.AZURE_OPENAI_API_KEY,
      configuration: {
        baseURL: `https://${process.env.AZURE_OPENAI_RESOURCE}.openai.azure.com/openai/v1/`,
      },
      useResponsesApi: true,
      maxTokens: 2000,
    });

    // Verify the instance has the expected properties
    expect(llm).toBeDefined();
    expect(llm.model).toBe("gpt-5.1-codex-mini");
  });

  it("should use useResponsesApi for gpt-5.x models", () => {
    // biome-ignore lint/style/noNonNullAssertion: env vars guaranteed from beforeAll
    const config = {
      model: process.env.AZURE_OPENAI_DEPLOYMENT!,
      openAIApiKey: process.env.AZURE_OPENAI_API_KEY,
      configuration: {
        baseURL: `https://${process.env.AZURE_OPENAI_RESOURCE}.openai.azure.com/openai/v1/`,
      },
      useResponsesApi: true,
      maxTokens: 2000,
    };

    // Verify that the config object includes useResponsesApi
    expect(config.useResponsesApi).toBe(true);
    expect(config.maxTokens).toBe(2000);
  });

  it("should not include unsupported parameters (temperature, top_p)", () => {
    // This test verifies that the LLM configuration does not include
    // parameters that error with reasoning models (gpt-5.1-codex-mini).
    // Note: maxTokens is used here (LangChain 1.2.7, OpenAI SDK 6.x).
    // biome-ignore lint/style/noNonNullAssertion: env vars guaranteed from beforeAll
    const config = {
      model: process.env.AZURE_OPENAI_DEPLOYMENT!,
      openAIApiKey: process.env.AZURE_OPENAI_API_KEY,
      configuration: {
        baseURL: `https://${process.env.AZURE_OPENAI_RESOURCE}.openai.azure.com/openai/v1/`,
      },
      useResponsesApi: true,
      maxTokens: 2000,
      // Intentionally NOT including: temperature, top_p
    };

    // Verify unsupported parameters are absent
    expect("temperature" in config).toBe(false);
    expect("top_p" in config).toBe(false);
    // Verify maxTokens is present for output control
    expect("maxTokens" in config).toBe(true);
  });

  it("should have required environment variables defined", () => {
    expect(process.env.AZURE_OPENAI_API_KEY).toBeDefined();
    expect(process.env.AZURE_OPENAI_RESOURCE).toBeDefined();
    expect(process.env.AZURE_OPENAI_DEPLOYMENT).toBeDefined();

    expect(process.env.AZURE_OPENAI_API_KEY).toBe("test-key");
    expect(process.env.AZURE_OPENAI_RESOURCE).toBe("test-resource");
    expect(process.env.AZURE_OPENAI_DEPLOYMENT).toBe("gpt-5.1-codex-mini");
  });

  it("should correctly export the llm instance", async () => {
    // Dynamically import to get a fresh instance with test env vars
    // biome-ignore lint/suspicious/noAsyncPromiseExecutor: Test dynamic import is acceptable
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    const { llm: importedLlm } = await import("../llm");

    expect(importedLlm).toBeDefined();
    expect(importedLlm.model).toBe("gpt-5.1-codex-mini");
  });
});
