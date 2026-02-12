/**
 * Structured output with 3-tier fallback using OpenAI SDK v6 Responses API
 *
 * Uses the Responses API (client.responses.create) for reasoning models like gpt-5.1-codex-mini
 * that do not support the Chat Completions API.
 *
 * Implements a robust structured output strategy:
 * - Tier 1: JSON Schema strict mode (response_format with strict: true)
 * - Tier 2: JSON Schema non-strict mode (response_format without strict)
 * - Tier 3: JSON Object mode + runtime Zod validation
 *
 * Each tier is attempted sequentially. If a tier fails (API error or validation error),
 * the next tier is tried. If all 3 tiers fail, a StructuredOutputError is thrown.
 */

import { zodTextFormat } from "openai/helpers/zod";
import type { ZodSchema } from "zod";
import { MAX_COMPLETION_TOKENS, MODEL, client } from "./llm";
import { StructuredOutputError, type TierAttempt } from "./structured-output-errors";

export interface InvokeOptions {
  /**
   * System prompt
   */
  system: string;

  /**
   * User message
   */
  user: string;

  /**
   * Maximum completion tokens (default: 2000)
   */
  maxCompletionTokens?: number;

  /**
   * Schema name for json_schema mode (default: "output")
   */
  schemaName?: string;
}

export interface StructuredInvokeResult<T> {
  /**
   * Validated result matching the schema
   */
  result: T;

  /**
   * Which tier succeeded (1, 2, or 3)
   */
  tier: 1 | 2 | 3;

  /**
   * Token usage
   */
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * Tier configuration for text format (Responses API)
 */
interface TierConfig {
  tier: 1 | 2 | 3;
  getTextFormat: (schemaName: string, jsonSchema: unknown) => unknown;
}

/**
 * Tier configurations for 3-tier fallback
 *
 * Responses API uses text.format instead of response_format
 */
const TIER_CONFIGS: TierConfig[] = [
  {
    tier: 1,
    getTextFormat: (schemaName: string, jsonSchema: unknown) => ({
      format: {
        type: "json_schema",
        name: schemaName,
        // biome-ignore lint/suspicious/noExplicitAny: JSON schema is dynamic
        schema: jsonSchema as any,
        strict: true,
      },
    }),
  },
  {
    tier: 2,
    getTextFormat: (schemaName: string, jsonSchema: unknown) => ({
      format: {
        type: "json_schema",
        name: schemaName,
        // biome-ignore lint/suspicious/noExplicitAny: JSON schema is dynamic
        schema: jsonSchema as any,
        // Omit strict: true to allow non-strict validation
      },
    }),
  },
  {
    tier: 3,
    getTextFormat: (_schemaName: string, _jsonSchema: unknown) => ({
      format: {
        type: "json_object",
      },
    }),
  },
];

/**
 * Get tier name for logging
 */
function getTierName(tier: 1 | 2 | 3): string {
  const names = {
    1: "JSON Schema strict",
    2: "JSON Schema non-strict",
    3: "JSON Object + Zod",
  };
  return names[tier];
}

/**
 * Attempt a single tier with proper error handling
 */
async function attemptTier<T>(
  tierConfig: TierConfig,
  // biome-ignore lint/suspicious/noExplicitAny: Schema validation happens at runtime
  schema: ZodSchema<any>,
  options: {
    system: string;
    user: string;
    maxTokens: number;
    schemaName: string;
    jsonSchema: unknown;
  }
): Promise<
  | { success: true; result: T; usage: StructuredInvokeResult<T>["usage"] }
  | { success: false; error: Error; durationMs: number }
> {
  const startTime = Date.now();

  try {
    // Use Responses API for reasoning models (gpt-5.1-codex-mini)
    // Responses API uses input/instructions instead of messages array
    const response = await client.responses.create({
      model: MODEL,
      instructions: options.system, // System prompt becomes instructions
      input: options.user, // User message becomes input
      text: tierConfig.getTextFormat(options.schemaName, options.jsonSchema) as any,
      max_output_tokens: options.maxTokens,
    } as any); // Type assertion needed due to SDK type limitations

    // biome-ignore lint/suspicious/noExplicitAny: Response shape varies between SDK types
    const responseObj = response as any;

    // Check response status before accessing content
    if (responseObj.status && responseObj.status !== "completed") {
      const details = responseObj.incomplete_details
        ? `: ${JSON.stringify(responseObj.incomplete_details)}`
        : "";
      throw new Error(`Azure Responses API returned status "${responseObj.status}"${details}`);
    }

    // Responses API uses output_text (convenience) or output[].content[].text
    const content = responseObj.output_text;
    if (!content) {
      throw new Error(
        `No output_text from Azure Responses API (status: ${responseObj.status ?? "unknown"}). ` +
          `Response: ${JSON.stringify(response).substring(0, 300)}`
      );
    }

    // Parse JSON with better error handling
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch (parseError) {
      throw new Error(
        `JSON.parse failed: ${parseError instanceof Error ? parseError.message : String(parseError)}. Content (first 200 chars): ${content.substring(0, 200)}`
      );
    }

    // Validate with Zod
    let validated: T;
    try {
      validated = schema.parse(parsed) as T;
    } catch (zodError) {
      throw new Error(
        `Zod validation failed: ${zodError instanceof Error ? zodError.message : String(zodError)}`
      );
    }

    return {
      success: true,
      result: validated,
      usage: {
        // Responses API uses input_tokens/output_tokens (not prompt_tokens/completion_tokens)
        promptTokens: responseObj.usage?.input_tokens ?? 0,
        completionTokens: responseObj.usage?.output_tokens ?? 0,
        totalTokens: responseObj.usage?.total_tokens ?? 0,
      },
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
      durationMs,
    };
  }
}

/**
 * Invoke OpenAI with structured output and 3-tier fallback
 *
 * @param schema - Zod schema for validation
 * @param options - Invoke options (system, user, maxCompletionTokens)
 * @returns Validated result with tier information
 * @throws StructuredOutputError if all tiers fail
 */
export async function invokeWithStructuredOutput<T>(
  // biome-ignore lint/suspicious/noExplicitAny: Schema validation happens at runtime
  schema: ZodSchema<any>,
  options: InvokeOptions
): Promise<StructuredInvokeResult<T>> {
  const attempts: TierAttempt[] = [];
  let lastError: Error = new Error("Unknown error");

  const maxTokens = options.maxCompletionTokens ?? MAX_COMPLETION_TOKENS;
  const schemaName = options.schemaName ?? "output";

  // Convert Zod schema to JSON Schema using OpenAI SDK's built-in zodTextFormat
  // This handles Zod v4 correctly (zod-to-json-schema v3 produces {} for Zod v4)
  const textFormat = zodTextFormat(schema, schemaName);
  // biome-ignore lint/suspicious/noExplicitAny: Schema is a Record from zodTextFormat
  const jsonSchema = { ...(textFormat.schema as any) };
  // Remove $schema meta-field (not required by API, may cause issues with Azure)
  jsonSchema.$schema = undefined;

  // Try each tier sequentially
  for (const tierConfig of TIER_CONFIGS) {
    const tierStartTime = Date.now();
    const result = await attemptTier<T>(tierConfig, schema, {
      system: options.system,
      user: options.user,
      maxTokens,
      schemaName,
      jsonSchema,
    });

    if (result.success) {
      // Success - record attempt and return
      attempts.push({
        tier: tierConfig.tier,
        tierName: getTierName(tierConfig.tier),
        success: true,
        durationMs: Date.now() - tierStartTime,
      });

      return {
        result: result.result,
        tier: tierConfig.tier,
        usage: result.usage,
      };
    }

    // Failure - record attempt and continue to next tier
    lastError = result.error;
    attempts.push({
      tier: tierConfig.tier,
      tierName: getTierName(tierConfig.tier),
      success: false,
      error: result.error,
      durationMs: result.durationMs,
    });
  }

  // All tiers failed
  const error = new StructuredOutputError(
    "All 3 tiers of structured output failed",
    attempts,
    lastError
  );

  throw error;
}
