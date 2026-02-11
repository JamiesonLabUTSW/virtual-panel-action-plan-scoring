/**
 * Error types for structured output operations
 *
 * These errors provide detailed diagnostics when structured output fails,
 * including which tiers were attempted and why they failed.
 */

export interface TierAttempt {
  tier: 1 | 2 | 3;
  tierName: string;
  success: boolean;
  error?: Error;
  durationMs: number;
}

/**
 * Thrown when all 3 tiers of structured output fallback fail
 */
export class StructuredOutputError extends Error {
  constructor(
    message: string,
    public readonly attempts: TierAttempt[],
    public readonly finalError: Error,
  ) {
    super(message);
    this.name = "StructuredOutputError";
  }

  /**
   * Returns a formatted summary of all tier attempts for logging
   */
  getSummary(): string {
    const attemptSummary = this.attempts
      .map(
        (a) =>
          `  Tier ${a.tier} (${a.tierName}): ${a.success ? "✓ SUCCESS" : "✗ FAILED"} in ${a.durationMs}ms${
            a.error ? ` - ${a.error.message}` : ""
          }`,
      )
      .join("\n");

    return `Structured output failed after ${this.attempts.length} attempts:\n${attemptSummary}\n\nFinal error: ${this.finalError.message}`;
  }
}
