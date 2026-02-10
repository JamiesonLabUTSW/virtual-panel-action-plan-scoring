# Phase 1 — Project Scaffolding & Shared Package

**Goal:** Establish the monorepo structure, build toolchain, and shared types/schemas so all subsequent phases build on a working foundation.

**Risk:** LOW
**Estimated effort:** 0.5 days
**Depends on:** Nothing
**Blocks:** All other phases

---

## Parallel Tracks

```
                   1.1 Root Monorepo
                         │
                         ▼
                   1.2 Shared Package ──────► 1.5 Env Config (independent)
                      │         │
              ┌───────┘         └───────┐
              ▼                         ▼
    Track A: Server              Track B: Client
    1.3 Server Skeleton          1.4 Client Skeleton
              │                         │
              └───────┐         ┌───────┘
                      ▼         ▼
                   1.6 Cross-Workspace Build
```

| Track | Sub-issues | Can start after |
|-------|-----------|-----------------|
| **Setup** | 1.1 | — |
| **Shared** | 1.2, 1.5 | 1.1 (1.5 can parallel with 1.2) |
| **Track A: Server** | 1.3 | 1.2 |
| **Track B: Client** | 1.4 | 1.2 |
| **Integration** | 1.6 | 1.3 + 1.4 both complete |

**2 developers:** After 1.1 and 1.2 are done (sequential — same files), one dev takes 1.3 (server) while the other takes 1.4 (client) + 1.5 (env). Then 1.6 is a joint integration check.

---

## Sub-issues

### 1.1 — Initialize Root Monorepo with npm Workspaces

**Description:**
Create the root `package.json` that defines the three workspaces (`shared/`, `server/`, `client/`). This is the structural foundation for the entire project.

**Changes:**
- Create `package.json` at project root with:
  - `"private": true`
  - `"workspaces": ["shared", "server", "client"]`
  - `"engines": { "node": ">=20" }`
- Create `.nvmrc` with `20`
- Create `.gitignore` covering `node_modules/`, `dist/`, `.env`, `*.tsbuildinfo`

**Acceptance criteria:**
- `npm install` from the root installs dependencies for all three workspaces
- `npm ls --workspaces` lists all three packages without errors
- `.gitignore` excludes build artifacts and secrets

**Code quality:**
- No devDependencies at root level unless they are truly workspace-agnostic (e.g., TypeScript)
- Workspace names follow the `@shared/*` convention used in the spec

---

### 1.2 — Create the Shared Package (Types & Schemas)

**Description:**
Implement `shared/` containing all Zod schemas and TypeScript types from SPEC §4.4, §4.5, and §6. These are the contract between server and client.

**Changes:**

`shared/package.json`:
- `"name": "@shared/types"`
- `"main": "index.ts"`
- Dependencies: `zod ^3.23.0`
- DevDependencies: `typescript ^5.6.0`

`shared/tsconfig.json`:
- `strict: true`, `target: "ES2022"`, `module: "ESNext"`, `moduleResolution: "bundler"`

`shared/schemas.ts` — Zod schemas exactly as specified:
- `EvidenceQuote`: `quote` (string), `supports` (enum: Clarity/Reasoning/Completeness), `valence` (enum: positive/negative)
- `CriterionScore`: `name` (enum), `score` (1-5 int), `notes` (string), `evidence_quotes` (array of strings, min 1, max 3)
- `JudgeOutput`: `overall_score` (1-5 int), `confidence` (0-1 number), `rationale` (string), `criteria` (array of 3 CriterionScore), `key_evidence` (array of 2-6 EvidenceQuote), `strengths` (1-3 strings), `improvements` (1-3 strings)
- `ConsensusOutput`: `final_score` (1-5 int), `rationale` (string), `agreement` object (scores per rater, mean_score, median_score, spread 0-4, agreement_level enum, disagreement_analysis string), `criteria` (array of 3 CriterionScore), `improvements` (1-5 strings)
- Export inferred types: `JudgeOutputType`, `ConsensusOutputType`

`shared/types.ts` — TypeScript types:
- `Phase` union type: `"idle" | "rater_a" | "rater_b" | "rater_c" | "consensus" | "done" | "error"`
- `JudgeState` interface: `status`, `label`, optional `result` (JudgeOutputType), `error`, `latencyMs`
- `GradingState` interface: `phase`, optional `document` (text, title, wasTruncated), `judges` object (rater_a/b/c as optional JudgeState), optional `consensus`, `error`, `wasTruncated`
- `INITIAL_GRADING_STATE` constant: `{ phase: "idle", judges: {} }`

`shared/index.ts` — barrel export of all schemas, types, and constants.

**Acceptance criteria:**
- `npx tsc --noEmit` in `shared/` passes with zero errors
- All Zod schemas can parse valid sample data: `JudgeOutput.parse(sampleJudge)` succeeds
- All Zod schemas reject invalid data: missing fields, out-of-range scores, wrong enum values
- `z.optional()` is NOT used anywhere (unsupported by reasoning model structured output); `z.nullable()` used if nullability is needed
- Types are re-exported from `shared/index.ts`

**Code quality:**
- Every Zod field has a `.describe()` annotation (required for structured output schema generation)
- Schema field order matches SPEC §4.4 and §4.5 exactly
- No runtime logic in shared — only types, schemas, and constants

---

### 1.3 — Create Server Workspace Skeleton

**Description:**
Set up the `server/` package with Express entry point, TypeScript config, tsup bundling, and the `@shared/*` path alias.

**Changes:**

`server/package.json`:
- Dependencies: `express ^4.21.0`
- DevDependencies: `tsup ^8.0.0`, `tsx ^4.0.0`, `typescript ^5.6.0`, `@types/express`
- Scripts: `"dev": "tsx watch src/index.ts"`, `"build": "tsup"`

`server/tsconfig.json`:
- `strict: true`, `target: "ES2022"`, `module: "ESNext"`, `moduleResolution: "bundler"`
- `baseUrl: "."`, `paths: { "@shared/*": ["../shared/*"] }`
- `rootDirs: ["src", "../shared"]`
- `include: ["src/**/*", "../shared/**/*"]`

`server/tsup.config.ts`:
- Entry: `["src/index.ts"]`
- Format: `["cjs"]`
- Target: `"node20"`
- `noExternal: ["@shared"]` (bundles shared into output)
- `clean: true`

`server/src/index.ts` — minimal Express server:
- Imports from `@shared/types` to verify path alias works
- Serves a placeholder response on `GET /`
- Listens on `PORT` (default 7860)
- `GET /api/health` returns `{ status: "ok" }`

**Acceptance criteria:**
- `npm run dev --workspace=server` starts the server; `curl localhost:7860/api/health` returns `{"status":"ok"}`
- `npm run build --workspace=server` produces `server/dist/index.js` with `@shared` code inlined
- `node server/dist/index.js` runs without `MODULE_NOT_FOUND` errors
- `@shared/types` import resolves correctly in `server/src/index.ts`

**Code quality:**
- Server binds to `0.0.0.0` (required for Docker)
- No hardcoded port — reads from `process.env.PORT` with 7860 default
- tsup config uses `noExternal: ["@shared"]` to bundle shared code

---

### 1.4 — Create Client Workspace Skeleton

**Description:**
Set up the `client/` package with Vite, React, TypeScript, and the `@shared` alias.

**Changes:**

`client/package.json`:
- Dependencies: `react ^18.3.0`, `react-dom ^18.3.0`
- DevDependencies: `vite ^6.0.0`, `@vitejs/plugin-react ^4.3.0`, `typescript ^5.6.0`, `@types/react`, `@types/react-dom`
- Scripts: `"dev": "vite"`, `"build": "vite build"`

`client/tsconfig.json`:
- `strict: true`, `target: "ES2022"`, `module: "ESNext"`, `moduleResolution: "bundler"`, `jsx: "react-jsx"`
- `baseUrl: "."`, `paths: { "@shared/*": ["../shared/*"] }`

`client/vite.config.ts`:
- React plugin
- `resolve.alias: { "@shared": path.resolve(__dirname, "../shared") }`
- `server.proxy: { "/api": "http://localhost:7860" }` (for dev)

`client/index.html` — minimal HTML shell with `<div id="root">` and script tag.

`client/src/main.tsx` — React DOM render into `#root`.

`client/src/App.tsx` — placeholder component that imports `INITIAL_GRADING_STATE` from `@shared/types` and displays `phase: idle` to verify the import works.

**Acceptance criteria:**
- `npm run dev --workspace=client` starts Vite dev server
- The page renders and displays text confirming `@shared/types` import works
- `npm run build --workspace=client` produces `client/dist/` with `index.html` and JS bundle
- `@shared` imports resolve in both dev and production builds
- Vite proxy forwards `/api/*` requests to the server in dev mode

**Code quality:**
- Vite config uses `path.resolve(__dirname, "../shared")` for the alias (not relative strings)
- Proxy config only applies in development
- No CopilotKit dependencies yet — those come in Phase 2

---

### 1.5 — Environment Configuration

**Description:**
Create `.env.example` and document the required environment variables.

**Changes:**

`.env.example`:
```
# Required — Azure OpenAI
AZURE_OPENAI_API_KEY=
AZURE_OPENAI_RESOURCE=
AZURE_OPENAI_DEPLOYMENT=

# Optional
PORT=7860
MAX_DOC_CHARS=20000
```

**Acceptance criteria:**
- `.env.example` lists all 5 environment variables from SPEC §3
- `.env` is in `.gitignore`
- Server reads from `process.env` with correct defaults

**Code quality:**
- Comments in `.env.example` distinguish required vs optional
- No secrets are committed

---

### 1.6 — Verify Cross-Workspace Build

**Description:**
End-to-end verification that the full monorepo builds correctly and the server can serve the client build.

**Changes:**
- Add a root-level script: `"build": "npm run build --workspaces"`
- Ensure `server/src/index.ts` serves static files from `../public` (or a configurable path) for production, matching the Dockerfile's `COPY --from=client-build /app/client/dist ./public`
- In dev, the Vite proxy handles this

**Acceptance criteria:**
- `npm run build` from root succeeds for both workspaces
- Copying `client/dist/` to `server/dist/../public/` and running `node server/dist/index.js` serves the React app at `GET /`
- `GET /api/health` still works alongside static file serving
- SPA fallback: `GET /any-path` returns `index.html` (not 404)

**Code quality:**
- Static file serving uses `express.static` with the public directory
- SPA fallback route is defined after API routes to avoid shadowing
- No path aliasing issues between dev and production modes
