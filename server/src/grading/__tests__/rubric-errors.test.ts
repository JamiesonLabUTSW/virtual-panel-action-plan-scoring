import { beforeEach, describe, expect, it, vi } from "vitest";

// CRITICAL: Mock must be hoisted BEFORE any imports of rubric.ts
// This prevents line 68 (export const RUBRIC_TEXT = loadRubric()) from executing
// with real fs calls during module initialization
// Provide default valid return values so module initialization succeeds
vi.mock("node:fs", async () => {
  const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
  return {
    ...actual,
    // biome-ignore lint/security/noSecrets: False positive - rubric scoring anchors are not secrets
    readFileSync: vi.fn(() => "Poor\nWeak\nAdequate\nStrong\nExcellent"),
    existsSync: vi.fn(() => true),
  };
});

import { existsSync, readFileSync } from "node:fs";
import { loadRubric } from "../rubric";

describe("Rubric loadRubric() error handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset to default valid mock after each test
    vi.mocked(existsSync).mockReturnValue(true);
    // biome-ignore lint/security/noSecrets: False positive - rubric scoring anchors are not secrets
    vi.mocked(readFileSync).mockReturnValue("Poor\nWeak\nAdequate\nStrong\nExcellent");
  });

  it("throws on ENOENT when file not found", () => {
    const mockExistsSync = vi.mocked(existsSync);
    const mockReadFileSync = vi.mocked(readFileSync);

    mockExistsSync.mockReturnValue(true);
    const error = new Error("ENOENT: no such file") as NodeJS.ErrnoException;
    error.code = "ENOENT";
    mockReadFileSync.mockImplementation(() => {
      throw error;
    });

    expect(() => loadRubric()).toThrow(/Rubric file not found/);
    expect(() => loadRubric()).toThrow(/tried dev and prod paths/);
  });

  it("throws on EACCES with descriptive message", () => {
    const mockExistsSync = vi.mocked(existsSync);
    const mockReadFileSync = vi.mocked(readFileSync);

    mockExistsSync.mockReturnValue(true);
    const error = new Error("EACCES: permission denied") as NodeJS.ErrnoException;
    error.code = "EACCES";
    mockReadFileSync.mockImplementation(() => {
      throw error;
    });

    expect(() => loadRubric()).toThrow(/Failed to read rubric file at/);
    expect(() => loadRubric()).toThrow(/EACCES: permission denied/);
  });

  it("throws on generic I/O error without code property", () => {
    const mockExistsSync = vi.mocked(existsSync);
    const mockReadFileSync = vi.mocked(readFileSync);

    mockExistsSync.mockReturnValue(true);
    const error = new Error("Generic I/O error");
    mockReadFileSync.mockImplementation(() => {
      throw error;
    });

    expect(() => loadRubric()).toThrow(/Failed to read rubric file at/);
    expect(() => loadRubric()).toThrow(/Generic I\/O error/);
  });

  it("throws on empty file content", () => {
    const mockExistsSync = vi.mocked(existsSync);
    const mockReadFileSync = vi.mocked(readFileSync);

    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue("");

    expect(() => loadRubric()).toThrow(/Rubric file is empty/);
  });

  it("throws on whitespace-only file content", () => {
    const mockExistsSync = vi.mocked(existsSync);
    const mockReadFileSync = vi.mocked(readFileSync);

    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue("   \n\t  ");

    expect(() => loadRubric()).toThrow(/Rubric file is empty/);
  });

  it("throws when missing required scoring anchor (e.g., Excellent)", () => {
    const mockExistsSync = vi.mocked(existsSync);
    const mockReadFileSync = vi.mocked(readFileSync);

    mockExistsSync.mockReturnValue(true);
    // Valid rubric content but missing "Excellent" anchor
    mockReadFileSync.mockReturnValue(
      "Scoring Guide:\nPoor - 1\nWeak - 2\nAdequate - 3\nStrong - 4"
    );

    expect(() => loadRubric()).toThrow(/Rubric missing scoring anchors: Excellent/);
  });

  it("throws when missing multiple scoring anchors", () => {
    const mockExistsSync = vi.mocked(existsSync);
    const mockReadFileSync = vi.mocked(readFileSync);

    mockExistsSync.mockReturnValue(true);
    // Valid rubric content but missing "Weak", "Strong", "Excellent"
    mockReadFileSync.mockReturnValue("Scoring Guide:\nPoor - 1\nAdequate - 3");

    expect(() => loadRubric()).toThrow(/Rubric missing scoring anchors:/);
    expect(() => loadRubric()).toThrow(/Weak/);
    expect(() => loadRubric()).toThrow(/Strong/);
    expect(() => loadRubric()).toThrow(/Excellent/);
  });

  it("falls back to production path when dev path does not exist", () => {
    const mockExistsSync = vi.mocked(existsSync);
    const mockReadFileSync = vi.mocked(readFileSync);

    // Simulate dev path missing, prod path exists
    mockExistsSync.mockReturnValue(false);
    mockReadFileSync.mockReturnValue(
      "Scoring Guide:\nPoor - 1\nWeak - 2\nAdequate - 3\nStrong - 4\nExcellent - 5"
    );

    const result = loadRubric();

    expect(result).toBeTruthy();
    expect(result).toContain("Poor");
    expect(result).toContain("Excellent");
  });

  it("successfully loads valid rubric with all anchors", () => {
    const mockExistsSync = vi.mocked(existsSync);
    const mockReadFileSync = vi.mocked(readFileSync);

    mockExistsSync.mockReturnValue(true);
    const validRubric = `
Evaluation Rubric

Scoring Guide:
Poor - 1: Insufficient quality
Weak - 2: Below expectations
Adequate - 3: Meets basic requirements
Strong - 4: Above expectations
Excellent - 5: Outstanding quality
    `.trim();
    mockReadFileSync.mockReturnValue(validRubric);

    const result = loadRubric();

    expect(result).toBe(validRubric);
    expect(result).toContain("Poor");
    expect(result).toContain("Weak");
    expect(result).toContain("Adequate");
    expect(result).toContain("Strong");
    expect(result).toContain("Excellent");
  });
});
