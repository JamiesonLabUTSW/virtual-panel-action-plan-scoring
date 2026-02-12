import { describe, expect, it } from "vitest";
import { JUDGE_ORDER, JUDGE_PERSONAS } from "../utils/judge-personas";

describe("JUDGE_PERSONAS", () => {
  it("has all three raters", () => {
    expect(Object.keys(JUDGE_PERSONAS)).toEqual(["rater_a", "rater_b", "rater_c"]);
  });

  it("rater_a is The Professor with violet accent", () => {
    const p = JUDGE_PERSONAS.rater_a;
    expect(p.title).toBe("The Professor");
    expect(p.accentHex).toBe("#8B5CF6");
    expect(p.calibrationChip).toBe("Strict on structure");
  });

  it("rater_b is The Editor with cyan accent", () => {
    const p = JUDGE_PERSONAS.rater_b;
    expect(p.title).toBe("The Editor");
    expect(p.accentHex).toBe("#06B6D4");
    expect(p.calibrationChip).toBe("Generous on clarity");
  });

  it("rater_c is The Practitioner with amber accent", () => {
    const p = JUDGE_PERSONAS.rater_c;
    expect(p.title).toBe("The Practitioner");
    expect(p.accentHex).toBe("#F59E0B");
    expect(p.calibrationChip).toBe("Strict on actionability");
  });

  it("every persona has all required fields", () => {
    for (const persona of Object.values(JUDGE_PERSONAS)) {
      expect(persona.id).toBeTruthy();
      expect(persona.name).toBeTruthy();
      expect(persona.title).toBeTruthy();
      expect(persona.avatar).toBeTruthy();
      expect(persona.accentHex).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(persona.focusDescription).toBeTruthy();
    }
  });
});

describe("JUDGE_ORDER", () => {
  it("has all three raters in order", () => {
    expect(JUDGE_ORDER).toEqual(["rater_a", "rater_b", "rater_c"]);
  });
});
