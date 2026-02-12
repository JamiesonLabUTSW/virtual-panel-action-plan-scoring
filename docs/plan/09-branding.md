# Phase 9 — Institutional Branding & Legal Disclaimers

**Goal:** Add UT Southwestern Medical Center / Jamieson Lab institutional branding, legal
disclaimers, privacy notice, GDPR consent banner, and social preview metadata throughout the
application.

**Context:** This application is a research demonstration for the 2026 ACGME Annual Educational
Conference — _Meaning in Medicine_. Workshop: "Leveraging Artificial Intelligence to Enhance
Institutional Quality Assurance: Automating Annual Action Plan Scoring as a Use Case."

**Risk:** LOW — purely additive UI/content changes, no backend logic changes. **Estimated effort:**
0.5 day **Depends on:** Phase 5 (Frontend UI) **Blocks:** Phase 8 (should be done before Docker
build/deploy)

---

## Sub-issues

### 9.1 — Institutional Attribution & Page Metadata

**Description:** Add UT Southwestern Medical Center, Jamieson Lab branding and update all page
metadata.

**Changes:**

Update `client/index.html`:

- Replace `<title>` with: `Virtual Panel Action Plan Scoring | Jamieson Lab, UT Southwestern`
- Replace Vite favicon with UTSW favicon (`favicon.ico` from `https://www.utsouthwestern.edu/`)
- Add OpenGraph and social preview meta tags:
  ```html
  <meta name="author" content="Jamieson Lab, UT Southwestern Medical Center" />
  <meta
    name="description"
    content="Multi-judge LLM grading panel for medical residency program action items. Demonstrates example-conditioned LLM personas with consensus evaluation. 2026 ACGME Annual Educational Conference."
  />
  <meta property="og:title" content="Virtual Panel Action Plan Scoring | Jamieson Lab" />
  <meta
    property="og:description"
    content="AI-powered multi-judge grading panel for medical residency program action items."
  />
  <meta property="og:type" content="website" />
  <meta property="og:image" content="/og-preview.png" />
  <meta name="twitter:card" content="summary_large_image" />
  ```

Create `client/public/` directory:

- Add `favicon.ico` (downloaded from utsouthwestern.edu)
- Create `og-preview.png` — a social preview image (can be a simple branded card with UTSW logo +
  project title, or a screenshot of the grading UI)

Update `client/index.html` favicon link:

```html
<link rel="icon" type="image/x-icon" href="/favicon.ico" />
```

Update header in `client/src/components/GradingView.tsx`:

- Add "UT Southwestern Medical Center" and "Jamieson Lab" text alongside the existing "Multi-Judge
  Grading Panel" title
- Include UTSW logo (inline SVG or image) in the header area
- Add conference attribution line: "2026 ACGME Annual Educational Conference"

**Acceptance criteria:**

- [ ] Browser tab shows "Virtual Panel Action Plan Scoring | Jamieson Lab, UT Southwestern"
- [ ] Browser favicon is the UTSW icon (not the Vite logo)
- [ ] Page header displays UTSW logo and "Jamieson Lab" attribution
- [ ] `<meta>` tags present for author, description, OpenGraph, and Twitter card
- [ ] Conference context is visible in the UI

---

### 9.2 — Privacy & Data Usage Disclaimer

**Description:** Add a persistent notice informing users that all usage is logged for research
purposes.

**Changes:**

Add a footer bar to the application layout (`App.tsx` or `GradingView.tsx`):

- Persistent footer text: "All usage is logged for research purposes."
- Footer should also contain links to Terms of Use (9.3) and the license
- Footer styling: subtle, dark background, small text, always visible at bottom

**Acceptance criteria:**

- [ ] Privacy notice is visible on every page/view
- [ ] Notice text clearly states usage logging
- [ ] Footer does not obscure main UI content
- [ ] Footer includes links to Terms (9.3) and License

---

### 9.3 — Terms of Use, Warranty Disclaimer & License

**Description:** Add a Terms of Use page or modal with warranty disclaimer and the UTSW BSD-style
license.

**Key content:**

1. **Purpose:** Research demonstration only — not for clinical use
2. **No warranty:** All outputs are AI-generated; no warranty on accuracy or fitness for any purpose
3. **Not a medical device:** Not a diagnostic tool; not FDA-approved or cleared
4. **License:** UTSW BSD-style license (academic research use only, no commercial use)

**Changes:**

Create a Terms/Disclaimer component (modal or dedicated route):

- Terms of Use section
- Warranty disclaimer section
- Full license text (UTSW BSD-style, Copyright (c) 2026 The University of Texas Southwestern Medical
  Center)
- Accessible from footer link

Add `LICENSE` file at project root with the UTSW BSD-style license text.

Consider: first-use acknowledgment gate — a click-through modal before using the grading tool
(stored in `localStorage` so it only shows once per browser).

**Acceptance criteria:**

- [ ] Terms of Use content accessible from footer
- [ ] Warranty disclaimer clearly states "no warranty, AI-generated results"
- [ ] "Research demonstration only — not for clinical use" is prominently displayed
- [ ] `LICENSE` file exists at project root
- [ ] License text matches the UTSW BSD-style license exactly

---

### 9.4 — GDPR / Cookie Consent Banner

**Description:** Add a lightweight GDPR-compliant consent banner informing users about data
collection.

**Implementation approach:** Use `react-cookie-consent` (small, well-maintained, ~3KB) to show a
dismissible banner on first visit.

**Changes:**

Add `react-cookie-consent` dependency to `client/package.json`.

Add consent banner in `App.tsx`:

```tsx
import CookieConsent from "react-cookie-consent";

<CookieConsent
  location="bottom"
  buttonText="I Understand"
  style={{ background: "#1e293b" }}
  buttonStyle={{ background: "#6366f1", color: "#fff", borderRadius: "6px" }}
>
  This research application logs usage data for academic purposes. By using this tool, you consent
  to data collection as described in our Terms of Use.
</CookieConsent>;
```

The banner:

- Appears once on first visit
- Stores acknowledgment in a cookie (`CookieConsent`)
- Does not block usage (informational, not gate-keeping)
- Styled to match the dark theme

**Acceptance criteria:**

- [ ] Banner appears on first visit
- [ ] Banner does not reappear after acknowledgment
- [ ] Banner text mentions data logging and links to Terms
- [ ] Banner styling matches the application's dark theme
- [ ] No functional cookies are set before consent (if applicable)

---

### 9.5 — GitHub Repository Link & Version Info

**Description:** Add a link to the public GitHub repository and display version/build info.

**Changes:**

Add to footer:

- GitHub icon + link to `https://github.com/JamiesonLabUTSW/virtual-panel-action-plan-scoring`
- App version from `package.json` or build-time env var (e.g., `VITE_APP_VERSION`)
- "Powered by Azure OpenAI" attribution (if required by Azure agreement)

Update HF Spaces README (from Phase 8.8) to link to the GitHub repository.

**Acceptance criteria:**

- [ ] GitHub link visible in footer, opens in new tab
- [ ] Version or build info visible (can be in footer or a tooltip)

---

## Implementation Notes

**Order:** 9.1 (branding) → 9.2 (privacy) → 9.3 (terms/license) → 9.4 (GDPR) → 9.5 (repo link). All
are independent and can be parallelized, but 9.2 and 9.3 share the footer component.

**Files touched:**

- `client/index.html` — title, favicon, meta tags
- `client/public/favicon.ico` — UTSW favicon
- `client/public/og-preview.png` — social preview image
- `client/src/App.tsx` — GDPR banner, footer wrapper
- `client/src/components/GradingView.tsx` — header branding
- `client/src/components/Footer.tsx` — new: persistent footer
- `client/src/components/TermsModal.tsx` — new: terms/disclaimer content
- `LICENSE` — new: UTSW BSD-style license
- `README.md` — update HF Spaces frontmatter description

**Dependencies to add:**

- `react-cookie-consent` — GDPR banner (~3KB)
