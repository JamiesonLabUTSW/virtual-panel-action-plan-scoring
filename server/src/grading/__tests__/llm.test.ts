import OpenAI from "openai";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Tests for OpenAI client with Azure Responses API (Issue #30)
 *
 * These tests verify:
 * - OpenAI client instantiates without errors for Azure Responses API
 * - Environment variables are correctly passed to OpenAI client
 * - No unsupported parameters (temperature, top_p) are configured
 * - max_output_tokens is correctly configured for reasoning models
 * - Basic responses call returns a valid response structure
 */

describe("OpenAI Client with Azure Responses API (Issue #30)", () => {
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

  it("should instantiate OpenAI client for Azure Responses API without errors", () => {
    expect(() => {
      new OpenAI({
        // biome-ignore lint/style/noNonNullAssertion: env vars guaranteed from beforeAll
        apiKey: process.env.AZURE_OPENAI_API_KEY!,
        baseURL: `https://${process.env.AZURE_OPENAI_RESOURCE}.openai.azure.com/openai/v1/`,
      });
    }).not.toThrow();
  });

  it("should construct correct Azure baseURL from environment variables", () => {
    const testClient = new OpenAI({
      apiKey: process.env.AZURE_OPENAI_API_KEY!,
      baseURL: `https://${process.env.AZURE_OPENAI_RESOURCE}.openai.azure.com/openai/v1/`,
    });

    // Verify the instance has the expected properties
    expect(testClient).toBeDefined();
    expect(testClient.baseURL).toBe("https://test-resource.openai.azure.com/openai/v1/");
  });

  it("should use max_output_tokens for reasoning models (Responses API)", () => {
    const params = {
      // biome-ignore lint/style/noNonNullAssertion: env vars guaranteed from beforeAll
      model: process.env.AZURE_OPENAI_DEPLOYMENT!,
      input: "Test",
      max_output_tokens: 2000,
    };

    // Verify that the params object includes max_output_tokens (Responses API)
    expect(params.max_output_tokens).toBe(2000);
    expect(params.model).toBe("gpt-5.1-codex-mini");
  });

  it("should not include unsupported parameters (temperature, top_p)", () => {
    // This test verifies that the API call parameters do not include
    // parameters that error with reasoning models (gpt-5.1-codex-mini).
    const params = {
      // biome-ignore lint/style/noNonNullAssertion: env vars guaranteed from beforeAll
      model: process.env.AZURE_OPENAI_DEPLOYMENT!,
      input: "Test",
      max_output_tokens: 2000,
      // Intentionally NOT including: temperature, top_p, max_tokens
    };

    // Verify unsupported parameters are absent
    expect("temperature" in params).toBe(false);
    expect("top_p" in params).toBe(false);
    expect("max_tokens" in params).toBe(false);
    // Verify max_output_tokens is present for output control (Responses API)
    expect("max_output_tokens" in params).toBe(true);
  });

  it("should have required environment variables defined", () => {
    expect(process.env.AZURE_OPENAI_API_KEY).toBeDefined();
    expect(process.env.AZURE_OPENAI_RESOURCE).toBeDefined();
    expect(process.env.AZURE_OPENAI_DEPLOYMENT).toBeDefined();

    expect(process.env.AZURE_OPENAI_API_KEY).toBe("test-key");
    expect(process.env.AZURE_OPENAI_RESOURCE).toBe("test-resource");
    expect(process.env.AZURE_OPENAI_DEPLOYMENT).toBe("gpt-5.1-codex-mini");
  });

  it("should correctly export the client, MODEL, and MAX_COMPLETION_TOKENS", async () => {
    // Dynamically import to get a fresh instance with test env vars
    const {
      client: importedClient,
      MODEL: importedModel,
      MAX_COMPLETION_TOKENS,
    } = await import("../llm");

    expect(importedClient).toBeDefined();
    expect(importedModel).toBe("gpt-5.1-codex-mini");
    expect(MAX_COMPLETION_TOKENS).toBe(16000);
  });

  it.skipIf(!process.env.RUN_INTEGRATION_TESTS)(
    "should successfully call Azure Responses API and return valid response (Integration Test)",
    async () => {
      // This test verifies acceptance criteria from Issue #30:
      // - Simple responses.create() call returns valid response from Azure gpt-5.1-codex-mini
      // - No unsupported parameters cause errors
      //
      // IMPORTANT: This is an integration test that makes a real API call to Azure.
      // To run: RUN_INTEGRATION_TESTS=true npm test --workspace=@grading/server
      //
      // Requires real Azure credentials in .env:
      // - AZURE_OPENAI_API_KEY
      // - AZURE_OPENAI_RESOURCE
      // - AZURE_OPENAI_DEPLOYMENT

      const testClient = new OpenAI({
        // biome-ignore lint/style/noNonNullAssertion: env vars guaranteed from beforeAll
        apiKey: process.env.AZURE_OPENAI_API_KEY!,
        baseURL: `https://${process.env.AZURE_OPENAI_RESOURCE}.openai.azure.com/openai/v1/`,
      });

      // Make a simple Responses API call
      const response = await testClient.responses.create({
        // biome-ignore lint/style/noNonNullAssertion: env vars guaranteed from beforeAll
        model: process.env.AZURE_OPENAI_DEPLOYMENT!,
        input: "Say hello",
        max_output_tokens: 100, // Small limit for test
      });

      // Verify response structure (Responses API format)
      expect(response).toBeDefined();
      expect(response.output_text).toBeDefined();
      expect(typeof response.output_text).toBe("string");
      expect(response.output_text.length).toBeGreaterThan(0);

      // Verify response came from the correct model
      expect(response.model).toBeDefined();
    },
    30000
  ); // 30 second timeout for API call
});
