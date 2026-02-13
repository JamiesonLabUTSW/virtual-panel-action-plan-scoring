# Theming Specification — UTSW Dark Modern

Visual design system for the Virtual Panel Action Plan Scoring application. Rooted in UT
Southwestern Medical Center brand guidelines, adapted for a modern dark-mode research dashboard.

**Design philosophy:** Respect the institutional identity (blues, Open Sans, clinical precision)
while delivering a contemporary AI-tool aesthetic (dark surfaces, blue glows, smooth animations,
rounded cards). Not a replica of utsouthwestern.edu — a modern interpretation for conference demo
impact.

**Reference:** [UTSW Brand Guidelines](https://brand.utswmed.org/),
[UTSW Color & Typography](https://brand.utswmed.org/color-palette-and-typography/),
[UTSW EDU Guide](https://www.utsouthwestern.edu/edu-guide3/)

---

## 1. Color Palette

### 1.1 Surface / Background Colors

Blue-tinted darks derived from UTSW Dark Blue (`#00355d`), not neutral grays. Every surface carries
a subtle blue undertone to reinforce the institutional palette.

| Token                 | Hex       | Usage                                     |
| --------------------- | --------- | ----------------------------------------- |
| `--color-surface-900` | `#0c1424` | Page body background                      |
| `--color-surface-800` | `#162033` | Cards, panels, sidebar                    |
| `--color-surface-700` | `#1e2d47` | Elevated elements, input backgrounds      |
| `--color-surface-600` | `#2a3a56` | Hover states on surfaces, lighter accents |

### 1.2 Text Colors

Cool-toned to complement blue surfaces. No warm grays.

| Token                    | Hex       | Usage                                |
| ------------------------ | --------- | ------------------------------------ |
| `--color-text-primary`   | `#f0f4f8` | Primary text, headings               |
| `--color-text-secondary` | `#8b9bb4` | Secondary text, labels, descriptions |

**Rule:** Use the `text-secondary` token for muted text. Do NOT stack opacity on top of color tokens
(e.g., no `text-text-secondary/70`). If you need a third tier, use `text-text-secondary/60` — but
prefer two tiers.

### 1.3 Brand Accent Colors

Drawn directly from UTSW official palette.

| Token                  | Hex       | UTSW Name     | Usage                                        |
| ---------------------- | --------- | ------------- | -------------------------------------------- |
| `--color-primary`      | `#004c97` | Clinical Blue | Buttons, links, primary actions              |
| `--color-primary-dark` | `#00355d` | Dark Blue     | Pressed states, gradient endpoints           |
| `--color-accent`       | `#009ee2` | Bright Blue   | Glows, focus rings, hover states, highlights |
| `--color-accent-light` | `#33b5e9` | (derived)     | Lighter hover on accent elements             |

**Gradient (primary use — header, CTAs):**

```css
background: linear-gradient(to right, #004c97, #009ee2);
```

**No purple as primary accent.** Purple exists only in judge persona colors (see §1.5).

### 1.4 Functional Colors (Score & Agreement)

These are UX-functional, not brand-driven. Kept from current design — no changes.

| Token                        | Hex       | Meaning            |
| ---------------------------- | --------- | ------------------ |
| `--color-score-1`            | `#dc2626` | Poor (1/5)         |
| `--color-score-2`            | `#f97316` | Weak (2/5)         |
| `--color-score-3`            | `#eab308` | Adequate (3/5)     |
| `--color-score-4`            | `#22c55e` | Strong (4/5)       |
| `--color-score-5`            | `#16a34a` | Excellent (5/5)    |
| `--color-agreement-strong`   | `#22c55e` | Strong agreement   |
| `--color-agreement-moderate` | `#eab308` | Moderate agreement |
| `--color-agreement-weak`     | `#dc2626` | Weak agreement     |

### 1.5 Judge Persona Colors

Mapped to UTSW accent palettes. Each judge has a distinct color from the official palette.

| Judge   | Persona          | Hex       | UTSW Source                        |
| ------- | ---------------- | --------- | ---------------------------------- |
| Rater A | The Professor    | `#776cb1` | Accent Palette 1 Purple (PMS 2725) |
| Rater B | The Editor       | `#009ee2` | Primary Bright Blue (PMS 299)      |
| Rater C | The Practitioner | `#f26531` | Accent Palette 1 Orange (PMS 166)  |

### 1.6 Glow & Shadow Colors

All glow effects use Bright Blue, replacing the previous indigo.

| Usage             | Value                        |
| ----------------- | ---------------------------- |
| Focus ring        | `rgba(0, 158, 226, 0.30)`    |
| Hover glow        | `rgba(0, 158, 226, 0.25)`    |
| Card elevation    | `rgba(0, 0, 0, 0.4)`         |
| Pulse ring (anim) | `rgba(0, 158, 226, 0.5)` → 0 |

### 1.7 CopilotKit Overrides

```css
:root {
  --copilot-kit-primary-color: #004c97;
  --copilot-kit-background-color: #162033;
  --copilot-kit-contrast-color: #f0f4f8;
  --copilot-kit-muted-color: #8b9bb4;
  --copilot-kit-separator-color: rgba(0, 158, 226, 0.15);
}
```

---

## 2. Typography

### 2.1 Font Families

| Role     | Font                                                       | Source       |
| -------- | ---------------------------------------------------------- | ------------ |
| Headings | `"Open Sans", system-ui, -apple-system, sans-serif`        | Google Fonts |
| Body     | `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif` | System stack |
| Code     | `ui-monospace, "Cascadia Code", "Fira Code", monospace`    | System stack |

**Load Open Sans via Google Fonts** in `client/index.html`:

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link
  href="https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;600;700&display=swap"
  rel="stylesheet"
/>
```

Open Sans has a larger x-height than system-ui defaults, so text will feel slightly more spacious at
the same pixel size.

### 2.2 Type Scale

One-notch bump from current sizes. Optimized for a data dashboard, not a content site.

| Element                    | Current         | New              | Tailwind Class                                    |
| -------------------------- | --------------- | ---------------- | ------------------------------------------------- |
| Page title                 | 24px (text-2xl) | 30px (text-3xl)  | `text-3xl font-bold`                              |
| Page subtitle              | 14px (text-sm)  | 16px (text-base) | `text-base`                                       |
| Section labels             | 12px (text-xs)  | 14px (text-sm)   | `text-sm font-semibold uppercase tracking-widest` |
| Section descriptions       | 12px (text-xs)  | 14px (text-sm)   | `text-sm text-text-secondary`                     |
| Card titles                | 14px (text-sm)  | 16px (text-base) | `text-base font-semibold`                         |
| Card body / descriptions   | 12px (text-xs)  | 14px (text-sm)   | `text-sm`                                         |
| Badges / chips             | 12px (text-xs)  | 12px (text-xs)   | `text-xs` (unchanged)                             |
| Score number (hero)        | 48px (text-5xl) | 48px (text-5xl)  | Unchanged                                         |
| Monospace (IDs, tech text) | 12px (text-xs)  | 12px (text-xs)   | `text-xs font-mono` (unchanged)                   |
| Timeline labels            | 12px (text-xs)  | 12px (text-xs)   | Unchanged                                         |

### 2.3 Heading Font Application

All `<h1>`, `<h2>`, `<h3>` elements and elements styled as headings (page title, section labels,
card titles) use Open Sans. Body text, descriptions, and secondary labels use the system font stack.

Apply via Tailwind utility or CSS:

```css
h1,
h2,
h3,
.heading-font {
  font-family:
    "Open Sans",
    system-ui,
    -apple-system,
    sans-serif;
}
```

### 2.4 Line Height

| Context       | Value           | Tailwind          |
| ------------- | --------------- | ----------------- |
| Headings      | 1.2 (tight)     | `leading-tight`   |
| Body text     | 1.625 (relaxed) | `leading-relaxed` |
| Labels/badges | Default (1.5)   | (default)         |

Apply `leading-relaxed` consistently to all body text, not selectively.

---

## 3. Spacing

### 3.1 Reference Scale

UTSW base unit is 16px. Our Tailwind `4` = 16px. Spacing aligns.

| UTSW Token | UTSW Value | Tailwind Equivalent | Our Usage           |
| ---------- | ---------- | ------------------- | ------------------- |
| `05`       | 8px        | `2`                 | Tight internal gaps |
| `1`        | 16px       | `4`                 | Base card padding   |
| `md`       | 20px       | `5`                 | Comfortable padding |
| `2` / `lg` | 32px       | `8`                 | Section spacing     |
| `xl`       | 52px       | `13`                | Generous sections   |

### 3.2 Spacing Changes (Surgical)

| Element                       | Current            | New                 | Why                                      |
| ----------------------------- | ------------------ | ------------------- | ---------------------------------------- |
| Header vertical padding       | `py-5` (20px)      | `py-6` (24px)       | More stature with larger title           |
| Card padding                  | `p-4` (16px)       | `p-5` (20px)        | UTSW `md` = 20px; text bump needs room   |
| Card grid gap                 | `gap-3 sm:gap-4`   | `gap-4 sm:gap-5`    | Let cards breathe on desktop             |
| Section spacing               | `space-y-8` (32px) | `space-y-10` (40px) | More visual separation                   |
| Section label → description   | `mb-1` (4px)       | `mb-2` (8px)        | 4px between label and subtext is crushed |
| Gallery heading bottom margin | `mb-8` (32px)      | `mb-10` (40px)      | More room above card grid                |

### 3.3 Spacing That Stays

| Element                             | Value      | Why                       |
| ----------------------------------- | ---------- | ------------------------- |
| Main content `py-8`                 | 32px       | Matches UTSW `lg` exactly |
| Main content `px-4 sm:px-6 lg:px-8` | 16/24/32px | Responsive and correct    |
| Consensus panel `space-y-6`         | 24px       | Already comfortable       |
| `max-w-7xl` container               | 1280px     | Right for 3-col grid      |
| `max-w-3xl` editor                  | 768px      | Right for single-column   |

---

## 4. Borders & Dividers

### 4.1 Three-Tier Border Hierarchy

Not everything needs the same border weight. Structural boundaries are more visible than internal
details.

| Tier           | Color                | CSS Value                        | Use Cases                                             |
| -------------- | -------------------- | -------------------------------- | ----------------------------------------------------- |
| **Structural** | Blue-tinted, visible | `rgba(0, 158, 226, 0.15)`        | Header bottom, sidebar left, major panel boundaries   |
| **Card**       | Blue-tinted, subtle  | `rgba(0, 158, 226, 0.10)`        | All card edges (example, judge, consensus)            |
| **Internal**   | Muted gray, recedes  | `var(--color-surface-700) / 0.5` | Dividers within cards, latency footers, chat sections |

### 4.2 Suggested Tailwind Tokens

Define as CSS custom properties so they can be used in `border-[var(--x)]` or as theme extensions:

```css
--border-structural: rgba(0, 158, 226, 0.15);
--border-card: rgba(0, 158, 226, 0.1);
--border-internal: rgba(30, 45, 71, 0.5); /* surface-700 at 50% */
```

### 4.3 Card Border Recipe

All cards use the same base treatment:

```
bg-surface-800 rounded-xl border border-[var(--border-card)]
```

**Judge cards** add `border-t-4` with their persona accent color on top of the standard recipe. The
accent stripe is the personality layer; the card border is the structural layer.

**Consensus panel** highlighted state: `ring-2 ring-[rgba(0,158,226,0.40)]` (replaces indigo ring).

### 4.4 Callout Blocks

Left-bar accent pattern for callout/analysis blocks:

```
border-l-4 border-[rgba(0,158,226,0.30)]
```

Used for: disagreement analysis, any quoted/highlighted content blocks.

### 4.5 Hover States on Cards

```
hover:border-[rgba(0,158,226,0.35)]
hover:shadow-[0_0_12px_rgba(0,158,226,0.10)]
```

Subtle border brightening + faint blue glow. No scale transforms — just color shift.

---

## 5. Layout

### 5.1 Overall Structure (Unchanged)

```
┌──────────────────────────────────────────────────────────┐
│ Header  (gradient bg, structural border-b)               │
├──────────────────────────────────────────────┬───────────┤
│ Main Content (scrollable)                    │ Chat      │
│ ┌─ max-w-7xl mx-auto ─────────────────────┐ │ Sidebar   │
│ │  [Content sections, space-y-10]          │ │ w-96      │
│ └──────────────────────────────────────────┘ │           │
└──────────────────────────────────────────────┴───────────┘
```

No structural layout changes. The grid, flex containers, responsive breakpoints, and content widths
all stay.

### 5.2 Header

**Background:** Subtle top-to-bottom gradient that distinguishes the header from the content area.

```css
background: linear-gradient(to bottom, #0a1628, var(--color-surface-900));
```

**Bottom border:** Structural tier (`rgba(0, 158, 226, 0.15)`).

**Layout:** Logo left, title + attribution stacked beside it.

```
┌──────────────────────────────────────────────────────────┐
│ [UTSW Logo]  Virtual Panel Action Plan Scoring           │
│              Jamieson Lab, UT Southwestern · 2026 ACGME  │
│              Annual Educational Conference               │
└──────────────────────────────────────────────────────────┘
```

- **Logo:** UTSW institutional mark, white reversed version for dark background. Sized to align with
  title text height (~36-40px tall). Inline SVG preferred for color control.
- **Title:** `text-3xl font-bold` in Open Sans. Gradient text `from-[#004c97] to-[#009ee2]`
  (Clinical Blue → Bright Blue, replacing indigo → purple).
- **Subtitle:** `text-base text-text-secondary`. Replaces the current "AI-calibrated evaluation..."
  with institutional attribution.
- **Padding:** `px-6 py-6`

**Mobile (< sm):** Logo + title stack vertically. Attribution wraps naturally.

### 5.3 Responsive Breakpoints (Unchanged)

| Breakpoint | Content                                      |
| ---------- | -------------------------------------------- |
| Default    | 1-col cards, stacked layout                  |
| `sm`       | 2-col example gallery                        |
| `md`       | 2-col judge cards                            |
| `lg`       | 3-col example gallery, wider content padding |
| `xl`       | 3-col judge cards, sidebar visible           |

---

## 6. Effects & Animations

### 6.1 Focus / Interactive States

| State          | Effect                                                                 |
| -------------- | ---------------------------------------------------------------------- |
| Input focus    | `border-[var(--color-accent)] shadow-[0_0_0_3px_rgba(0,158,226,0.30)]` |
| Button hover   | `bg-[#009ee2]` (or lighter primary), blue glow shadow                  |
| Button pressed | `bg-[#00355d]` (Dark Blue)                                             |
| Card hover     | Border brightens to `rgba(0,158,226,0.35)`, faint blue shadow          |
| Link hover     | Color shifts from `#004c97` to `#009ee2`                               |

### 6.2 Animations (Unchanged Timing, Updated Colors)

All animation definitions stay the same. Only color values within them change:

| Animation    | Change                                                                              |
| ------------ | ----------------------------------------------------------------------------------- |
| `pulse-ring` | `rgba(99, 102, 241, 0.5)` → `rgba(0, 158, 226, 0.5)` (indigo → blue)                |
| `shimmer`    | Surface token colors update automatically via new tokens                            |
| Others       | No changes to `fade-in`, `fade-in-up`, `slide-in-right`, `score-reveal`, `converge` |

### 6.3 Glassmorphism

Reserved for **at most one or two high-impact elements** (e.g., consensus panel when highlighted, or
an overlay). Not applied to every card.

```css
backdrop-filter: blur(8px);
background: rgba(22, 32, 51, 0.7); /* surface-800 at 70% */
border: 1px solid rgba(0, 158, 226, 0.12);
```

### 6.4 What We Don't Do

- **No hover scale transforms** on cards (looks like a marketing landing page, not a research tool).
  The existing `-translate-y-0.5` on example cards is acceptable but should not spread to other
  elements.
- **No text shadows / drop shadows on headings.** Use gradient text instead.
- **No glassmorphism on every card.** Solid surfaces with blue-rim borders are the default.

---

## 7. Component-Specific Notes

### 7.1 Example Cards (DocumentInput Gallery)

- Add: unified card border (`border-[var(--border-card)]`)
- Update: hover from `hover:border-accent/60` to `hover:border-[rgba(0,158,226,0.35)]`
- Update: hover shadow from `hover:shadow-accent/5` to
  `hover:shadow-[0_0_12px_rgba(0,158,226,0.10)]`
- Bump: card title from `text-sm` to `text-base`, body from `text-xs` to `text-sm`
- Bump: padding from `p-4` to `p-5`

### 7.2 Judge Cards

- Add: `border border-[var(--border-card)]` (currently missing side/bottom borders)
- Keep: `border-t-4` accent stripe with persona color
- Update: running state ring from `ring-accent/20` to `ring-[rgba(0,158,226,0.20)]`
- Update: running state pulse-ring animation colors (see §6.2)
- Bump: padding from `p-4 sm:p-5` to `p-5 sm:p-6`

### 7.3 Consensus Panel

- Update: border to `border-[var(--border-card)]`
- Update: highlighted ring from `ring-2 ring-accent` to `ring-2 ring-[rgba(0,158,226,0.40)]`
- Update: disagreement analysis left bar from `border-surface-600` to `rgba(0,158,226,0.30)`
- Update: improvement icons from `text-accent` (indigo) to `text-[#009ee2]` (Bright Blue)

### 7.4 GradingTimeline

- Update: consensus step `accentHex` from `#6366F1` to `#004c97` (Clinical Blue)
- Update: running step circle from `#6366F1` to `#009ee2` (Bright Blue)
- Update: connector completed color from `bg-accent` to `bg-[#009ee2]`

### 7.5 ChatSidebar

- Update: `border-l` from `border-surface-700` to structural tier border
- Update: internal `border-b` dividers to internal tier
- Update: mobile FAB from `bg-accent` to `bg-primary` (`#004c97`)
- Update: suggested question chips from `bg-surface-700` to `bg-surface-700` (unchanged — these are
  fine)

### 7.6 Buttons

| Button Type | Current                           | New                                         |
| ----------- | --------------------------------- | ------------------------------------------- |
| Primary CTA | `bg-accent hover:bg-accent-light` | `bg-primary hover:bg-accent` with blue glow |
| Secondary   | `border-surface-600`              | `border-[var(--border-card)]`               |
| Ghost/link  | `text-accent`                     | `text-[#009ee2] hover:text-accent-light`    |

---

## 8. Migration Checklist

Files that need changes to implement this spec:

- [ ] `client/index.html` — Add Open Sans font link, update title/favicon/meta (Issue 51)
- [ ] `client/src/styles/app.css` — All design tokens (§1), heading font rule (§2.3), border tokens
      (§4.2), animation color updates (§6.2), CopilotKit overrides (§1.7)
- [ ] `client/src/components/GradingView.tsx` — Header layout with logo (§5.2), gradient bg, border
      updates
- [ ] `client/src/components/DocumentInput.tsx` — Card borders, hover states, text sizes (§7.1)
- [ ] `client/src/components/JudgeCard.tsx` — Add card border, update ring/pulse colors (§7.2)
- [ ] `client/src/components/JudgeCards.tsx` — Section label text size (§2.2)
- [ ] `client/src/components/ConsensusPanel.tsx` — Border, ring, callout, icon colors (§7.3)
- [ ] `client/src/components/GradingTimeline.tsx` — Accent colors for steps/connectors (§7.4)
- [ ] `client/src/components/ChatSidebar.tsx` — Border tiers, FAB color (§7.5)
- [ ] `client/src/components/DownloadRunButton.tsx` — Border update (§7.6)
- [ ] `client/src/utils/judge-personas.ts` — Update `accentHex` values (§1.5)
- [ ] `client/src/utils/score-colors.ts` — No changes
- [ ] `client/src/utils/agreement-styles.ts` — No changes
- [ ] `client/public/` — UTSW favicon, og-preview image, logo SVG (Issue 51)
