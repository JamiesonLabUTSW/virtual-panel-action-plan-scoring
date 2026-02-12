import { describe, expect, it } from "vitest";
import { getAgreementStyle } from "../utils/agreement-styles";

describe("getAgreementStyle", () => {
  it("returns green for strong agreement", () => {
    const style = getAgreementStyle("strong");
    expect(style.hex).toBe("#22C55E");
    expect(style.label).toBe("Strong Agreement");
  });

  it("returns yellow for moderate agreement", () => {
    const style = getAgreementStyle("moderate");
    expect(style.hex).toBe("#EAB308");
    expect(style.label).toBe("Moderate Agreement");
  });

  it("returns red for weak agreement", () => {
    const style = getAgreementStyle("weak");
    expect(style.hex).toBe("#DC2626");
    expect(style.label).toBe("Weak Agreement");
  });

  it("returns fallback for null", () => {
    const style = getAgreementStyle(null);
    expect(style.hex).toBe("#6B7280");
    expect(style.label).toBe("Unknown");
  });

  it("returns fallback for undefined", () => {
    const style = getAgreementStyle(undefined);
    expect(style.label).toBe("Unknown");
  });

  it("returns fallback for unrecognized level", () => {
    const style = getAgreementStyle("very_strong");
    expect(style.label).toBe("Unknown");
  });
});
