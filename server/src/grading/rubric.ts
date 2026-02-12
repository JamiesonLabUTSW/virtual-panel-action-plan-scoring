import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Resolves the rubric file path for both dev and production environments.
 * - Dev: __dirname is src/grading/, resources at ../resources/
 * - Prod: __dirname is dist/, resources copied directly to dist/ (tsup publicDir flattens)
 */
function getRubricPath(): string {
  const devPath = path.join(__dirname, "../resources/rubric.txt");
  const prodPath = path.join(__dirname, "./rubric.txt");

  return existsSync(devPath) ? devPath : prodPath;
}

/**
 * Loads and validates the evaluation rubric from disk at module initialization.
 * The rubric is loaded once synchronously and cached for reuse.
 *
 * @throws If the rubric file is missing or empty
 */
function loadRubric(): string {
  const rubricPath = getRubricPath();

  let content: string;
  try {
    content = readFileSync(rubricPath, "utf-8");
  } catch (error) {
    const errorMessage =
      error instanceof Error && "code" in error && error.code === "ENOENT"
        ? `Rubric file not found: ${rubricPath} (tried dev and prod paths)`
        : `Failed to read rubric file at ${rubricPath}: ${error instanceof Error ? error.message : String(error)}`;
    throw new Error(errorMessage);
  }

  if (!content.trim()) {
    throw new Error(`Rubric file is empty: ${rubricPath}`);
  }

  // Validate that all 5 scoring anchors are present
  const anchors = ["Poor", "Weak", "Adequate", "Strong", "Excellent"];
  const missingAnchors = anchors.filter((anchor) => !content.includes(anchor));

  if (missingAnchors.length > 0) {
    throw new Error(
      `Rubric missing scoring anchors: ${missingAnchors.join(", ")} (file: ${rubricPath})`
    );
  }

  return content;
}

/**
 * The complete evaluation rubric text used as the system prompt for judges.
 * Contains scoring anchors (Poor/Weak/Adequate/Strong/Excellent) and evaluation guidance.
 * Loaded once at module initialization and cached for all judge calls.
 *
 * @example
 * ```typescript
 * import { RUBRIC_TEXT } from "./rubric";
 *
 * const systemPrompt = `${RUBRIC_TEXT}\n\nAdditional context...`;
 * ```
 */
export const RUBRIC_TEXT = loadRubric();
