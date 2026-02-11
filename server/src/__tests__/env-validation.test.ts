import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { exitIfInvalid, validateRequiredEnvVars } from "../config/env-validation";

/**
 * Unit tests for environment variable validation (Issue #21)
 */

describe("validateRequiredEnvVars", () => {
  it("should return valid when all required env vars are present", () => {
    const mockEnv = {
      AZURE_OPENAI_API_KEY: "test-key",
      AZURE_OPENAI_RESOURCE: "test-resource",
      AZURE_OPENAI_DEPLOYMENT: "test-deployment",
    };

    const result = validateRequiredEnvVars(mockEnv);

    expect(result.isValid).toBe(true);
    expect(result.missingVars).toEqual([]);
    expect(result.values.AZURE_OPENAI_API_KEY).toBe("test-key");
    expect(result.values.AZURE_OPENAI_RESOURCE).toBe("test-resource");
    expect(result.values.AZURE_OPENAI_DEPLOYMENT).toBe("test-deployment");
  });

  it("should return invalid when AZURE_OPENAI_API_KEY is missing", () => {
    const mockEnv = {
      AZURE_OPENAI_RESOURCE: "test-resource",
      AZURE_OPENAI_DEPLOYMENT: "test-deployment",
    };

    const result = validateRequiredEnvVars(mockEnv);

    expect(result.isValid).toBe(false);
    expect(result.missingVars).toEqual(["AZURE_OPENAI_API_KEY"]);
  });

  it("should return invalid when AZURE_OPENAI_RESOURCE is missing", () => {
    const mockEnv = {
      AZURE_OPENAI_API_KEY: "test-key",
      AZURE_OPENAI_DEPLOYMENT: "test-deployment",
    };

    const result = validateRequiredEnvVars(mockEnv);

    expect(result.isValid).toBe(false);
    expect(result.missingVars).toEqual(["AZURE_OPENAI_RESOURCE"]);
  });

  it("should return invalid when AZURE_OPENAI_DEPLOYMENT is missing", () => {
    const mockEnv = {
      AZURE_OPENAI_API_KEY: "test-key",
      AZURE_OPENAI_RESOURCE: "test-resource",
    };

    const result = validateRequiredEnvVars(mockEnv);

    expect(result.isValid).toBe(false);
    expect(result.missingVars).toEqual(["AZURE_OPENAI_DEPLOYMENT"]);
  });

  it("should return invalid with multiple missing vars", () => {
    const mockEnv = {
      AZURE_OPENAI_API_KEY: "test-key",
    };

    const result = validateRequiredEnvVars(mockEnv);

    expect(result.isValid).toBe(false);
    expect(result.missingVars).toEqual(["AZURE_OPENAI_RESOURCE", "AZURE_OPENAI_DEPLOYMENT"]);
  });

  it("should return invalid when all vars are missing", () => {
    const mockEnv = {};

    const result = validateRequiredEnvVars(mockEnv);

    expect(result.isValid).toBe(false);
    expect(result.missingVars).toEqual([
      "AZURE_OPENAI_API_KEY",
      "AZURE_OPENAI_RESOURCE",
      "AZURE_OPENAI_DEPLOYMENT",
    ]);
  });

  it("should return string values (not undefined) when all vars are present", () => {
    const mockEnv = {
      AZURE_OPENAI_API_KEY: "test-key",
      AZURE_OPENAI_RESOURCE: "test-resource",
      AZURE_OPENAI_DEPLOYMENT: "test-deployment",
    };

    const result = validateRequiredEnvVars(mockEnv);

    // Verify values are returned (not undefined)
    expect(result.values.AZURE_OPENAI_API_KEY).toBeDefined();
    expect(result.values.AZURE_OPENAI_RESOURCE).toBeDefined();
    expect(result.values.AZURE_OPENAI_DEPLOYMENT).toBeDefined();

    // Verify they're strings
    expect(typeof result.values.AZURE_OPENAI_API_KEY).toBe("string");
    expect(typeof result.values.AZURE_OPENAI_RESOURCE).toBe("string");
    expect(typeof result.values.AZURE_OPENAI_DEPLOYMENT).toBe("string");
  });
});

describe("exitIfInvalid", () => {
  // biome-ignore lint/suspicious/noExplicitAny: Vitest spy types are complex
  let consoleErrorSpy: any;
  // biome-ignore lint/suspicious/noExplicitAny: Vitest spy types are complex
  let processExitSpy: any;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, "exit").mockImplementation((() => {}) as never);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  it("should not exit when validation result is valid", () => {
    const validResult = {
      isValid: true,
      missingVars: [],
      values: {
        AZURE_OPENAI_API_KEY: "test-key",
        AZURE_OPENAI_RESOURCE: "test-resource",
        AZURE_OPENAI_DEPLOYMENT: "test-deployment",
      },
    };

    exitIfInvalid(validResult);

    expect(processExitSpy).not.toHaveBeenCalled();
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it("should exit with code 1 when validation result is invalid", () => {
    const invalidResult = {
      isValid: false,
      missingVars: ["AZURE_OPENAI_API_KEY"],
      values: {},
    };

    exitIfInvalid(invalidResult);

    expect(processExitSpy).toHaveBeenCalledWith(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith("❌ Missing required environment variables:");
    expect(consoleErrorSpy).toHaveBeenCalledWith("   - AZURE_OPENAI_API_KEY");
  });

  it("should log all missing variables", () => {
    const invalidResult = {
      isValid: false,
      missingVars: ["AZURE_OPENAI_API_KEY", "AZURE_OPENAI_RESOURCE", "AZURE_OPENAI_DEPLOYMENT"],
      values: {},
    };

    exitIfInvalid(invalidResult);

    expect(processExitSpy).toHaveBeenCalledWith(1);
    expect(consoleErrorSpy).toHaveBeenCalledTimes(4); // 1 header + 3 vars
    expect(consoleErrorSpy).toHaveBeenCalledWith("   - AZURE_OPENAI_API_KEY");
    expect(consoleErrorSpy).toHaveBeenCalledWith("   - AZURE_OPENAI_RESOURCE");
    expect(consoleErrorSpy).toHaveBeenCalledWith("   - AZURE_OPENAI_DEPLOYMENT");
  });
});
