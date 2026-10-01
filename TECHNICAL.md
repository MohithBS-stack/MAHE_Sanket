# TECHNICAL.md — Sanket

Architecture, data contracts, and build/deploy notes. Companion to `PRD.md` (what/why) and `SKILLS.md` (module breakdown). Change this file in the same commit as any change to the pipeline's shape.

---

## 1. Architecture overview

```
┌──────────────┐   audio chunks   ┌──────────────────┐   transcript   ┌──────────────────┐
│ Browser / app │ ───────────────▶│  Sarvam Saarika   │ ──────────────▶│   n8n workflow    │
│ mic capture   │                 │       (ASR)       │                │  (risk-scoring)   │
└──────────────┘                 └──────────────────┘                └─────────┬────────┘
                                                                                  │ risk_score,
                                                                                  │ flagged_phrases
                                                                                  ▼
                                                                     ┌──────────────────────┐
                                                                     │  threshold-decision   │
                                                                     └──────────┬────────────┘
                                                              risk HIGH          │        risk LOW
                                                    ┌──────────────────────────┘└────────────────────┐
                                                    ▼                                                  ▼
                                         ┌─────────────────────┐                         (loop back to ASR;
                                         │   FAN-OUT (parallel)  │                          keep listening)
                                         └──────────┬───────────┘
                                    ┌────────────────┴────────────────┐
                                    ▼                                  ▼
                         ┌───────────────────┐              ┌────────────────────┐
                         │  Sarvam Bulbul     │              │  Telegram Bot API   │
                         │  (TTS, spoken       │              │  (family-notify)    │
                         │   warning, elder     │              └────────────────────┘
                         │   device)            │
                         └───────────────────┘
                                    │
                                    ▼
                         ┌───────────────────┐
                         │ incident-report-   │
                         │ generator            │
                         └───────────────────┘
```

This mirrors the pitch deck's Data Flow Diagram slide exactly. If they diverge, one of the two is wrong — fix both in the same change.

## 2. Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend (Console + Elder UI) | React + Vite, plain CSS with the token system from `frontend-design.md` (no Tailwind lock-in needed for a deck this small) | Fast iteration for a 24h build; design tokens as CSS variables map 1:1 onto §3/§4 of the design doc |
| Orchestration | n8n (self-hosted free tier, or n8n cloud free trial) | Track requirement + sponsor bonus; keeps the reasoning pipeline visible/editable rather than buried in app code |
| ASR / TTS | Sarvam APIs (Saarika, Bulbul) | Track requirement (PS41) |
| Risk reasoning | LLM call from within the n8n workflow (model TBD by whatever the team has free-tier access to) | Multi-step reasoning node inside the same visible workflow |
| Family notification | Telegram Bot API | Free, no business-account approval wait (unlike WhatsApp Business API) |
| Storage | Lightweight — SQLite or a flat JSON store for the hackathon build | Only caution/danger sessions persist (`PRD.md` §10); volume is tiny, no need for a hosted DB for the demo |
| Hosting | Static frontend on any free-tier host (e.g., Vercel/Netlify free tier); n8n either local (for the demo laptop) or on n8n cloud's free trial | Zero paid infra, matches the pitch's "free tier only" claim |

## 3. Data model

**Session** (one per call):
```json
{
  "session_id": "uuid",
  "elder_profile_id": "uuid",
  "started_at": "iso8601",
  "ended_at": "iso8601 | null",
  "language_detected": "hi | kn | ta | mixed",
  "peak_risk_score": 0-100,
  "status": "listening | caution | danger | resolved",
  "transcript": [ TranscriptLine, ... ],
  "risk_timeline": [ { "t": "iso8601", "score": 0-100 }, ... ],
  "flagged_phrases": [ "string", ... ],
  "action_taken": "dismissed_ok | called_contact | call_ended | none"
}
```

**TranscriptLine:**
```json
{ "t": "iso8601", "text": "string", "is_final": true, "language": "hi" }
```

**ElderProfile:**
```json
{
  "id": "uuid",
  "name": "string",
  "primary_language": "hi | kn | ta",
  "fallback_language": "en",
  "sensitivity_threshold": 0-100,
  "theme_preference": "light | dark | system",
  "trusted_contacts": [ { "name": "string", "telegram_chat_id": "string", "phone": "string" } ]
}
```
`theme_preference` defaults to `"light"` for the elder's own idle screen and is independent of whatever theme the guardian has set for their own Console (which defaults to `"dark"` — see `frontend-design.md` §3.1). The Alert Takeover ignores this field entirely by design.

**IncidentReport** (generated, not hand-entered):
```json
{
  "session_id": "uuid",
  "summary": "one-paragraph plain-language summary",
  "peak_risk_score": 0-100,
  "risk_timeline": [ ... ],
  "transcript_excerpt": "string, window around the peak",
  "action_taken": "string",
  "generated_at": "iso8601"
}
```

## 4. API contracts (hackathon build)

> Exact Sarvam request/response fields depend on the API version live at build time — confirm against Sarvam's current docs before coding and note any deviation from this sketch in `AGENTS.md` §6 (flag ambiguity rather than guessing silently).

**ASR (Saarika) — indicative:**
```
POST /speech-to-text
  { audio: <chunk, base64 or stream>, language: "auto" | "hi" | "kn" | "ta" }
→ { text, language_detected, confidence, is_final }
```

**TTS (Bulbul) — indicative:**
```
POST /text-to-speech
  { text, target_language, voice: "default" }
→ { audio: <bytes/url> }
```

**n8n webhook — risk scoring trigger:**
```
POST /webhook/risk-score
  { session_id, transcript_window: [TranscriptLine, ...] }
→ { risk_score, flagged_phrases: [string], reasoning_trace: string }
```

**Telegram notify:**
```
POST https://api.telegram.org/bot<token>/sendMessage
  { chat_id, text: "⚠ Risk {score}% on {elder_name}'s call. Flagged: {phrases}. {report_link}" }
```

## 5. Latency budget (target: < 3s spoken-threat → spoken-warning, per `PRD.md` §5)

| Stage | Budget |
|---|---|
| Audio chunking + upload | ≤ 400ms |
| ASR (Saarika) round-trip | ≤ 900ms |
| n8n risk-scoring (incl. LLM call) | ≤ 1000ms |
| Threshold decision | ≤ 50ms |
| TTS (Bulbul) synthesis + playback start | ≤ 650ms |
| **Total** | **≤ ~3000ms** |

If rehearsal shows this budget is being blown, the first place to cut is transcript window size sent to risk-scoring (smaller window = faster LLM call) before touching ASR/TTS themselves.

## 6. Testing plan

1. **`risk-test-set` (see `SKILLS.md` §7):** run before every rehearsal and before the judged demo. Must pass 100% on the curated set — any failure blocks moving on.
2. **Latency check:** time the full pipeline against §5's budget on the actual demo network, not just localhost.
3. **Language coverage check:** confirm Hindi + at least one of Kannada/Tamil produce both correct ASR transcripts and correct-language TTS warnings, end to end, before the demo.
4. **Privacy check:** confirm an idle/safe session leaves no persisted transcript (spot-check the storage layer directly, don't just trust the UI not showing it).
5. **Failure-mode rehearsal:** deliberately test what the Console shows if Sarvam's API errors or times out mid-call — it should fail visibly and safely (e.g., "connection lost, re-listening") rather than silently freezing on a stale risk score.

## 7. Deployment / demo-day checklist

- [ ] Sarvam API keys loaded from `.env`, not hardcoded, confirmed working on the venue Wi-Fi beforehand
- [ ] n8n workflow imported and reachable (local instance or cloud free trial) — test the webhook URL from the actual demo laptop
- [ ] Telegram bot registered, guardian's chat ID confirmed working
- [ ] `risk-test-set` passing
- [ ] One rehearsed demo call script, timed, in the primary language
- [ ] Backup: a pre-recorded fallback audio clip + cached responses, only used if live network fails during the judged run — disclose this to judges if it's used, don't pass it off as live
