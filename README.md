# Sanket (संकेत) — Real-Time Vernacular Scam Call Defense & Interruption

> **Live Protection against financial fraud, digital arrests, and utility scams for Indian elders — in their native language.**

---

## 📌 Overview

**Sanket (संकेत)** is an AI-powered real-time scam call detection and intervention platform engineered specifically for Indian seniors and their families. 

Indian elders are increasingly targeted by coercive fraud schemes—including fake **Electricity Board disconnections**, **SBI/Bank KYC expiry threats**, **TRAI/CBI Digital Arrests**, and **coercive AnyDesk/APK downloads**.

Sanket listens to live phone calls on speakerphone, streams continuous audio into **Sarvam AI Saaras v3 ASR**, evaluates scam signatures in real time, and immediately triggers a **full-screen vernacular audio warning (via Sarvam Bulbul TTS)** on the elder's phone while silently notifying family guardians via **Telegram**.

---

## ✨ Key Features

1. **🎙 Continuous 16kHz Studio Audio Pipeline**:
   - Web Audio PCM downsampling and RIFF WAV encoding.
   - Built-in Voice Activity Detection (VAD) / Silence gating to eliminate background noise.
   - Real-time VU meter and dynamic frequency soundwave equalizer.

2. **🇮🇳 Sarvam AI Vernacular Speech-to-Text (Saaras v3)**:
   - High-accuracy recognition across 22+ Indian languages (Hindi, Kannada, Tamil, English, etc.).
   - Code-mixing and Hinglish/Kanglish support with zero font tofu boxes.

3. **🧠 Dual-Layer Threat Scoring**:
   - High-speed local Indian fraud pattern taxonomy matching.
   - Optional webhook integration with **n8n / LLM reasoning workflows**.
   - Rolling risk gauge from 0% (Safe) to 100% (Critical Scam Alert).

4. **🔊 Vernacular Spoken Intervention (Sarvam Bulbul v3)**:
   - Plays loud, authoritative vernacular warning over speakerphone the moment danger threshold (≥70%) is breached.
   - Example: *"सावधान! यह कॉल असली नहीं लग रही है। कृपया कोई OTP या पैसे न भेजें।"*

5. **🚨 Full-Screen Senior Alert Takeover**:
   - Brutalist high-visibility red emergency screen.
   - Exactly two massive touch targets: *"I'm okay (मैं सुरक्षित हूँ)"* or *"Call Family Now"*.

6. **✈ Silent Guardian Telegram Alerts**:
   - Instantly notifies trusted contacts with threat percentage, flagged scam phrases, and a direct link to the forensic incident report.

7. **📞 Interactive Scam Call Simulator & Voice Chat**:
   - Built-in simulation tool with realistic phone ringing, AI caller voice playback, and instant threat escalation for live testing and demonstrations.

---

## 📁 Repository Structure

```
├── sanket/                     # Web application (React 19 + Vite)
│   ├── src/
│   │   ├── components/         # AlertTakeover, RiskGauge, TranscriptStream, StateChip
│   │   ├── hooks/              # useAudioCapture (16kHz WAV), useTranscriptSession
│   │   ├── pages/              # Console, ElderIdle, History, IncidentReport, Settings
│   │   ├── services/           # sarvamASR, sarvamTTS, riskScoring, telegramNotify, db
│   │   └── data/               # riskTestSet (Hindi, Kannada, Tamil scenarios)
│   └── package.json
├── PRD.md                      # Product Requirements Document
├── TECHNICAL.md                # System Architecture & API Specifications
├── SKILLS.md                   # Operational Skills & Runbooks
├── frontend-design.md          # Design System, Typography & Contrast Rules
├── AGENTS.md                   # Agent Guidelines & Compliance
└── README.md                   # Documentation
```

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js 18+
- npm or pnpm

### 2. Installation

```bash
cd sanket
npm install
```

### 3. Environment Variables Configuration

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Set your credentials in `sanket/.env`:

```env
VITE_SARVAM_API_KEY=your_sarvam_api_key_here
VITE_TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
VITE_TELEGRAM_CHAT_ID=your_telegram_chat_id_here
VITE_N8N_WEBHOOK_URL=
VITE_DEMO_MODE=live
```

### 4. Running Locally

```bash
npm run dev
```

Open [http://localhost:5173/](http://localhost:5173/) to view the Guardian Console or [http://localhost:5173/elder](http://localhost:5173/elder) for the Elder Companion view.

### 5. Production Build

```bash
npm run build
npm run preview
```

---

## 🛡 Privacy & Security Principles
- **No Idle Audio Persistence**: Transcripts and audio from safe calls (<40% risk) are immediately discarded without writing to disk.
- **Incident Vault**: Only suspicious and high-risk sessions (≥40%) are persisted to local storage for guardian review.
- **Secrets Protection**: API keys and bot tokens are kept strictly in `.env` and excluded from version control.
