# Rater Reliability Analysis

## Overview

Measure inter-rater agreement and consistency across evaluators using appropriate statistical
methods.

## Common Use Cases

### ICC (Intraclass Correlation) Analysis

**Scenario:** Multiple raters assessing the same programs on a continuous or interval scale

**Typical ICC Measures:**

- **ICC(2,1)** - Estimated agreement for a process with only one rater
- **ICC(2,3)** - Estimated agreement for a process with three raters
- **ICC(3,1)** - Consistency between raters (two-way mixed effects)

### Cohen's Kappa

**Scenario:** Two raters making categorical judgments (e.g., pass/fail, agree/disagree)

**Output:** Kappa coefficient indicating agreement beyond chance

### Gwet's AC1

**Scenario:** Two-rater or multi-rater categorical agreement assessment

**Advantage:** More robust to marginal probability distributions than Cohen's Kappa

## Data Requirements

### Input Format

- **Raters:** Identifiers in header row
- **Subjects:** Program or item names in first column
- **Ratings:** Numerical or categorical values in corresponding cells

### Minimum Requirements

- At least 2 raters
- At least 10 rated subjects
- Consistent rating scale across all raters

## Analysis Output

Include:

1. **Overall agreement statistic** (ICC, Kappa, or AC1 as appropriate)
2. **Interpretation** of the result (excellent, good, moderate, poor agreement)
3. **Per-rater statistics** (if applicable) showing individual consistency
4. **95% Confidence intervals**
5. **Recommendations** for addressing low agreement if needed
