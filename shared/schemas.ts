import { z } from "zod";

/**
 * ActionItemReview schema - Evaluation of a single action item within a proposal
 */
export const ActionItemReview = z.object({
  action_item_id: z.number().int().describe("Stable ID of the action item being reviewed"),
  comment: z.string().describe("Brief, constructive feedback (1-3 sentences)"),
  score: z.number().int().min(1).max(5).describe("Score from 1 (poor) to 5 (excellent)"),
});

/**
 * JudgeOutput schema - Complete evaluation from a single judge (log_review format)
 */
export const JudgeOutput = z.object({
  proposal_id: z.number().int().describe("Proposal identifier from the current request"),
  evaluator_id: z.number().int().describe("Persona ID of the evaluator"),
  evaluator_name: z.string().describe("Persona name of the evaluator"),
  items: z.array(ActionItemReview).min(1).describe("One review per action item"),
  overall_score: z.number().int().min(1).max(5).describe("Overall assessment score 1-5"),
});

/**
 * ConsensusOutput schema - Final reconciled grade from the consensus arbiter
 */
export const ConsensusOutput = z.object({
  final_score: z
    .number()
    .int()
    .min(1)
    .max(5)
    .describe("Reconciled final score — MUST be within [min(judge scores), max(judge scores)]"),
  rationale: z
    .string()
    .describe(
      "3-5 sentence synthesis using judge rationales and evidence, NOT new document analysis"
    ),
  agreement: z.object({
    scores: z.object({
      rater_a: z.number().int().min(1).max(5).describe("Score from Rater A"),
      rater_b: z.number().int().min(1).max(5).describe("Score from Rater B"),
      rater_c: z.number().int().min(1).max(5).describe("Score from Rater C"),
    }),
    mean_score: z
      .number()
      .min(1)
      .max(5)
      .describe("Arithmetic mean of judge scores, rounded to 1 decimal"),
    median_score: z.number().int().min(1).max(5).describe("Median of judge scores"),
    spread: z.number().int().min(0).max(4).describe("Max score minus min score across judges"),
    agreement_level: z
      .enum(["strong", "moderate", "weak"])
      .describe("strong = spread 0-1, moderate = spread 2, weak = spread 3-4"),
    disagreement_analysis: z
      .string()
      .describe(
        "Why judges differed, referencing their calibration perspectives and specific evidence they cited"
      ),
  }),
  improvements: z
    .array(z.string())
    .min(1)
    .max(5)
    .describe("Consolidated improvement suggestions from all judges, deduplicated"),
});

/**
 * Inferred types from Zod schemas
 */
export type ActionItemReviewType = z.infer<typeof ActionItemReview>;
export type JudgeOutputType = z.infer<typeof JudgeOutput>;
export type ConsensusOutputType = z.infer<typeof ConsensusOutput>;
