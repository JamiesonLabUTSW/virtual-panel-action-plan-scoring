/**
 * Environment variable validation utilities
 * Extracted for testability (Issue #21)
 */

export interface EnvValidationResult {
  isValid: boolean;
  missingVars: string[];
  values: {
    AZURE_OPENAI_API_KEY?: string;
    AZURE_OPENAI_RESOURCE?: string;
    AZURE_OPENAI_DEPLOYMENT?: string;
  };
}

/**
 * Validates required Azure OpenAI environment variables
 * @param env - Environment object (defaults to process.env)
 * @returns Validation result with missing variables and values
 */
export function validateRequiredEnvVars(env: NodeJS.ProcessEnv = process.env): EnvValidationResult {
  const requiredVars = ["AZURE_OPENAI_API_KEY", "AZURE_OPENAI_RESOURCE", "AZURE_OPENAI_DEPLOYMENT"];

  const missingVars = requiredVars.filter((envVar) => !env[envVar]);

  return {
    isValid: missingVars.length === 0,
    missingVars,
    values: {
      AZURE_OPENAI_API_KEY: env.AZURE_OPENAI_API_KEY,
      AZURE_OPENAI_RESOURCE: env.AZURE_OPENAI_RESOURCE,
      AZURE_OPENAI_DEPLOYMENT: env.AZURE_OPENAI_DEPLOYMENT,
    },
  };
}

/**
 * Logs validation errors and exits process if validation fails.
 * This function never returns if validation fails (terminates via process.exit(1)).
 * @param result - Validation result from validateRequiredEnvVars
 * @throws Terminates process with exit code 1 on validation failure
 */
export function exitIfInvalid(result: EnvValidationResult): void {
  if (!result.isValid) {
    console.error("❌ Missing required environment variables:");
    for (const envVar of result.missingVars) {
      console.error(`   - ${envVar}`);
    }
    process.exit(1);
  }
}
