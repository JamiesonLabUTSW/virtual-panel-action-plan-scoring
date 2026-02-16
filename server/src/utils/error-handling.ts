/**
 * Error handling utilities for API errors that may have status codes and messages.
 * Useful for handling OpenAI SDK errors and Azure-augmented errors.
 */

/**
 * Represents an API error that extends Error with optional status and message properties.
 * Covers OpenAI SDK errors, Azure errors, and network errors.
 */
interface APIErrorLike extends Error {
  status?: number;
  message: string;
}

/**
 * Type guard to check if an error is an APIErrorLike.
 * Returns true if the error is an Error instance (which may have status/message properties).
 */
export function isAPIErrorLike(error: unknown): error is APIErrorLike {
  return error instanceof Error;
}
