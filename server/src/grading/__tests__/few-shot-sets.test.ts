import { describe, expect, it } from "vitest";
import { RATER_A_EXAMPLES, RATER_B_EXAMPLES, RATER_C_EXAMPLES } from "../few-shot-sets";

describe("Few-Shot Sets Module (Issue #32)", () => {
  describe("Module exports", () => {
    it("should export RATER_A_EXAMPLES as non-empty string", () => {
      expect(RATER_A_EXAMPLES).toBeDefined();
      expect(typeof RATER_A_EXAMPLES).toBe("string");
      expect(RATER_A_EXAMPLES.trim().length).toBeGreaterThan(0);
    });

    it("should export RATER_B_EXAMPLES as non-empty string", () => {
      expect(RATER_B_EXAMPLES).toBeDefined();
      expect(typeof RATER_B_EXAMPLES).toBe("string");
      expect(RATER_B_EXAMPLES.trim().length).toBeGreaterThan(0);
    });

    it("should export RATER_C_EXAMPLES as non-empty string", () => {
      expect(RATER_C_EXAMPLES).toBeDefined();
      expect(typeof RATER_C_EXAMPLES).toBe("string");
      expect(RATER_C_EXAMPLES.trim().length).toBeGreaterThan(0);
    });
  });

  describe("RATER_A_EXAMPLES structure", () => {
    it("should contain Rater A evaluator name", () => {
      expect(RATER_A_EXAMPLES).toContain('"evaluator_name": "Rater A"');
    });

    it("should contain evaluator_id 1", () => {
      expect(RATER_A_EXAMPLES).toContain('"evaluator_id": 1');
    });

    it("should contain exactly 5 examples", () => {
      const exampleCount = (RATER_A_EXAMPLES.match(/### Example:/g) || []).length;
      expect(exampleCount).toBe(5);
    });

    it("should contain expected specialties", () => {
      expect(RATER_A_EXAMPLES).toContain("Surgery");
      expect(RATER_A_EXAMPLES).toContain("Emergency Medicine");
      expect(RATER_A_EXAMPLES).toContain("Internal Medicine");
      expect(RATER_A_EXAMPLES).toContain("Obstetrics And Gynecology");
      expect(RATER_A_EXAMPLES).toContain("Anesthesiology");
    });

    it("should contain scores in range 1-5", () => {
      const scoreMatches = RATER_A_EXAMPLES.match(/"score": (\d)/g) || [];
      expect(scoreMatches.length).toBeGreaterThan(0);
      for (const match of scoreMatches) {
        const score = Number.parseInt(match.match(/\d/)?.[0] || "0");
        expect(score).toBeGreaterThanOrEqual(1);
        expect(score).toBeLessThanOrEqual(5);
      }
    });
  });

  describe("RATER_B_EXAMPLES structure", () => {
    it("should contain Rater B evaluator name", () => {
      expect(RATER_B_EXAMPLES).toContain('"evaluator_name": "Rater B"');
    });

    it("should contain evaluator_id 2", () => {
      expect(RATER_B_EXAMPLES).toContain('"evaluator_id": 2');
    });

    it("should contain exactly 5 examples", () => {
      const exampleCount = (RATER_B_EXAMPLES.match(/### Example:/g) || []).length;
      expect(exampleCount).toBe(5);
    });

    it("should contain expected specialties", () => {
      expect(RATER_B_EXAMPLES).toContain("Surgery");
      expect(RATER_B_EXAMPLES).toContain("Emergency Medicine");
      expect(RATER_B_EXAMPLES).toContain("Internal Medicine");
      expect(RATER_B_EXAMPLES).toContain("Family Medicine");
      expect(RATER_B_EXAMPLES).toContain("Anesthesiology");
    });

    it("should contain scores in range 1-5", () => {
      const scoreMatches = RATER_B_EXAMPLES.match(/"score": (\d)/g) || [];
      expect(scoreMatches.length).toBeGreaterThan(0);
      for (const match of scoreMatches) {
        const score = Number.parseInt(match.match(/\d/)?.[0] || "0");
        expect(score).toBeGreaterThanOrEqual(1);
        expect(score).toBeLessThanOrEqual(5);
      }
    });
  });

  describe("RATER_C_EXAMPLES structure", () => {
    it("should contain Rater C evaluator name", () => {
      expect(RATER_C_EXAMPLES).toContain('"evaluator_name": "Rater C"');
    });

    it("should contain evaluator_id 3", () => {
      expect(RATER_C_EXAMPLES).toContain('"evaluator_id": 3');
    });

    it("should contain exactly 5 examples", () => {
      const exampleCount = (RATER_C_EXAMPLES.match(/### Example:/g) || []).length;
      expect(exampleCount).toBe(5);
    });

    it("should contain expected specialties", () => {
      expect(RATER_C_EXAMPLES).toContain("Surgery");
      expect(RATER_C_EXAMPLES).toContain("Pediatrics");
      expect(RATER_C_EXAMPLES).toContain("Emergency Medicine");
      expect(RATER_C_EXAMPLES).toContain("Internal Medicine");
      expect(RATER_C_EXAMPLES).toContain("Anesthesiology");
    });

    it("should contain scores in range 1-5", () => {
      const scoreMatches = RATER_C_EXAMPLES.match(/"score": (\d)/g) || [];
      expect(scoreMatches.length).toBeGreaterThan(0);
      for (const match of scoreMatches) {
        const score = Number.parseInt(match.match(/\d/)?.[0] || "0");
        expect(score).toBeGreaterThanOrEqual(1);
        expect(score).toBeLessThanOrEqual(5);
      }
    });
  });

  describe("Format validation", () => {
    it("should contain Action Items sections", () => {
      expect(RATER_A_EXAMPLES).toContain("**Action Items:**");
      expect(RATER_B_EXAMPLES).toContain("**Action Items:**");
      expect(RATER_C_EXAMPLES).toContain("**Action Items:**");
    });

    it("should contain Evaluation sections", () => {
      expect(RATER_A_EXAMPLES).toContain("**Evaluation:**");
      expect(RATER_B_EXAMPLES).toContain("**Evaluation:**");
      expect(RATER_C_EXAMPLES).toContain("**Evaluation:**");
    });

    it("should contain proper separators", () => {
      expect(RATER_A_EXAMPLES).toContain("---");
      expect(RATER_B_EXAMPLES).toContain("---");
      expect(RATER_C_EXAMPLES).toContain("---");
    });

    it("should contain proposal_id fields", () => {
      expect(RATER_A_EXAMPLES).toContain('"proposal_id"');
      expect(RATER_B_EXAMPLES).toContain('"proposal_id"');
      expect(RATER_C_EXAMPLES).toContain('"proposal_id"');
    });

    it("should contain items arrays", () => {
      expect(RATER_A_EXAMPLES).toContain('"items"');
      expect(RATER_B_EXAMPLES).toContain('"items"');
      expect(RATER_C_EXAMPLES).toContain('"items"');
    });

    it("should contain overall_score fields", () => {
      expect(RATER_A_EXAMPLES).toContain('"overall_score"');
      expect(RATER_B_EXAMPLES).toContain('"overall_score"');
      expect(RATER_C_EXAMPLES).toContain('"overall_score"');
    });
  });

  describe("Integration tests (gated)", () => {
    it.skipIf(!process.env.RUN_INTEGRATION_TESTS)(
      "should contain parseable JSON evaluation blocks",
      () => {
        // Test Rater A
        const raterAMatches = RATER_A_EXAMPLES.match(/\*\*Evaluation:\*\*\n({[\s\S]*?})\n\n---/g);
        expect(raterAMatches).toBeDefined();
        expect(raterAMatches?.length).toBe(5);

        for (const match of raterAMatches || []) {
          const jsonStr = match.replace(/\*\*Evaluation:\*\*\n/, "").replace(/\n\n---/, "");
          // biome-ignore lint/suspicious/noExplicitAny: JSON.parse is untyped
          const parsed = JSON.parse(jsonStr) as any;
          expect(parsed).toHaveProperty("proposal_id");
          expect(parsed).toHaveProperty("evaluator_id", 1);
          expect(parsed).toHaveProperty("evaluator_name", "Rater A");
          expect(parsed).toHaveProperty("items");
          expect(parsed).toHaveProperty("overall_score");
          expect(Array.isArray(parsed.items)).toBe(true);
          expect(parsed.items.length).toBeGreaterThan(0);
        }

        // Test Rater B
        const raterBMatches = RATER_B_EXAMPLES.match(/\*\*Evaluation:\*\*\n({[\s\S]*?})\n\n---/g);
        expect(raterBMatches).toBeDefined();
        expect(raterBMatches?.length).toBe(5);

        for (const match of raterBMatches || []) {
          const jsonStr = match.replace(/\*\*Evaluation:\*\*\n/, "").replace(/\n\n---/, "");
          // biome-ignore lint/suspicious/noExplicitAny: JSON.parse is untyped
          const parsed = JSON.parse(jsonStr) as any;
          expect(parsed).toHaveProperty("evaluator_id", 2);
          expect(parsed).toHaveProperty("evaluator_name", "Rater B");
        }

        // Test Rater C
        const raterCMatches = RATER_C_EXAMPLES.match(/\*\*Evaluation:\*\*\n({[\s\S]*?})\n\n---/g);
        expect(raterCMatches).toBeDefined();
        expect(raterCMatches?.length).toBe(5);

        for (const match of raterCMatches || []) {
          const jsonStr = match.replace(/\*\*Evaluation:\*\*\n/, "").replace(/\n\n---/, "");
          // biome-ignore lint/suspicious/noExplicitAny: JSON.parse is untyped
          const parsed = JSON.parse(jsonStr) as any;
          expect(parsed).toHaveProperty("evaluator_id", 3);
          expect(parsed).toHaveProperty("evaluator_name", "Rater C");
        }
      }
    );
  });
});
