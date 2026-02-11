# Code Standards & Quality Workflow

_Last updated: 2026-02-10_ _Target: Issue #15 - Code Quality Tooling_

## Quick Start

### Before You Commit

```bash
npm run lint:fix     # Auto-fix linting issues
npm run format       # Format all files
npm run test         # Run all tests
```

Pre-commit hooks will run these automatically on staged files.

### Daily Workflow

```bash
npm run test:watch   # In affected workspace, e.g., cd shared && npm run test:watch
npm run type-check   # Verify TypeScript across all workspaces
```

## Tooling Overview

| Tool           | Purpose             | When It Runs                     | Can Fail Commit? |
| -------------- | ------------------- | -------------------------------- | ---------------- |
| **Biome**      | Lint + format TS    | Pre-commit (staged files)        | Yes              |
| **Prettier**   | Format Markdown     | Pre-commit (staged MD)           | Yes              |
| **Vitest**     | Tests + coverage    | Pre-commit (affected tests)      | Yes              |
| **TypeScript** | Type checking       | Pre-commit (affected workspaces) | Yes              |
| **Knip**       | Unused deps/exports | Manual (`npm run knip`)          | No               |
| **TypeDoc**    | API documentation   | Manual (`npm run docs`)          | No               |

## Linting & Formatting

### Biome Configuration

- **Line width:** 100 characters
- **Indent:** 2 spaces
- **Quotes:** Double quotes
- **Import sorting:** Enabled (auto-groups built-ins → externals → internals)
- **Rules:** Recommended + strict on type imports

### Common Lint Errors & Fixes

#### "Use import type for type-only imports"

```typescript
// ❌ Bad
import { JudgeOutputType } from "@shared/types";

// ✅ Good
import type { JudgeOutputType } from "@shared/types";
```

#### "Avoid console.log in production code"

```typescript
// ❌ Bad
console.log("Judge result:", result);

// ✅ Good (server)
import logger from "./logger"; // Use pino or similar
logger.info({ result }, "Judge result");

// ✅ Good (tests)
console.log("Debug:", result); // OK in __tests__/
```

#### "Avoid non-null assertion (!)"

```typescript
// ❌ Bad
const judge = state.judges.rater_a!;

// ✅ Good
const judge = state.judges.rater_a;
if (!judge) {
  throw new Error("Rater A judge not found");
}
```

### Markdown Formatting

Prettier handles all `.md` files with these rules:

- **Prose wrap:** Always (100 characters)
- **List formatting:** Consistent indentation
- **Link style:** Inline references

## Testing

### Test Location

- **Pattern:** `__tests__/` directory in each workspace
- **Naming:** `*.test.ts` or `*.test.tsx`
- **Example:** `shared/__tests__/schemas.test.ts`

### Running Tests

```bash
# All workspaces
npm run test

# Specific workspace (from root)
npm run test --workspace=@shared/types

# Watch mode (from workspace)
cd shared
npm run test:watch

# Coverage report
npm run test:coverage
```

### Coverage Requirements

- **Threshold:** 80% (lines, functions, branches, statements)
- **Behavior:** Reports warnings, does NOT fail builds
- **Location:** `{workspace}/coverage/` (git-ignored)

### Related Tests (Pre-commit)

The `test:related` script runs tests for files affected by your changes:

```bash
npm run test:related --workspace=@shared/types
```

**How it works:** Uses Vitest's `related` command which analyzes import graphs to find tests that
import changed files.

**When to use:**

- **Automatically:** Pre-commit hooks run this via lint-staged
- **Manually:** When you want to quickly test only affected code
- **Requires git context:** Must be in a git repository with staged changes

**Limitations:** Won't detect tests that should run due to logical dependencies not captured in
imports.

### Writing Tests

```typescript
// shared/__tests__/example.test.ts
import { describe, it, expect } from "vitest";
import { JudgeOutput } from "../schemas";

describe("JudgeOutput schema", () => {
  it("parses valid output", () => {
    const validData = {
      /* ... */
    };
    const result = JudgeOutput.parse(validData);
    expect(result).toEqual(validData);
  });

  it("rejects invalid score", () => {
    expect(() => JudgeOutput.parse({ overall_score: 6 /* ... */ })).toThrow();
  });
});
```

## Type Checking

### Configuration

- **Strict mode:** Enabled in all workspaces
- **No unused locals/parameters:** Enforced
- **Path aliases:** `@shared/*` resolves to `../shared/*`

### Common Type Errors & Fixes

#### "Cannot find module '@shared/types'"

```bash
# Verify path alias in tsconfig.json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@shared/*": ["../shared/*"]
    }
  }
}

# For server, also check:
{
  "compilerOptions": {
    "rootDirs": ["src", "../shared"]
  }
}
```

#### "Parameter '\_req' is declared but never used"

```typescript
// ❌ Bad (with noUnusedParameters: true)
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// ✅ Good - prefix with underscore
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});
```

#### "Type 'undefined' is not assignable to type 'JudgeState'"

```typescript
// ❌ Bad
const state: GradingState = {
  phase: "rater_a",
  judges: {
    rater_a: undefined, // Error!
  },
};

// ✅ Good - omit optional fields
const state: GradingState = {
  phase: "rater_a",
  judges: {}, // rater_a is optional
};

// Or provide a value
const state: GradingState = {
  phase: "rater_a",
  judges: {
    rater_a: {
      status: "running",
      label: "Rater A",
    },
  },
};
```

## Pre-commit Workflow

### What Happens

1. **Biome check** on staged `.ts` and `.tsx` files
2. **Prettier format** on staged `.md` files
3. **Type-check** only affected workspaces
4. **Test** only files related to staged changes

### Performance

- **Small change** (1-2 files): < 5 seconds
- **Workspace change** (10+ files): 10-20 seconds
- **Shared package change**: 20-30 seconds (affects all workspaces)

### Troubleshooting

#### Pre-commit hook doesn't run

```bash
# Reinstall Husky
rm -rf .husky
npm run prepare
```

#### Pre-commit is too slow

```bash
# Skip hooks for emergency commits (use sparingly!)
git commit --no-verify -m "Emergency fix"

# Then fix issues afterward
npm run lint:fix
npm run test
git add -A
git commit -m "Fix code quality issues"
```

#### Tests fail in pre-commit but pass locally

```bash
# Related tests might have stale cache
cd {workspace}
rm -rf node_modules/.vitest
npm run test
```

## Dependency Management

### Checking for Unused Dependencies

```bash
npm run knip
```

Knip will report:

- Unused dependencies (remove from package.json)
- Unused devDependencies
- Unused exports (dead code)
- Unlisted dependencies (add to package.json)

**Note:** Knip is NOT run in CI or pre-commit (manual only).

### Adding Dependencies

```bash
# Workspace-specific
npm install <package> --workspace=@grading/server

# Root-level (dev tools only)
npm install -D <package>
```

## API Documentation

### Generating Docs

```bash
npm run docs
```

Outputs to `docs/api/` (git-ignored). View with:

```bash
npm run docs:serve
```

### Writing TSDoc Comments

````typescript
/**
 * Represents the output from a single AI judge evaluating a document.
 *
 * @example
 * ```typescript
 * const judgeOutput: JudgeOutputType = {
 *   overall_score: 4,
 *   confidence: 0.85,
 *   rationale: "The document is clear and well-reasoned...",
 *   // ...
 * };
 * ```
 */
export const JudgeOutput = z.object({
  overall_score: z
    .number()
    .int()
    .min(1)
    .max(5)
    .describe("Holistic quality score from 1 (poor) to 5 (excellent)"),
  // ...
});
````

## CI/CD Integration (Future)

When CI is added, these checks will run:

- `npm run lint` (no auto-fix, just check)
- `npm run format:check` (verify formatting)
- `npm run type-check`
- `npm run test:coverage` (report only, don't fail)
- `npm run build` (verify production builds)

## Troubleshooting Common Issues

### "Module not found" after adding a file

```bash
# Restart dev server
npm run dev --workspace=<affected-workspace>
```

### Vitest can't resolve @shared imports

Check `vitest.config.ts` has the alias:

```typescript
export default defineConfig({
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "../shared"),
    },
  },
});
```

### Biome conflicts with Prettier

This shouldn't happen since:

- Biome handles `.ts` and `.tsx`
- Prettier handles `.md` only

If you see conflicts, file an issue.

## Resources

- **Biome docs:** https://biomejs.dev/
- **Vitest docs:** https://vitest.dev/
- **TypeDoc docs:** https://typedoc.org/
- **Knip docs:** https://knip.dev/
- **Project spec:** `SPEC.md`
- **Phase plan:** `docs/plan/01-scaffolding.md`
