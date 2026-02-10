import { z } from "zod";

/**
 * EvidenceQuote schema - A direct quote from the document with supporting information
 */
export const EvidenceQuote = z.object({
  quote: z.string()
    .describe("Direct quote from the document (15-50 words)"),
  supports: z.enum(["Clarity", "Reasoning", "Completeness"])
    .describe("Which criterion this evidence supports or undermines"),
  valence: z.enum(["positive", "negative"])
    .describe("Whether this evidence is a strength or weakness"),
});

/**
 * CriterionScore schema - Score for a single rubric criterion
 */
export const CriterionScore = z.object({
  name: z.enum(["Clarity", "Reasoning", "Completeness"])
    .describe("Name of the criterion"),
  score: z.number().int().min(1).max(5)
    .describe("Score from 1 (poor) to 5 (excellent)"),
  notes: z.string()
    .describe("2-3 sentence explanation for this criterion score"),
  evidence_quotes: z.array(z.string()).min(1).max(3)
    .describe("1-3 direct quotes from the document supporting this score"),
});

/**
 * JudgeOutput schema - Complete evaluation from a single judge
 */
export const JudgeOutput = z.object({
  overall_score: z.number().int().min(1).max(5)
    .describe("Holistic score from 1 to 5, not a simple average of criteria"),
  confidence: z.number().min(0).max(1)
    .describe("0.9 = clear mapping to rubric anchors; 0.6 = borderline between anchors; 0.3 = missing info or ambiguous document"),
  rationale: z.string()
    .describe("3-5 sentence overall rationale grounded in specific document evidence"),
  criteria: z.array(CriterionScore).length(3)
    .describe("Scores for each of the three rubric criteria"),
  key_evidence: z.array(EvidenceQuote).min(2).max(6)
    .describe("Most important evidence quotes from the document"),
  strengths: z.array(z.string()).min(1).max(3)
    .describe("Key strengths of the document"),
  improvements: z.array(z.string()).min(1).max(3)
    .describe("Specific, actionable suggestions for improvement"),
});

/**
 * ConsensusOutput schema - Final reconciled grade from the consensus arbiter
 */
export const ConsensusOutput = z.object({
  final_score: z.number().int().min(1).max(5)
    .describe("Reconciled final score — MUST be within [min(judge scores), max(judge scores)]"),
  rationale: z.string()
    .describe("3-5 sentence synthesis using judge rationales and evidence, NOT new document analysis"),
  agreement: z.object({
    scores: z.object({
      rater_a: z.number().int().min(1).max(5)
        .describe("Judge A's overall score"),
      rater_b: z.number().int().min(1).max(5)
        .describe("Judge B's overall score"),
      rater_c: z.number().int().min(1).max(5)
        .describe("Judge C's overall score"),
    })
      .describe("Individual judge scores"),
    mean_score: z.number().min(1).max(5)
      .describe("Arithmetic mean of judge scores, rounded to 1 decimal"),
    median_score: z.number().int().min(1).max(5)
      .describe("Median of judge scores"),
    spread: z.number().int().min(0).max(4)
      .describe("Max score minus min score across judges"),
    agreement_level: z.enum(["strong", "moderate", "weak"])
      .describe("strong = spread 0-1, moderate = spread 2, weak = spread 3-4"),
    disagreement_analysis: z.string()
      .describe("Why judges differed, referencing their calibration perspectives and specific evidence they cited"),
  })
    .describe("Analysis of judge agreement and disagreement"),
  criteria: z.array(CriterionScore).length(3)
    .describe("Final reconciled scores per criterion"),
  improvements: z.array(z.string()).min(1).max(5)
    .describe("Consolidated improvement suggestions from all judges, deduplicated"),
});

/**
 * Inferred types from Zod schemas
 */
export type JudgeOutputType = z.infer<typeof JudgeOutput>;
export type ConsensusOutputType = z.infer<typeof ConsensusOutput>;
