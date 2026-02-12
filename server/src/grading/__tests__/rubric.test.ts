import { describe, expect, it } from "vitest";
import { RUBRIC_TEXT } from "../rubric";

describe("Rubric Module (Issue #31)", () => {
  it("should load rubric text successfully", () => {
    expect(RUBRIC_TEXT).toBeDefined();
    expect(typeof RUBRIC_TEXT).toBe("string");
    expect(RUBRIC_TEXT.trim().length).toBeGreaterThan(0);
  });

  it("should contain all required scoring anchors", () => {
    const anchors = ["Poor", "Weak", "Adequate", "Strong", "Excellent"];

    for (const anchor of anchors) {
      expect(RUBRIC_TEXT).toContain(anchor);
    }
  });

  it("should contain role and objective sections", () => {
    expect(RUBRIC_TEXT).toContain("ROLE");
    expect(RUBRIC_TEXT).toContain("PRIMARY OBJECTIVE");
    expect(RUBRIC_TEXT).toContain("SCORING ANCHORS");
  });
});
