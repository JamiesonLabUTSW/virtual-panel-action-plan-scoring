# Phase 2 — CopilotKit + Azure v1 Spike

**Goal:** Validate that CopilotKit Runtime works on Express with the Azure OpenAI v1 API over a single HTTP endpoint. Confirm per-session state isolation and AG-UI streaming.

**Risk:** HIGH — CopilotKit + Azure v1 is an undertested combination
**Estimated effort:** 1.5 days
**Depends on:** Phase 1
**Blocks:** Phase 3, Phase 4

---

## Parallel Tracks

```
    Track A: Server                Track B: Client
    2.1 Server CopilotKit Deps    2.2 Client CopilotKit Deps
              │                         │
              ├── 2.6 Health + Startup  │
              │   (parallel w/ 2.2)     │
              └─────────┐       ┌───────┘
                        ▼       ▼
              2.3 E2E Chat Validation ◄── requires both tracks
              2.4 Test Action + State Emission
                        │
                        ▼
              2.5 Session Isolation Validation
```

| Track | Sub-issues | Can start after |
|-------|-----------|-----------------|
| **Track A: Server** | 2.1, 2.6 | Phase 1 (2.6 can start once 2.1 is done) |
| **Track B: Client** | 2.2 | Phase 1 |
| **Integration** | 2.3, 2.4 | 2.1 + 2.2 both complete |
| **Validation** | 2.5 | 2.4 |

**2 developers:** One takes 2.1 + 2.6 (server-side), the other takes 2.2 (client-side). Then they jointly validate 2.3 and 2.4. One person can handle 2.5 while the other cleans up.

---

## Sub-issues

### 2.1 — Install and Configure CopilotKit Server Dependencies

**Description:**
Add CopilotKit runtime packages to the server and configure the OpenAI adapter with the Azure v1 base URL.

**Changes:**

Add to `server/package.json` dependencies:
- `@copilotkit/runtime ^1.51.0`
- `openai ^5.0.0` (the OpenAI SDK, used to create the Azure v1 client)

Update `server/src/index.ts`:
- Import `CopilotRuntime`, `OpenAIAdapter`, `copilotRuntimeNodeHttpEndpoint` from `@copilotkit/runtime`
- Import `OpenAI` from `openai`
- Create the Azure v1 client: `new OpenAI({ apiKey, baseURL: https://${RESOURCE}.openai.azure.com/openai/v1/ })`
- Create `OpenAIAdapter` with `{ openai: openaiClient, model: AZURE_OPENAI_DEPLOYMENT }`
- Create `CopilotRuntime` with an empty actions array (for now)
- Mount at `POST /api/copilotkit` using `copilotRuntimeNodeHttpEndpoint`

**Acceptance criteria:**
- Server starts without import or initialization errors
- `POST /api/copilotkit` returns a response (even if it's an error about missing frontend context) — confirms the endpoint is mounted
- The `OpenAI` client is configured with the Azure v1 base URL pattern (no `api-version` query param)
- No `temperature`, `max_tokens`, or `top_p` are passed in any configuration

**Code quality:**
- Azure base URL constructed from `AZURE_OPENAI_RESOURCE` env var, not hardcoded
- Environment variable validation at startup: log an error and exit if required vars are missing
- Single `OpenAI` client instance shared (will be reused by LangChain in Phase 3)

---

### 2.2 — Install and Configure CopilotKit Client Dependencies

**Description:**
Add CopilotKit React packages and wrap the app in the CopilotKit provider.

**Changes:**

Add to `client/package.json` dependencies:
- `@copilotkit/react-core ^1.51.0`
- `@copilotkit/react-ui ^1.51.0`

Update `client/src/App.tsx`:
- Import `CopilotKit` from `@copilotkit/react-core`
- Import `@copilotkit/react-ui/styles.css`
- Wrap content in `<CopilotKit runtimeUrl="/api/copilotkit">`

Create a minimal test page with `<CopilotChat />`:
- Import `CopilotChat` from `@copilotkit/react-ui`
- Render a simple layout: header + chat panel

**Acceptance criteria:**
- Client builds without errors (`npm run build --workspace=client`)
- CopilotKit provider initializes without console errors
- `<CopilotChat />` renders a chat input field in the browser
- CopilotKit styles are applied (chat panel is properly styled)

**Code quality:**
- `runtimeUrl` uses relative path `/api/copilotkit` (works with both Vite proxy and production static serving)
- No hardcoded URLs

---

### 2.3 — Validate End-to-End Chat via Azure v1

**Description:**
Send a message through CopilotChat and verify it round-trips through CopilotKit Runtime → Azure OpenAI v1 → back to the frontend.

**Validation steps:**
1. Start both server (`npm run dev --workspace=server`) and client (`npm run dev --workspace=client`)
2. Open the app in a browser
3. Type a message in the CopilotChat input
4. Verify a response streams back from Azure gpt-5.1-codex-mini
5. Verify the response appears in the chat UI incrementally (streaming)

**Acceptance criteria:**
- A user message sent via CopilotChat produces a streamed LLM response
- Server logs show the request reaching the CopilotKit runtime endpoint
- No GraphQL endpoint is involved — all communication goes through the single HTTP POST endpoint
- Response streaming works (text appears incrementally, not all at once)

**Failure modes to document:**
- If `OpenAIAdapter` doesn't accept the Azure v1 client, document the error and investigate custom adapter options
- If streaming fails, test with `stream: false` to isolate the issue
- If the model rejects parameters, verify none of `temperature`/`max_tokens`/`top_p` are being passed implicitly by CopilotKit

**Code quality:**
- No workarounds committed without a `// TODO` comment explaining the issue and ideal fix

---

### 2.4 — Register a Test Action with State Emission

**Description:**
Create a trivial CopilotKit action that emits state updates, verifying the state streaming pipeline works before building the real grading action.

**Changes:**

Create `server/src/actions/test-action.ts`:
- Action name: `testAction`
- Parameters: `{ message: string }`
- Handler: emits 3 state updates with 1-second delays between them (simulating judge progression), then returns a final result
- Each state update changes a `step` field (1 → 2 → 3)

Register the test action in `CopilotRuntime`:
- Add to the `actions` array

Update the frontend to consume the test action:
- Use `useCoAgent` (or the appropriate CopilotKit hook) to subscribe to state
- Display the current `step` value on screen
- Add a button that triggers the test action

**Acceptance criteria:**
- Clicking the button triggers the action
- The UI updates 3 times as state emissions arrive (step 1 → 2 → 3)
- State updates are received via AG-UI `STATE_DELTA` events (verify in browser DevTools network tab)
- The action completes and the final state is visible

**Code quality:**
- Test action is clearly marked as temporary (will be replaced by gradeDocument in Phase 4)
- State emission uses the same `context.emitStateUpdate()` pattern that the real orchestrator will use

---

### 2.5 — Validate Per-Session State Isolation

**Description:**
Confirm that two simultaneous browser sessions don't share state — a critical security requirement (SPEC §10).

**Validation steps:**
1. Open the app in two separate browser tabs (or two different browsers)
2. Trigger the test action in Tab A
3. Verify Tab B does NOT receive Tab A's state updates
4. Trigger the test action in Tab B while Tab A's action is still running
5. Verify each tab shows only its own state progression

**Acceptance criteria:**
- State updates from one session never appear in another session
- Two concurrent action runs complete independently
- No process-wide singleton state is used

**Failure resolution:**
- If CopilotKit uses a process-wide singleton: implement a `runId`-based state map as described in SPEC §10
- Document the isolation mechanism used (per-connection, per-request, or custom)

**Code quality:**
- If custom isolation is needed, it must be implemented in a way that doesn't leak memory (e.g., state cleaned up after action completion or timeout)

---

### 2.6 — Add Health Endpoint and Startup Validation

**Description:**
Finalize the health check endpoint and add startup validation for required environment variables.

**Changes:**

Update `GET /api/health`:
- Return `{ status: "ok", model: AZURE_OPENAI_DEPLOYMENT, api: "azure-v1" }`

Add startup validation in `server/src/index.ts`:
- Check that `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_RESOURCE`, `AZURE_OPENAI_DEPLOYMENT` are all set
- If any are missing, log a clear error message listing the missing variables and exit with code 1
- Log the configured Azure base URL (without the API key) on successful startup

**Acceptance criteria:**
- `GET /api/health` returns 200 with the expected JSON
- Starting the server without `AZURE_OPENAI_API_KEY` logs an error and exits
- Starting the server with all required vars logs: `Server running on port 7860` and `Azure OpenAI: https://<resource>.openai.azure.com/openai/v1/`

**Code quality:**
- Validation runs before any Express middleware is configured
- API key is never logged, even partially
