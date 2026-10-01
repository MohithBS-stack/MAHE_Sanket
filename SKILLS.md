# SKILLS.md — Sanket

A catalog of the discrete capabilities ("skills") this system is built from. Each one is independently buildable, testable, and — critically for a 24-hour hackathon — independently *demoable*, so a partial build still shows real, working pieces rather than one all-or-nothing pipeline.

Use this as the work-breakdown when splitting tasks across teammates or AI coding agents: each skill below is a reasonable single unit of work.

---

## 1. `call-audio-capture`

**Purpose:** get live call audio into the pipeline.
**Input:** device microphone stream (speakerphone).
**Output:** rolling audio chunks (e.g., 3–5s windows) pushed to `asr-transcription`.
**Free-tier note:** browser `getUserMedia` / mobile mic APIs — no telecom integration, no cost.
**Demo-ability:** can be shown standalone — "here's the raw audio meter reacting to speech" — even before anything downstream exists.

## 2. `asr-transcription` (Sarvam Saarika)

**Purpose:** turn audio chunks into a rolling, code-mixed-aware transcript.
**Input:** audio chunk from `call-audio-capture`.
**Output:** `{ text, language_detected, is_final, timestamp }` appended to the session transcript.
**Free-tier note:** Sarvam's hackathon-provided API key.
**Demo-ability:** standalone — speak into the mic, watch the transcript panel populate live, in Hindi/Kannada/Tamil/code-mixed.
**Key risk:** latency. Budget this stage tightly; it's the front of the 3-second end-to-end target in `PRD.md` §5.

## 3. `risk-scoring` (n8n + LLM reasoning)

**Purpose:** multi-step reasoning over the rolling transcript to produce a 0–100 scam-risk score and a list of matched red-flag phrases.
**Input:** transcript window from `asr-transcription`.
**Output:** `{ risk_score, flagged_phrases[], reasoning_trace }`.
**Built as:** a visible n8n workflow (`n8n/risk-scoring.json`) — this is the track's core requirement (PS22-style "built with n8n" orchestration used as the bonus-stacking layer described in the pitch deck's Tech Stack slide), not hidden application code.
**Demo-ability:** standalone — feed it a canned transcript line ("please share the OTP"), watch the score jump, in the n8n canvas itself if useful for judges.
**Key risk:** false positives/negatives. Maintain a small, hand-curated test set of real and benign phrases (see §7).

## 4. `threshold-decision`

**Purpose:** the simple, auditable gate between "keep watching" and "intervene."
**Input:** `risk_score` from `risk-scoring`.
**Output:** a boolean + which downstream skills fire (`vernacular-alert`, `family-notify`).
**Note:** deliberately kept as its own thin skill, not folded into `risk-scoring`, so the threshold value is a single, obvious, tunable number (`PRD.md` FR-G1) rather than buried in reasoning logic.

## 5. `vernacular-alert` (Sarvam Bulbul)

**Purpose:** speak the warning aloud, in the language the elder is speaking, the instant the threshold fires.
**Input:** `language_detected` (from `asr-transcription`) + a warning-message template.
**Output:** synthesized audio played immediately + the same text rendered on the Alert Takeover screen (`frontend-design.md` §5, Calm mode).
**Free-tier note:** Sarvam's hackathon-provided API key.
**Demo-ability:** standalone — trigger it manually with a language code, hear the correct-language warning play.

## 6. `family-notify` (Telegram Bot API)

**Purpose:** silently alert a trusted contact the instant the threshold fires.
**Input:** `risk_score`, `flagged_phrases`, a link to the (eventually generated) Incident Report.
**Output:** a Telegram message to the guardian's registered chat ID.
**Free-tier note:** Telegram Bot API is free, no approval wait (unlike WhatsApp Business API) — this is *why* Telegram was chosen over WhatsApp for the hackathon build; revisit for production.
**Demo-ability:** standalone — fire a test event, watch the phone buzz.

## 7. `risk-test-set`

**Purpose:** not a runtime skill — a small fixture of hand-written transcript lines, half genuine scam patterns, half benign lookalikes (e.g., a real bank calling about an actual delivery), used to sanity-check `risk-scoring` before every demo run.
**Output:** pass/fail table, referenced in `TECHNICAL.md`'s testing section.
**Why it matters:** the single biggest live-demo risk (`PRD.md` §11) is a false positive or false negative in front of judges — this skill exists purely to catch that before it happens live.

## 8. `incident-report-generator`

**Purpose:** once a call ends (or the Alert Takeover is dismissed), assemble the structured summary: duration, peak risk + timeline, transcript excerpt around the peak, action taken, language.
**Input:** the full session's transcript + risk-scoring log.
**Output:** a structured document (see `TECHNICAL.md` for the exact schema) rendered in the Incident Report view (`PRD.md` FR-D).
**Note:** this is the skill that answers the Applied AI track's "structured document from raw conversational input" framing, applied to this domain rather than built as a second, unrelated feature.

## 9. `guardian-console-ui`

**Purpose:** the live dashboard — transcript stream, risk gauge, waveform, intervention log.
**Depends on:** `asr-transcription`, `risk-scoring`, `threshold-decision` (as data sources).
**Spec:** `frontend-design.md` §5 (Console mode) — glass panels, three-color risk gauge, structural (not decorative) use of color.

## 10. `elder-alert-ui`

**Purpose:** the full-screen takeover on the elder's own device.
**Depends on:** `threshold-decision`, `vernacular-alert` (for the text to display, synced with the spoken audio).
**Spec:** `frontend-design.md` §5 (Calm mode) — the one screen in the whole product allowed zero ambiguity: one state, two buttons, native language first.

---

## Build-order suggestion for a 24-hour clock

1. `call-audio-capture` + `asr-transcription` (prove Sarvam ASR works, in the actual target languages, first — everything depends on this)
2. `risk-scoring` in n8n, tested against `risk-test-set` before wiring anything else to it
3. `threshold-decision` + `vernacular-alert` (prove the TTS interrupt works, end to end, before building the pretty dashboard around it)
4. `guardian-console-ui` (this is what makes the demo *look* finished — build it once the pipeline underneath is real, not before)
5. `elder-alert-ui`
6. `family-notify`
7. `incident-report-generator` — lowest risk to cut/simplify if the clock runs out; the live intervention is the demo's actual payload.
