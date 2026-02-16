# Security Tooling

## Phase 1: Dependency Scanning (Current)

### npm audit Integration

Automated dependency vulnerability scanning runs on every commit (informational only).

**Available scripts:**

```bash
# Check for high/critical vulnerabilities (non-blocking, runs on pre-commit)
npm run audit:security

# Full audit report (all severity levels)
npm run audit:all

# Auto-fix vulnerabilities (use with caution - may break dependencies)
npm run audit:fix
```

**Pre-commit behavior:**

- `audit:security` runs automatically before staged file checks
- Shows high/critical vulnerabilities but never blocks commits
- Provides visibility into dependency risks without disrupting workflow

**Manual review recommended for:**

- High/critical vulnerabilities in production dependencies
- Moderate vulnerabilities with known exploits
- Dependencies with available patches

### Interpreting Results

- **High/Critical**: Review immediately, especially in `server/` or `shared/` packages
- **Moderate**: Assess impact based on exposure (dev-only vs runtime)
- **Low**: Informational, address during dependency update cycles

**Fixing vulnerabilities:**

```bash
# Safe fixes (patch/minor updates)
npm audit fix

# Breaking changes (major updates) - test thoroughly
npm audit fix --force
```

## Phase 2: Secret Scanning (Current)

### Gitleaks Integration

Automated secret scanning detects sensitive data (API keys, tokens, passwords) before they're
committed.

**Installation required:**

```bash
# macOS
brew install gitleaks

# Other platforms
# See https://github.com/gitleaks/gitleaks#installing
```

**Available scripts:**

```bash
# Scan staged files only (fast, runs on pre-commit)
npm run secrets:check

# Scan entire git history (slow, run manually)
npm run secrets:scan-all
```

**Pre-commit behavior:**

- `secrets:check` runs automatically before dependency audit
- Scans only staged files for fast performance
- Never blocks commits - shows warnings if secrets detected
- Gracefully skips if gitleaks not installed

**Configuration:**

- `.gitleaks.toml` - allowlist for test fixtures and example files
- Uses gitleaks default ruleset for common secret patterns
- Detects: AWS keys, GitHub tokens, private keys, passwords, etc.

**If secrets are detected:**

1. Review the warning output carefully
2. Remove sensitive data from staged files
3. Use environment variables (`.env` - never commit this!)
4. Add false positives to `.gitleaks.toml` allowlist
5. If secret was committed, rotate it immediately

**Common false positives:**

- Example/template files (`.env.example`) - already allowlisted
- Test fixtures with `test-key-*`, `fake-secret`, `mock-token`
- Documentation placeholders like `YOUR_API_KEY_HERE`

## Phase 3: Static Security Analysis (Current)

### Biome Security Rules

Upgraded Biome from v1.9.4 to v2.3.15 and enabled all security lint rules. These run automatically
on every lint check and in pre-commit hooks — zero new dependencies.

**Security rules enabled (error level):**

- `noGlobalEval` — blocks dynamic code execution
- `noDangerouslySetInnerHtml` — prevents XSS via raw HTML injection
- `noDangerouslySetInnerHtmlWithChildren` — prevents conflicting DOM manipulation
- `noSecrets` — detects hardcoded secrets via pattern matching and entropy analysis

**Also enabled (warn level):**

- `noStaticElementInteractions` — a11y: interactive handlers on non-interactive elements
- `useAriaPropsSupportedByRole` — a11y: unsupported ARIA attributes

**False positive handling:**

Use `biome-ignore` comments for legitimate cases (e.g., test names with high entropy strings):

```typescript
// biome-ignore lint/security/noSecrets: test name, not a secret
it("should pass maxCompletionTokens=4000 and schemaName='log_review'", async () => {
```

## Accepted Risks — Transitive Dependency Vulnerabilities

After implementing Phases 1-3 security tooling and applying npm overrides, vulnerabilities were
reduced from 25 to 16 moderate severity. All remaining vulnerabilities are in transitive
dependencies (not directly used in our codebase). We have accepted the risk on the following based
on detailed analysis:

### langsmith 0.3.87 (GHSA-v34v-rq6j-cj6p, SSRF via header injection)

**Dependency path:** @copilotkit/runtime → @ag-ui/langgraph → @langchain/core → langsmith

**Risk assessment:** Low

- Tracing is not enabled in this project
- The vulnerable code path is never executed
- This is a transitive dependency pulled by AG-UI's langgraph integration

**Fix blocked by:** @langchain/core 0.3.x pins `langsmith <0.4.0`; upgrading to @langchain/core
0.5.x would violate the peer dependency constraint and require CopilotKit 2.x (currently in early
beta).

**Revisit when:** CopilotKit 2.x stable ships with updated @langchain/core that allows langsmith
0.4.x+.

### lodash-es 4.17.21 (GHSA-xxjr-mmjv-4gpg, Prototype Pollution in _.unset and _.omit)

**Dependency path:** @copilotkitnext/react → streamdown → mermaid → chevrotain → lodash-es

**Risk assessment:** Low

- Vulnerable functions (`_.unset`, `_.omit`) are used internally by chevrotain's parser generator
- No attacker-controlled input reaches these functions via our code paths
- This is a transitive dependency pulled by diagram rendering in CopilotKit UI

**Fix blocked by:** No patched version of lodash-es 4.17.x exists (4.17.23 only changes ESM
metadata, not the vulnerable code). A fix requires either:

- lodash-es to publish a security patch (unlikely for a 10+ year old version)
- mermaid/chevrotain to migrate away from lodash-es

**Revisit when:** lodash-es publishes a security fix, or mermaid/chevrotain migrates away from
lodash-es.

### Vulnerabilities Fixed via npm Overrides

Two additional vulnerabilities were mitigated using npm overrides (see `package.json`):

1. **prismjs ≤1.30.0 (GHSA-x7hr-w5r2-h6wg, DOM Clobbering)**
   - Pinned to 1.30.0 via override
   - Used by @copilotkit/react-ui for syntax highlighting in chat
   - Fix allows upgrade while maintaining CopilotKit compatibility

2. **esbuild ≤0.24.2 (GHSA-67mh-4wv8-2f99, SSRF in dev server)**
   - Overridden to `>=0.25.0` to force all transitive references above the vulnerable range
   - Dev-only build tool, no production impact

3. **rxjs (deduplication override)**
   - Pinned to `7.8.1` to prevent duplicate copies across CopilotKit's nested dependencies
   - Without this, lockfile regeneration causes TypeScript type conflicts between
     `node_modules/rxjs` and `node_modules/@copilotkit/runtime/node_modules/rxjs`

## Future Phases

- **Phase 4**: CI/CD integration (GitHub Actions / GitLab CI pipeline)
