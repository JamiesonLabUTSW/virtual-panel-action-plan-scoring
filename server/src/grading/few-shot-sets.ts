import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Rater metadata for calibration example generation.
 */
interface RaterConfig {
  id: number;
  name: string;
  specialties: string[];
}

/**
 * Shape of rating JSON files.
 */
interface RatingData {
  program: string;
  rationale: string;
  score: number;
}

/**
 * Rater configurations matching issue #32 requirements:
 * - Rater A: surgery (5), emergency_medicine (5), internal_medicine (3), obstetrics_and_gynecology (2), anesthesiology (2)
 * - Rater B: surgery (5), emergency_medicine (5), internal_medicine (4), family_medicine (3), anesthesiology (3)
 * - Rater C: surgery (5), pediatrics (5), emergency_medicine (4), internal_medicine (3), anesthesiology (2)
 */
const RATER_CONFIGS: RaterConfig[] = [
  {
    id: 1,
    name: "Rater A",
    specialties: [
      "surgery",
      "emergency_medicine",
      "internal_medicine",
      "obstetrics_and_gynecology",
      "anesthesiology",
    ],
  },
  {
    id: 2,
    name: "Rater B",
    specialties: [
      "surgery",
      "emergency_medicine",
      "internal_medicine",
      "family_medicine",
      "anesthesiology",
    ],
  },
  {
    id: 3,
    name: "Rater C",
    specialties: [
      "surgery",
      "pediatrics",
      "emergency_medicine",
      "internal_medicine",
      "anesthesiology",
    ],
  },
];

/**
 * Resolves resource file paths for both dev and production environments.
 * - Dev: __dirname is src/grading/, resources at ../resources/
 * - Prod: __dirname is dist/, resources copied directly to dist/ (tsup publicDir flattens)
 */
function getResourcePath(relativePath: string): string {
  const devPath = path.join(__dirname, `../resources/${relativePath}`);
  const prodPath = path.join(__dirname, `./${relativePath}`);

  if (existsSync(devPath)) {
    return devPath;
  }
  if (existsSync(prodPath)) {
    return prodPath;
  }

  throw new Error(`Resource file not found: ${relativePath} (tried ${devPath} and ${prodPath})`);
}

/**
 * Loads and validates an action item markdown file.
 */
function loadActionItem(specialty: string): string {
  const filePath = getResourcePath(`action_item/${specialty}.md`);

  try {
    const content = readFileSync(filePath, "utf-8");
    if (!content.trim()) {
      throw new Error(`Action item file is empty: ${filePath}`);
    }
    return content.trim();
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      throw new Error(`Action item file not found: ${specialty}.md at ${filePath}`);
    }
    throw error;
  }
}

/**
 * Loads and validates a rating JSON file.
 */
function loadRating(raterLetter: string, specialty: string): RatingData {
  const filePath = getResourcePath(`ratings/rater_${raterLetter}/${specialty}.json`);

  try {
    const content = readFileSync(filePath, "utf-8");
    // biome-ignore lint/suspicious/noExplicitAny: JSON parse result is untyped
    const data = JSON.parse(content) as any;

    // Validate required fields
    if (!data.program || typeof data.program !== "string") {
      throw new Error(`Missing or invalid "program" field in ${filePath}`);
    }
    if (!data.rationale || typeof data.rationale !== "string") {
      throw new Error(`Missing or invalid "rationale" field in ${filePath}`);
    }
    if (
      typeof data.score !== "number" ||
      !Number.isInteger(data.score) ||
      data.score < 1 ||
      data.score > 5
    ) {
      throw new Error(
        `Invalid "score" field in ${filePath}: must be integer 1-5, got ${data.score}`
      );
    }

    return data as RatingData;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      throw new Error(
        `Rating file not found: rater_${raterLetter}/${specialty}.json at ${filePath}`
      );
    }
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in rating file ${filePath}: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Formats a single few-shot calibration example.
 */
function formatExample(
  proposalId: number,
  specialty: string,
  actionItemContent: string,
  rating: RatingData,
  evaluatorId: number,
  evaluatorName: string
): string {
  // Convert specialty to display format (e.g., "emergency_medicine" -> "Emergency Medicine")
  const displaySpecialty = specialty
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  const evaluation = {
    proposal_id: proposalId,
    evaluator_id: evaluatorId,
    evaluator_name: evaluatorName,
    items: [
      {
        action_item_id: 1,
        comment: rating.rationale,
        score: rating.score,
      },
    ],
    overall_score: rating.score,
  };

  return `### Example: ${displaySpecialty}

**Action Items:**
1. (ID: 1) ${actionItemContent}

**Evaluation:**
${JSON.stringify(evaluation, null, 2)}

---`;
}

/**
 * Builds the few-shot examples string for a rater.
 */
function buildFewShotExamples(config: RaterConfig): string {
  const raterLetter = config.name.split(" ")[1].toLowerCase(); // "Rater A" -> "a"
  const examples: string[] = [];

  for (let i = 0; i < config.specialties.length; i++) {
    const specialty = config.specialties[i];
    const proposalId = i + 1;

    const actionItemContent = loadActionItem(specialty);
    const rating = loadRating(raterLetter, specialty);

    // Validate that rating.program matches specialty
    if (rating.program !== specialty) {
      throw new Error(
        `Rating program mismatch: expected "${specialty}", got "${rating.program}" in rater_${raterLetter}/${specialty}.json`
      );
    }

    const example = formatExample(
      proposalId,
      specialty,
      actionItemContent,
      rating,
      config.id,
      config.name
    );
    examples.push(example);
  }

  return examples.join("\n\n");
}

/**
 * Rater A ("The Professor") few-shot calibration examples.
 *
 * Calibrated with 5 examples showing strict scoring on structure, quantitative targets,
 * and metric specificity, but lenient on presentation format. Covers specialties:
 * surgery (5), emergency_medicine (5), internal_medicine (3),
 * obstetrics_and_gynecology (2), anesthesiology (2).
 *
 * Each example demonstrates Rater A's evaluation approach with:
 * - Emphasis on clear metrics with baselines and targets
 * - Focus on data-driven rationale and structured planning
 * - Detailed assessment of measurement specificity
 *
 * Score range: 2-5 (demonstrates persona across quality levels)
 */
export const RATER_A_EXAMPLES = buildFewShotExamples(RATER_CONFIGS[0]);

/**
 * Rater B ("The Editor") few-shot calibration examples.
 *
 * Calibrated with 5 examples showing generous scoring on feasibility and clarity,
 * with focus on achievability and practical implementation. Covers specialties:
 * surgery (5), emergency_medicine (5), internal_medicine (4),
 * family_medicine (3), anesthesiology (3).
 *
 * Each example demonstrates Rater B's evaluation approach with:
 * - Emphasis on clear communication and logical structure
 * - Focus on feasibility and realistic timelines
 * - Assessment of whether steps are actionable and achievable
 *
 * Score range: 3-5 (demonstrates persona's generous tendencies)
 */
export const RATER_B_EXAMPLES = buildFewShotExamples(RATER_CONFIGS[1]);

/**
 * Rater C ("The Practitioner") few-shot calibration examples.
 *
 * Calibrated with 5 examples showing strict scoring on actionability, data richness,
 * and practical impact, but lenient on formality. Covers specialties:
 * surgery (5), pediatrics (5), emergency_medicine (4),
 * internal_medicine (3), anesthesiology (2).
 *
 * Each example demonstrates Rater C's evaluation approach with:
 * - Emphasis on actionable steps and concrete interventions
 * - Focus on data quality and evidence-based problem identification
 * - Assessment of practical impact and implementation feasibility
 *
 * Score range: 2-5 (demonstrates persona across quality levels)
 */
export const RATER_C_EXAMPLES = buildFewShotExamples(RATER_CONFIGS[2]);
