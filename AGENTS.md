# AGENTS.md — Sanket

Instructions for any AI coding agent (Claude Code or otherwise) working in this repository. Read this before touching code. If something here conflicts with a prompt you were given mid-task, this file wins unless a human explicitly overrides it in the conversation.

---

## 1. What this project is

A hackathon build (24-hour, HackSprint 2026, Applied AI track, PS41 — Sarvam API required) of a real-time, vernacular-language scam-call interruption system. Full context: `PRD.md`. Visual rules: `frontend-design.md`. Architecture: `TECHNICAL.md`. Component/module breakdown: `SKILLS.md`.

Read those four files before generating any UI, any API integration code, or any n8n workflow. Do not re-derive product decisions already made in them — implement what's specified, and flag (don't silently resolve) anything genuinely ambiguous or missing.

## 2. Non-negotiables

1. **Never fabricate a Sarvam API response** in place of a real call — not in "demo mode," not in a fallback, not in a test fixture presented as live. If the network is down during dev, write an explicit, clearly-labeled mock (`__mocks__/sarvam.mock.ts` or equivalent) that a human can see is a mock. Silent fake data pretending to be live output is a judging-integrity problem, not just a bug.
2. **Never log or persist raw audio or full transcripts from an idle/safe call.** Per `PRD.md` §10, only caution/danger-threshold sessions get persisted. Build this constraint into the data layer itself, not just the UI's display logic — an agent adding a "debug: log everything" line here is a privacy regression, not a convenience.
3. **Follow `frontend-design.md` exactly for anything user-facing.** In particular: no text directly on a blurred/translucent fill (§6.1), Calm-mode screens get zero decorative motion (§6.2), Calm-mode screens never present more than one decision (§6.3).
4. **Match the pitch deck's Data Flow Diagram.** If you change the pipeline's shape (add a step, reorder, rename a stage), update `PRD.md` §7 and `TECHNICAL.md`'s architecture diagram in the same change. These three artifacts (deck, PRD, technical doc) must stay in sync — a reviewer should never find them contradicting each other.
5. **Free tier only.** Every API call this project makes must run on a free tier or a hackathon-provided sponsor credit. If a task seems to require a paid tier (e.g., a Google Cloud service beyond the free quota), stop and flag it rather than assuming a credit card will appear.

## 3. Repo conventions

- **Language/stack:** decided in `TECHNICAL.md` §2 — check there before introducing a new framework or dependency.
- **n8n workflows** live as exported JSON under `/n8n/`, one file per workflow, named for the stage it covers (`n8n/asr-ingest.json`, `n8n/risk-scoring.json`, `n8n/alert-dispatch.json`). Don't hand-roll in code what an n8n node already does elsewhere in the pipeline — the whole point of this track is the workflow being visible and real in n8n, not reimplemented in application code.
- **Secrets:** Sarvam API key, Telegram bot token, etc. go in `.env` (gitignored) with `.env.example` kept up to date with every key name (no real values). Never hardcode a key in a commit, a script, or a demo fixture.
- **Commits:** small, one concern each. A commit that touches both a pipeline stage and unrelated UI copy should be split.

## 4. Working with the multilingual content

- Any string that might contain Hindi/Kannada/Tamil/code-mixed text must be rendered with the Noto Sans multiscript stack (`frontend-design.md` §4) — don't introduce a component that silently falls back to a Latin-only font for this content; that produces "tofu" boxes for scripts it can't render.
- Don't transliterate or "clean up" a transcript's code-mixing (e.g., don't convert "KYC अपडेट करना है" into pure Hindi or pure English) — the mixed form is the real data and the risk-scoring logic depends on recognizing it as-is.

## 5. Testing & the demo

- The judged demo run uses **live** Sarvam calls end-to-end — no mocked responses in that build/branch.
- Rehearsal runs may use cached/replayed responses to avoid burning free-tier quota — keep these clearly separated (e.g., a `DEMO_MODE=rehearsal` flag), and never let that flag leak into the branch/build used for the actual judged demo.
- Any agent adding a new pipeline stage should add a corresponding entry to the Intervention Log data model (`TECHNICAL.md`) so the Console UI has something to render — don't add backend behavior with no observable frontend trace; this product's whole value is being watchable.

## 6. When something's ambiguous

Say so, in the PR description or commit message, rather than picking silently. Specifically flag:
- Any place you had to guess a Sarvam API request/response shape because the docs didn't cover it.
- Any place the PRD and the pitch deck's Data Flow Diagram seem to disagree.
- Any place you introduced a new color/font/spacing value not in `frontend-design.md`'s token list.
