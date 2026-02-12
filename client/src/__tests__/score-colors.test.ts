import { describe, expect, it } from "vitest";
import { getScoreStyle } from "../utils/score-colors";

describe("getScoreStyle", () => {
  it("returns correct style for score 1 (Poor)", () => {
    const style = getScoreStyle(1);
    expect(style.hex).toBe("#DC2626");
    expect(style.label).toBe("Poor");
    expect(style.textClass).toBe("text-score-1");
  });

  it("returns correct style for score 2 (Weak)", () => {
    const style = getScoreStyle(2);
    expect(style.hex).toBe("#F97316");
    expect(style.label).toBe("Weak");
  });

  it("returns correct style for score 3 (Adequate)", () => {
    const style = getScoreStyle(3);
    expect(style.hex).toBe("#EAB308");
    expect(style.label).toBe("Adequate");
  });

  it("returns correct style for score 4 (Strong)", () => {
    const style = getScoreStyle(4);
    expect(style.hex).toBe("#22C55E");
    expect(style.label).toBe("Strong");
  });

  it("returns correct style for score 5 (Excellent)", () => {
    const style = getScoreStyle(5);
    expect(style.hex).toBe("#16A34A");
    expect(style.label).toBe("Excellent");
  });

  it("returns fallback for null", () => {
    const style = getScoreStyle(null);
    expect(style.hex).toBe("#6B7280");
    expect(style.label).toBe("N/A");
  });

  it("returns fallback for undefined", () => {
    const style = getScoreStyle(undefined);
    expect(style.label).toBe("N/A");
  });

  it("returns fallback for 0 (out of range)", () => {
    const style = getScoreStyle(0);
    expect(style.label).toBe("N/A");
  });

  it("returns fallback for 6 (out of range)", () => {
    const style = getScoreStyle(6);
    expect(style.label).toBe("N/A");
  });

  it("returns fallback for negative numbers", () => {
    const style = getScoreStyle(-1);
    expect(style.label).toBe("N/A");
  });

  it("rounds fractional scores to nearest integer", () => {
    const style = getScoreStyle(3.7);
    expect(style.label).toBe("Strong");
  });
});
