# Frontend Design System — Sanket
*(संकेत — "signal / cue / sign" in Hindi & Sanskrit, shared across most North Indian languages. Chosen after checking the Indian Trademark Registry and the current scam-detection app landscape — see `PRD.md` §0 for the naming rationale. Swap via find-replace if the team later prefers something else.)*

Applied AI · PS41 (Sarvam API) · HackSprint 2026, MAHE Bengaluru

This document is the single source of truth for visual and interaction design. It exists so that every screen anyone builds — hackathon night or post-hackathon — looks like it came from the same product, not five different tutorials stitched together.

---

## 1. Grounding

**Subject:** a live phone call. Someone's grandmother, on speakerphone, being talked into sharing an OTP by a stranger pretending to be from her bank.

**Audience — three very different people, one product:**
| Persona | Tech comfort | Language | What they need from the screen |
|---|---|---|---|
| The elder on the call | Low | Regional (Hindi/Kannada/Tamil), often not English | Almost nothing — one glance tells them "safe" or "danger," one tap does the obvious thing |
| The guardian (family member) | Medium–high | Bilingual | A live, legible read on what's happening, and a history they can dig into later |
| The judge / demo viewer | High | English | To feel the "wow" in under 10 seconds on a projector |

**Primary job of the UI:** turn a silent, technical pipeline (ASR → risk score → TTS) into something a scared, distracted, or elderly person can react to correctly in under 3 seconds — while also being legible and impressive as a live demo.

This is why the system below is **deliberately two different visual languages under one brand**, not one style stretched to fit two opposite jobs.

---

## 2. Styles considered

| Style | What it's good at | Why it's wrong (or right) here |
|---|---|---|
| **Brutalism** | Urgency, rawness, high contrast | Reads as "alarming" for *every* state, not just danger. An elder would see the "safe" screen and think something's already wrong. Rejected as the base — borrowed only for the alert *moment*. |
| **Maximalism** | Density, personality, delight | Directly fights the #1 rule from elder-accessibility research we pulled: single focus per screen, no competing stimuli. Rejected outright. |
| **Neumorphism** | Soft, tactile | Low contrast by construction (soft-on-soft shadows) — accessibility research and WCAG both flag this as one of the worst styles for low-vision or older users. Rejected outright. |
| **Skeuomorphism** | Familiarity via real-world metaphor | Dated, and doesn't map cleanly to "AI listening to a call." Rejected. |
| **Minimalism** | Clarity, single focus, calm, fast comprehension | **Chosen for the elder-facing surface.** Every piece of published elder-UX research we checked converges on this: plain backgrounds, one action, no text over imagery, large type, high contrast. |
| **Glassmorphism** | Depth, hierarchy for *dense* live data, feels premium/technical on a dark background | **Chosen — narrowly — for the Guardian Console**, where the audience is tech-comfortable and the content genuinely has layers (live transcript + risk gauge + waveform + log). The style's well-documented failure mode is text-on-blur becoming unreadable — so our rule (§6) is: **glass is only ever a background treatment behind chrome; every readable string sits on a ~92%-opaque solid chip, never on blur.** |

**Decision — a dual-mode system, one brand:**
1. **"Console" mode** (Guardian Console, History, Incident Report, Settings, and the demo screen judges see) — restrained dark glassmorphism.
2. **"Calm" mode** (the elder's own device, the alert takeover, any screen an elder might see) — flat, high-contrast, single-focus minimalism. No blur, no transparency, no motion beyond the one state-change.

Both modes share the same color tokens, type system, and the three-state risk language (below), so they read as one product, not two apps bolted together.

---

## 3. Color

Base tokens, each tied to something in the product rather than picked for looks — most importantly, three of them **are the actual risk states**, so color is a structural device (it tells you the system's status), not decoration. Every accent has a light-surface and a dark-surface shade so contrast holds in both themes (see §3.1) — this is a deliberate dual-shade system, not two unrelated palettes.

| Token | Light-surface shade | Dark-surface shade | Role |
|---|---|---|---|
| `abyss` | — | `#081A1D` | Dark-mode page background (deepest layer, Console only) |
| `ink-dusk` | `#0E2A2E` (text) | `#12333A` (elevated card surface) | Light-mode primary text / Dark-mode elevated panel surface |
| `mist` | `#F5FAFA` (background) | `#E4EFEF` (primary text) | Light-mode page background / Dark-mode primary text (dimmed off-white, not pure `#FFF` — pure white on dark causes halation for some users) |
| `signal-teal` | `#1F8F82` | `#2BB3A3` | **Risk state: SAFE.** Brand accent, "listening" idle state, primary buttons. Darker shade on light surfaces to hold 4.5:1 contrast; brighter shade on dark surfaces where it can glow |
| `marigold` | `#B97A12` | `#F2A93B` | **Risk state: CAUTION.** Named for the marigold used in Indian warning/ceremonial contexts — the mid-point between safe and danger |
| `alarm-crimson` | `#B81C3B` | `#D6294B` | **Risk state: DANGER** *inside themed UI* (gauge, log, chips). The full-screen Alert Takeover itself does **not** use this token — see §3.1, it's a fixed, theme-independent color |
| `fog` | `rgba(14,42,46,0.06)` | `rgba(245,250,250,0.08)` | Glass panel fill on Console — *only* for the panel itself, never behind text (see §6) |

Do not introduce a new color without a reason tied to content. If you need a "disabled" or "muted" state, use the existing tokens at reduced opacity, not a new gray.

### 3.1 Light mode & dark mode

**This was an open question worth actually checking rather than assuming "dark = modern, ship it."** What we found:

- A Nielsen Norman Group–cited study (Piepenbrock et al., Düsseldorf) tested light-on-dark vs. dark-on-light reading performance in both young adults (18–33) and **older adults (60–85)** specifically. Light mode (dark text on light background) won across every measure, for *both* age groups — and the advantage grew as text got smaller.
- A separate tablet study specifically on Thai elderly users independently reached the same conclusion: light mode preferred for ease of reading.
- Dark mode's real, legitimate advantage is for people with photophobia or cloudy ocular media (e.g. cataracts) and for reduced eye strain in low light generally — a genuine subset of users, just not the default-best choice for our specific primary audience.

**What this means for each surface:**

| Surface | Default | Why | Dark mode available? |
|---|---|---|---|
| **Elder Calm-mode (idle "Listening" screen)** | **Light** (`mist` bg / `ink-dusk` text) | Directly matches the older-adults research above — this is the one surface where getting this specific call right matters most | Yes — respects the phone's OS-level dark mode setting automatically (an elder is unlikely to dig into an in-app toggle), and the guardian can force one or the other for that elder's profile in Settings |
| **Guardian Console** | **Dark** (`abyss` bg, glass panels) | This audience is tech-comfortable; dark suits a live "mission control" read, suits a dim demo room, and is where the glassmorphism treatment actually looks intentional | Yes — full light variant uses the same layout with `mist` background and `fog`'s light-surface shade; it deliberately echoes the pitch deck's own light-teal-gradient look, so the product and the pitch deck feel like the same object |
| **History / Incident Report / Settings** | Follows whatever the guardian has set for Console | These are guardian-facing, reviewed at any time of day | Yes, same toggle as Console |
| **Alert Takeover** | **Neither — fixed** | This is an interrupt, not a themed screen. It is always solid `alarm-crimson` (`#D6294B`) with white text, regardless of the device's light/dark setting. An alarm that quietly adjusted itself to "match your theme" would be exactly the wrong instinct — the one moment in this product that must never be subtle stays outside the theme system entirely. | N/A by design |

**Implementation note:** theme is a single CSS custom-property swap (`data-theme="light" | "dark"` on the root), defaulting per §3.1's table, overridable per surface in Settings. Don't hand-roll a second set of components for dark mode — every component in §9 must accept both themes through the token swap alone.

---

## 4. Type

| Role | Typeface | Why |
|---|---|---|
| Display / brand / big numbers | **Space Grotesk** | Geometric with slightly technical, signal-like letterforms — reads as "instrument," not "marketing site." Used for the risk gauge's number, page titles, the product name. |
| UI body (Latin) | **Inter** | Not a lazy default here — it's the most-tested-for-legibility UI face at small sizes and at large accessibility-mode sizes alike, which matters when the same string has to work at 14px in a log and 32px on the elder's screen. |
| Live/dynamic multilingual content (transcript, spoken-alert captions) | **Noto Sans + Noto Sans Devanagari / Kannada / Tamil** | One harmonized family across scripts, maintained specifically so mixed-script lines (Hindi word next to an English word next to a Kannada word — exactly what a real code-mixed transcript looks like) share the same x-height and weight. Anything else risks visually mismatched or "tofu" (missing-glyph box) text the moment a script the font doesn't cover appears. |
| Technical/tabular data (timestamps, confidence %, latency ms) | **JetBrains Mono** | Used sparingly, only where digits genuinely need to line up in a column. Not used as a decorative "label" font — that's a generic tell we're deliberately avoiding. |

**Type scale** (base 16px, ratio 1.25):
`12 / 14 / 16 / 20 / 25 / 31 / 39 / 49 px`
- Calm-mode minimum body size: **24px** (elder-accessibility research: nothing smaller than ~24pt-equivalent on a screen this size for this audience).
- Console minimum body size: **14px**, log/meta text may drop to 12px.
- Line length: cap prose at ~70 characters; transcript lines wrap naturally, no cap.

---

## 5. Layout

**Alignment:** left-aligned throughout. No centered paragraphs anywhere except the single-word/short states on the elder's Alert screen, where centering *is* the content (nothing else on screen to align against).

**Grid:** 8px base unit. Console uses a 12-column responsive grid (dashboard-style, panels can span 3/4/6/12). Calm mode uses a single column, always — see the anti-pattern list, "don't divide the elder's screen into multiple actions."

### Guardian Console — primary screen (ASCII wireframe, shown in its default dark theme)

The light variant uses the identical layout — swap `abyss`→`mist`, `ink-dusk`(text)→`ink-dusk`(as text, unchanged), glass fill to its light-surface shade. Don't redesign the layout per theme, only the token values.

```
┌─────────────────────────────────────────────────────────────┐
│  Sanket          ● Listening              [Family ▾] [⚙]    │  <- slim header, not a hero
├───────────────────────────────┬───────────────────────────────┤
│  LIVE TRANSCRIPT               │  RISK                        │
│  ┌───────────────────────────┐│  ┌─────────────────────────┐ │
│  │ ".....................    ││  │        ╭───────╮        │ │
│  │  ...में KYC अपडेट करना है" ││  │       │  62%   │        │ │  <- radial gauge,
│  │  ▓▓▓▓▓▓▓▓▓▓▓▓░░░░ (live)  ││  │        ╰───────╯        │ │     teal→marigold→crimson
│  └───────────────────────────┘│  │   CAUTION — watching    │ │
│                                │  └─────────────────────────┘ │
│  waveform: ∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿    │  flagged phrases:            │
│                                │   • "OTP"  • "KYC update"    │
├───────────────────────────────┴───────────────────────────────┤
│  INTERVENTION LOG                                              │
│  00:42  Risk crossed 40% — began close monitoring              │
│  00:58  Phrase match: "share the code" — risk 62%               │
└─────────────────────────────────────────────────────────────┘
```
- Left column = the "what's being said" story (transcript + waveform). Right column = the "what the system thinks" story (gauge + flagged phrases). This split is the whole point of the screen — don't reorganize it into generic equal-width cards.
- The gauge is a glass panel (`fog` fill, 1px `mist`-at-20%-opacity border, blur behind it only). The **number and label sit on a solid `ink-dusk` chip inside the glass**, never directly on the blurred fill.

### Elder Alert screen (Calm mode) — full takeover
*(fixed `alarm-crimson`, independent of light/dark theme — see §3.1. The elder's everyday idle "Listening" screen, by contrast, defaults to light mode and follows the device's own theme setting.)*

```
┌─────────────────────────────────────┐
│                                       │
│                                       │
│              ⚠                       │
│                                       │
│        यह कॉल असली नहीं लग रही      │
│         (This call may not be safe)  │
│                                       │
│                                       │
│   ┌───────────────────────────────┐ │
│   │      मैं सुरक्षित हूँ          │ │   <- one primary action
│   │        I'm okay                 │ │
│   └───────────────────────────────┘ │
│   ┌───────────────────────────────┐ │
│   │   अभी [नाम] को कॉल करें       │ │   <- one secondary action
│   │      Call [Name] now            │ │
│   └───────────────────────────────┘ │
│                                       │
└───────────────────────────────────────┘
```
- Solid `alarm-crimson` background, no gradient, no blur, no glass — this is the one screen where the brutalist instinct (raw, undecorated, impossible to misread) is correct, borrowed deliberately rather than as the whole system's base.
- Exactly two buttons. Never more. Native language first, English second, both always visible (never a toggle).
- The spoken TTS warning plays at the same moment this screen appears — sound and screen change together, not one before the other.

---

## 6. Rules that keep this accessible (non-negotiable)

1. **Never put readable text directly on a blurred/translucent fill.** Every string on the Console sits on an ≥90%-opaque chip. This is glassmorphism's most common, most-documented failure mode — we design around it rather than discovering it in testing.
2. **Calm mode has zero motion beyond the one state transition** (idle → alert). No hover animations, no skeleton shimmer, nothing ambient. Elder-accessibility research is explicit that competing stimuli cost this audience the most.
3. **Never divide the elder's screen into more than one decision.** One state, one or two buttons, done.
4. **Every color pairing meets WCAG AA (4.5:1) at minimum**; Calm-mode text meets AAA (7:1) where feasible, since we're deliberately serving a low-vision-skewed audience.
5. **Captions/subtitles accompany every spoken output** — the Alert screen's text *is* the caption for the TTS voice, always shown, never audio-only.
6. **Touch targets ≥ 48px on Console, ≥ 64px on Calm mode** (research on older adults' motor precision).

---

## 7. Motion

One orchestrated moment, not scattered effects:
- **The single moment that gets animation budget:** the risk gauge's transition from Caution → Danger, and the Console-to-full-red-takeover on the elder's screen. Make this feel inevitable and immediate (150–250ms, no bounce/ease-out flourish — this is a warning, not a delight moment).
- Everything else (log entries appearing, transcript streaming in) is a simple, fast fade/append — utilitarian, not a "reveal."
- Respect `prefers-reduced-motion`: the state-change still has to communicate instantly via color + icon + haptics/sound, animation is a bonus, not the mechanism.

---

## 8. Anti-patterns — things we are deliberately NOT doing

Called out explicitly because they're the default a generic AI-assisted build tends toward:
- No warm-cream (`#F4F1EA`-adjacent) background anywhere — we use `mist`, a cooler, teal-leaning white.
- No single hot accent color on near-black used as *the whole system's identity* — we have three accent colors and they mean three specific things (safe/caution/danger), not vibes.
- No tracked-out ALL-CAPS eyebrow labels above every card title.
- No decorative monospace on labels that aren't actual tabular data.
- No tinted-near-black (`#0B0B0B`/`#111`) — our dark is `ink-dusk`, a real hue.
- No tacked-on "→" at the end of buttons.
- No numbered 01/02/03 markers unless the content is genuinely a sequence (the Intervention Log is chronological and *can* use timestamps — that's earned, not decorative).

---

## 9. Reusable components (build these once, use everywhere)

| Component | Used on | Notes |
|---|---|---|
| **RiskGauge** | Console, Incident Report | Radial, teal→marigold→crimson gradient sweep, big Space Grotesk number in center |
| **TranscriptStream** | Console, Incident Report (as static excerpt) | Noto Sans multiscript, auto-scroll, current interim ASR result shown at reduced opacity until finalized |
| **StateChip** | Console header, History list rows | Small pill: dot + label, one of the three risk colors + "Listening" neutral state |
| **AlertTakeover** | Elder device | Full-screen, two-button, the one Calm-mode/Brutalist-borrowed screen |
| **IncidentCard** | History list | Timestamp, duration, peak risk color, one-line excerpt |
