# PRD — Sanket
*Real-time, vernacular scam-call interruption*
Applied AI · PS41 (Sarvam API required) · HackSprint 2026, MAHE Bengaluru

---

## 0. Naming

The working name in earlier drafts of this doc was **"Saathi"** ("companion"). Dropped it after checking the Indian Trademark Registry and the live app landscape:
- "Saathi" and "Sathi" are already in use by, among others, *Jeevansathi* (a major matrimonial platform), several registered software trademarks, and — most disqualifying — **Sanchar Saathi**, the Indian government's own nationwide, pre-installed-on-every-new-phone app for telecom fraud protection. Sharing a name with a government app in the *same problem space* is a real collision, not a trademark technicality.

**Chosen name: Sanket** (संकेत — "signal / sign / cue" in Hindi and Sanskrit, understood across most North Indian languages).
- Directly names the product's mechanic: the system is built to catch the *signal* — the phrase, the tone, the pattern — that a call has turned into a scam.
- Ties directly to the design system's own color language (`frontend-design.md` §3 — the risk states are literally called "signal-teal," etc.), so the name and the UI reinforce each other rather than being arbitrary.
- Checked against the current Indian scam-protection app landscape (ScamMukt, CitizenGuard, ScamDekho, AntiFraud.AI/IamSafe, AI Kavach) — none use this name, and none use this mechanic (all are post-hoc link/message/number checkers, not live mid-call vernacular intervention).
- The word is registered as a trademark in one unrelated goods class (stationery/paper) in India — not a conflict for a software product, but worth a proper trademark search before any real filing.

**Runner-up names considered and kept as a fallback shortlist**, in case a full legal clearance later rules out Sanket: **Alap** (आलाप — the opening exchange of a conversation, evocative of "the call") and **Chaukas** (चौकस — vigilant, watchful). Both came back clean in the same search pass — no collisions found in the software/app space — but "Sanket" was chosen as the strongest fit because it names the *mechanic*, not just the mood.

---

## 1. Problem

India loses an estimated ₹20,000+ crore a year to phone and UPI fraud. The people hit hardest — elderly and non-English-speaking users — are the ones existing fraud tools serve worst:
- Bank/Truecaller-style tools flag a number **after** the fact, or block/alert **in English**, or via a **text notification** an elder may not see or understand mid-call.
- Nothing intervenes **during** the call, **out loud**, **in the language the victim is actually speaking**.

## 2. Goal

While a call is on speakerphone, listen, reason about scam intent in real time, and — the moment risk crosses a threshold — **speak a warning aloud in the victim's own language**, before an OTP or a rupee changes hands. Simultaneously, silently notify a trusted family member.

## 3. Non-goals (for this build)

- Carrier-level / telecom-integrated automatic call scanning (roadmap, not hackathon scope).
- Coverage of all 22 scheduled languages (hackathon scope: Hindi, Kannada, Tamil + code-mixed English).
- On-device/offline processing (hackathon scope calls Sarvam's cloud APIs; on-device is a stated roadmap item, see frontend-design.md's parity with the pitch deck).
- Law-enforcement integration, evidence/legal chain-of-custody features.

## 4. Personas & jobs-to-be-done

| Persona | Job to be done |
|---|---|
| **Elder** (call recipient) | "Tell me, unmistakably and in my language, whether I'm in danger — and tell me what to do next." |
| **Guardian** (adult child / caregiver) | "Let me set this up once, then trust it to watch for both of us. If something happens, tell me immediately and let me review it later." |
| **Judge / demo viewer** | "Show me, live, that this actually works — and that it's technically real, not a mockup." |

## 5. Success metrics

| Metric | Hackathon-scope target | Why it matters |
|---|---|---|
| End-to-end latency (spoken threat → spoken warning) | < 3 seconds | Anything slower and the OTP is already shared |
| False-positive rate on the demo script | 0 on the rehearsed run; documented failure modes for anything else | Credibility with judges |
| Languages demonstrably working | ≥ 2 (Hindi + 1 of Kannada/Tamil), code-mixed | Directly answers Sarvam's brief ("most AI tools are built for English speakers") |
| Sponsor tech surfaced in demo | Sarvam (ASR + TTS) as primary; n8n visibly orchestrating | Track requirement + bonus scoring |

## 6. Information architecture (pages/views)

| # | View | Primary user | One-line purpose |
|---|---|---|---|
| A | **Onboarding & Setup** | Guardian | Create elder profile, set language, add trusted contacts, grant mic permission |
| B | **Guardian Console — Live Monitor** | Guardian, Judge | The "wow" screen: live transcript, risk gauge, waveform, intervention log |
| C | **Alert Takeover** | Elder | Full-screen state change the instant risk crosses threshold; spoken + written warning; two actions |
| D | **Post-Call Incident Report** | Guardian | Auto-generated structured summary: duration, transcript excerpt, risk timeline, action taken |
| E | **Family Notification** | Guardian | The Telegram/push message they receive the instant risk crosses threshold |
| F | **History** | Guardian | Searchable list of past calls/incidents, filterable by language/date/risk level |
| G | **Settings** | Guardian | Per-elder language, sensitivity threshold, trusted contacts, data retention/delete |
| H | **Elder minimal companion (idle state)** | Elder | The *only* thing an elder sees day-to-day when nothing is wrong — a single calm "Listening" indicator |

Full visual spec for each surface: see `frontend-design.md`. Full data contracts: see `TECHNICAL.md`.

## 7. User workflow (end to end)

```
1. SETUP (once)
   Guardian installs → creates elder profile → sets primary language(s)
   → adds trusted contacts → grants mic permission.

2. IDLE / LISTENING
   Elder is on a call, speakerphone on. Console shows "Listening" (signal-teal).
   Nothing else happens. No sound, no interruption.

3. DETECTION (continuous, every few seconds)
   Sarvam Saarika (ASR) streams a rolling transcript
     → n8n workflow scores scam intent (multi-step reasoning)
     → Console gauge updates live: teal → marigold as risk rises.

4. THRESHOLD BREACH
   Risk crosses the danger line
     → Elder's device: Alert Takeover (C) fires — screen + Sarvam Bulbul (TTS) spoken warning, simultaneously
     → Guardian: Family Notification (E) fires — Telegram message with transcript snippet + risk score
     → Console: log entry recorded, gauge locks to crimson.

5. RESOLUTION
   Elder taps "I'm okay" or "Call [contact] now," or the call simply ends
     → system finalizes an Incident Report (D)
     → entry saved to History (F).

6. REVIEW (anytime)
   Guardian opens History → reviews report → optionally tunes sensitivity in Settings (G).
```

This is the same flow visualized as a diagram in the pitch deck (`Data Flow Diagram` slide) — the PRD and the deck must never drift apart; if the flow changes, update both.

## 8. Functional requirements by view

**A — Onboarding**
- FR-A1: Create one or more elder profiles, each with a primary + fallback language.
- FR-A2: Add ≥1 trusted contact per elder profile (name, phone/Telegram handle).
- FR-A3: Explicit, plain-language mic-permission consent screen — states what is listened to, when, and that nothing is recorded unless risk crosses threshold (see Privacy, §10).

**B — Guardian Console**
- FR-B1: Live transcript panel, auto-scrolling, current interim result visually distinct from finalized text.
- FR-B2: Risk gauge, 0–100, three-color banding (teal/marigold/crimson), updates on every scoring cycle.
- FR-B3: Flagged-phrase list, populated as the risk engine matches known scam patterns.
- FR-B4: Intervention log, timestamped, append-only for the session.
- FR-B5: Visibly shows which sponsor tech is active (small, honest — not decorative) for demo/judging transparency.

**C — Alert Takeover**
- FR-C1: Triggers within the latency budget (§5) of threshold breach.
- FR-C2: Shows native-language text + English text simultaneously (never a toggle).
- FR-C3: Exactly two actions: primary ("I'm okay" — dismiss) and secondary ("Call [contact] now" — direct dial).
- FR-C4: Spoken TTS warning plays concurrently with the screen appearing.

**D — Incident Report**
- FR-D1: Auto-generated on call end or on dismissal of an Alert Takeover.
- FR-D2: Contains: timestamp, duration, peak risk score + timeline, transcript excerpt around the peak, action taken, language detected.
- FR-D3: Exportable (this is the "structured document from raw conversational input" angle — see note below).

**E — Family Notification**
- FR-E1: Delivered via Telegram Bot API (free tier) in the hackathon build.
- FR-E2: Contains risk score, flagged phrase(s), and a deep link into the Incident Report once generated.

**F — History**
- FR-F1: List, newest first, filterable by date/language/risk level.
- FR-F2: Tapping an entry opens its Incident Report.

**G — Settings**
- FR-G1: Per-elder sensitivity threshold (slider, with plain-language labels, not raw numbers, for the guardian-facing copy).
- FR-G2: Manage trusted contacts and languages.
- FR-G3: Data retention control — delete a transcript/recording on demand (see Privacy).
- FR-G4: Theme control — per-elder light/dark override for their idle screen (defaults to light; see `frontend-design.md` §3.1 for why), and a separate light/dark toggle for the guardian's own Console/History/Incident Report/Settings views (defaults to dark). The Alert Takeover is exempt from this control — it is always the fixed alarm color regardless of theme setting.

**H — Elder companion (idle)**
- FR-H1: Single state indicator, Calm-mode styling, no navigation, no settings exposed here.

> **Note on the "BRD Generation Agent" track blurb:** Applied AI's track description talks about turning raw input into a structured document. FR-D2/D3 (the Incident Report) is that same mechanic applied to our domain — a structured, clarity-focused document generated automatically from raw conversational input (the call transcript) — so the build satisfies that framing without being a second product.

## 9. Scope for the 24-hour build

**Must demo live:** B (Console), C (Alert Takeover), the ASR→risk→TTS pipeline end to end, E (Telegram notification).
**Can be partially mocked/seeded for the demo:** A (Onboarding — show the screens, seed one profile ahead of time), F (History — can be pre-seeded with the demo run + one or two fake past incidents), G (Settings — UI can exist without every control being wired).
**Explicitly cut if time-constrained:** multi-elder-profile switching, retention/delete actually wired to storage (show the control, note it's roadmap), anything beyond 2–3 languages.

## 10. Privacy & trust (must be true, not just stated)

- Nothing is stored unless risk crosses the caution threshold — idle listening is not persisted.
- The Alert Takeover and Incident Report are the *only* artifacts retained, and only for the family circle that set the profile up.
- Consent is collected once at Onboarding, in plain language, in the elder's own language.
- Delete-on-demand is a real control, not a placeholder, once past the hackathon MVP.

## 11. Risks

| Risk | Mitigation |
|---|---|
| ASR latency too high for the 3s budget under demo Wi-Fi | Pre-test the exact demo network; have a pre-recorded fallback clip queued as backup |
| False positive during live demo (a judge's innocent question flagged) | Script the demo call precisely; don't rely on live improvisation for the primary run |
| "Isn't this just AI Kavach?" question from judges | Have the differentiation answer ready verbatim (mid-call, vernacular, spoken — not post-hoc/English/text) — see pitch deck slide 4 |
| Sarvam API rate limits/free-tier caps during rehearsal | Cache/replay known-good responses for rehearsal; only hit live API for the actual judged run |
