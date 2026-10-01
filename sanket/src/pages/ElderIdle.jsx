import { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import AlertTakeover from '../components/AlertTakeover.jsx'
import { getElderProfile, saveElderProfile } from '../services/db.js'
import { useTranscriptSession } from '../hooks/useTranscriptSession.js'
import { useAudioCapture } from '../hooks/useAudioCapture.js'
import { transcribeChunk } from '../services/sarvamASR.js'
import { evaluateRisk } from '../services/riskScoring.js'
import { playVernacularAlert, WARNING_TEXTS } from '../services/sarvamTTS.js'
import { sendTelegramAlert } from '../services/telegramNotify.js'
import { RISK_TEST_CASES } from '../data/riskTestSet.js'
import './ElderIdle.css'

const GREETINGS = {
  hi: 'नमस्ते',
  kn: 'ನಮಸ್ಕಾರ',
  ta: 'வணக்கம்',
  en: 'Hello',
}

const ACTIVE_STATUS_TEXT = {
  hi: { main: 'संकेत कॉल सुन रहा है — आप सुरक्षित हैं', sub: 'Sanket is actively protecting your call' },
  kn: { main: 'ಸಂಕೇತ್ ಕರೆಯನ್ನು ಆಲಿಸುತ್ತಿದೆ — ನೀವು ಸುರಕ್ಷಿತರಾಗಿದ್ದೀರಿ', sub: 'Sanket is actively protecting your call' },
  ta: { main: 'சங்கேத் அழைப்பைக் கேட்கிறது — நீங்கள் பாதுகாப்பாக இருக்கிறீர்கள்', sub: 'Sanket is actively protecting your call' },
  en: { main: 'Sanket is actively listening — You are safe', sub: 'Speakerphone protection active' },
}

const IDLE_STATUS_TEXT = {
  hi: { main: 'संकेत सुरक्षा के लिए तैयार है', sub: 'कॉल पर बात करते समय नीचे दिए बटन को दबाएं' },
  kn: { main: 'ಸಂಕೇತ್ ಸಿದ್ಧವಾಗಿದೆ', sub: 'ಕರೆಯ ಸಮಯದಲ್ಲಿ ಕೆಳಗಿನ ಬಟನ್ ಒತ್ತಿರಿ' },
  ta: { main: 'சங்கேத் தயாராக உள்ளது', sub: 'அழைப்பின் போது கீழே உள்ள பொத்தானை அழுத்தவும்' },
  en: { main: 'Sanket is ready to protect', sub: 'Place your call on speaker and tap below to start' },
}

export default function ElderIdle() {
  const [profile, setProfile] = useState(getElderProfile())
  const theme = profile.theme_preference || 'light'

  const {
    sessionId,
    transcript,
    startSession,
    addTranscriptLine,
    recordRiskScore,
    recordAction,
    endSession,
  } = useTranscriptSession()

  const [isAlertVisible, setIsAlertVisible] = useState(false)
  const [currentScore, setCurrentScore] = useState(0)
  const [activeLang, setActiveLang] = useState(profile.primary_language || 'hi')
  const [isSimulating, setIsSimulating] = useState(false)
  const [callRohanNotice, setCallRohanNotice] = useState(false)
  const hasTriggeredRef = useRef(false)
  const transcriptRef = useRef(transcript)

  useEffect(() => {
    transcriptRef.current = transcript
  }, [transcript])

  // Handle incoming live audio chunk
  const handleAudioChunk = useCallback(async (blob) => {
    if (!sessionId) return
    try {
      const asr = await transcribeChunk(blob, activeLang || 'auto')
      if (asr.text && asr.text.trim()) {
        addTranscriptLine(asr)
        const currentWindow = [...transcriptRef.current, { text: asr.text, language: asr.language_detected }]
        const evalResult = await evaluateRisk(sessionId, currentWindow)
        setCurrentScore(evalResult.risk_score)
        recordRiskScore(evalResult.risk_score, evalResult.flagged_phrases, 40, profile.sensitivity_threshold || 70)
      }
    } catch (err) {
      console.warn('[ElderIdle] ASR Notice:', err.message)
    }
  }, [sessionId, activeLang, profile, addTranscriptLine, recordRiskScore])

  const { start: startMic, stop: stopMic, isListening, audioLevel } = useAudioCapture({
    onChunk: handleAudioChunk,
    chunkMs: 3500,
  })

  // Start / Stop listening toggle
  const handleToggleListening = () => {
    if (isListening) {
      stopMic()
      endSession(40)
    } else {
      hasTriggeredRef.current = false
      startSession()
      startMic()
    }
  }

  // Trigger alert takeover on threshold breach
  useEffect(() => {
    const dangerThreshold = profile.sensitivity_threshold || 70
    if (currentScore >= dangerThreshold && !hasTriggeredRef.current) {
      hasTriggeredRef.current = true
      setIsAlertVisible(true)

      const lang = activeLang || profile.primary_language || 'hi'
      const warning = WARNING_TEXTS[lang] || WARNING_TEXTS.hi

      // Spoken vernacular warning
      playVernacularAlert(warning.native, lang)

      // Silent Telegram family alert
      sendTelegramAlert({
        chat_id: profile.trusted_contacts?.[0]?.telegram_chat_id,
        elder_name: profile.name,
        risk_score: currentScore,
        flagged_phrases: [],
        session_id: sessionId,
      })
    }
  }, [currentScore, profile, activeLang, sessionId])

  // Language switch
  const handleLanguageChange = (newLang) => {
    setActiveLang(newLang)
    const updated = { ...profile, primary_language: newLang }
    setProfile(updated)
    saveElderProfile(updated)
  }

  // Demo simulation trigger
  const handleTriggerDemoScam = async () => {
    if (isSimulating) return
    setIsSimulating(true)
    hasTriggeredRef.current = false

    const scenario = RISK_TEST_CASES[0] // SBI KYC OTP
    const activeId = startSession()
    setActiveLang(scenario.language)

    for (let i = 0; i < scenario.lines.length; i++) {
      await new Promise(r => setTimeout(r, 1400))
      const line = scenario.lines[i]
      addTranscriptLine({ text: line.text, language_detected: scenario.language, is_final: true })

      const evalRes = await evaluateRisk(activeId, scenario.lines.slice(0, i + 1))
      setCurrentScore(evalRes.risk_score)
      recordRiskScore(evalRes.risk_score, evalRes.flagged_phrases, 40, profile.sensitivity_threshold || 70)
    }

    setIsSimulating(false)
  }

  const handleDismiss = () => {
    setIsAlertVisible(false)
    recordAction('dismissed_ok')
    if (isListening) stopMic()
    endSession(40)
    setCurrentScore(0)
  }

  const handleCallContact = () => {
    setIsAlertVisible(false)
    recordAction('called_contact')
    if (isListening) stopMic()
    endSession(40)
    setCurrentScore(0)
    setCallRohanNotice(true)
    setTimeout(() => setCallRohanNotice(false), 5000)
  }

  const greeting = GREETINGS[activeLang] || GREETINGS.hi
  const statusContent = isListening || isSimulating
    ? (ACTIVE_STATUS_TEXT[activeLang] || ACTIVE_STATUS_TEXT.hi)
    : (IDLE_STATUS_TEXT[activeLang] || IDLE_STATUS_TEXT.hi)

  return (
    <div className="elder-idle-page" data-theme={theme} data-surface="calm">
      {/* Top Header */}
      <header className="elder-header">
        <div className="elder-brand font-display">
          <span>🛡 Sanket</span>
          <span className="elder-brand-vernacular font-script">संकेत</span>
        </div>

        {/* Vernacular Language Switcher */}
        <div className="elder-lang-pills">
          {[
            { id: 'hi', label: 'हिंदी' },
            { id: 'kn', label: 'ಕನ್ನಡ' },
            { id: 'ta', label: 'தமிழ்' },
            { id: 'en', label: 'English' },
          ].map(l => (
            <button
              key={l.id}
              className={`lang-pill ${activeLang === l.id ? 'lang-pill--active' : ''}`}
              onClick={() => handleLanguageChange(l.id)}
            >
              {l.label}
            </button>
          ))}
        </div>

        <Link to="/console" className="guardian-mode-link font-ui">
          Guardian Console →
        </Link>
      </header>

      {/* Main Content */}
      <main className="elder-content">
        <div className="elder-status-card">
          {/* Reassuring Aura Pulse */}
          <div className={`elder-pulse-ring ${isListening || isSimulating ? 'elder-pulse-ring--active' : ''}`}>
            <div className="elder-inner-aura" style={{ transform: `scale(${1 + (audioLevel / 100) * 0.35})` }}>
              <span className="elder-status-dot" />
            </div>
          </div>

          <h1 className="elder-greeting font-script">
            {greeting}, {profile.name}
          </h1>

          <p className="elder-state-text font-script">
            {statusContent.main}
          </p>

          <p className="elder-sub-text font-ui">
            {statusContent.sub}
          </p>

          {/* Primary Action Button */}
          <button
            className={`elder-action-btn font-ui ${isListening ? 'elder-action-btn--stop' : 'elder-action-btn--start'}`}
            onClick={handleToggleListening}
            disabled={isSimulating}
          >
            <span className="elder-btn-icon">{isListening ? '⏹' : '🎙'}</span>
            <span>
              {isListening
                ? (activeLang === 'kn' ? 'ರಕ್ಷಣೆ ನಿಲ್ಲಿಸಿ / Stop' : activeLang === 'ta' ? 'பாதுகாப்பை நிறுத்து / Stop' : 'सुरक्षा रोकें / Stop Protection')
                : (activeLang === 'kn' ? 'ರಕ್ಷಣೆ ಪ್ರಾರಂಭಿಸಿ / Start' : activeLang === 'ta' ? 'பாதுகாப்பைத் தொடங்கு / Start' : 'सुरक्षा शुरू करें / Start Protection')}
            </span>
          </button>

          {/* Direct Family Emergency Connect */}
          <div className="elder-secondary-actions">
            <button
              className="elder-contact-btn font-ui"
              onClick={handleCallContact}
            >
              📞 {activeLang === 'kn' ? 'ರೋಹನ್‌ಗೆ ಕರೆ ಮಾಡಿ' : activeLang === 'ta' ? 'ரோஹனை அழைக்கவும்' : 'रोहन को कॉल करें'} / Call {profile.trusted_contacts?.[0]?.name || 'Family'}
            </button>

            {callRohanNotice && (
              <div className="elder-call-notice font-ui animate-fade-in">
                Dialing {profile.trusted_contacts?.[0]?.name} ({profile.trusted_contacts?.[0]?.phone})...
              </div>
            )}
          </div>

          {/* Demo Scam Test Trigger */}
          <div className="elder-demo-trigger">
            <button
              className="elder-sim-btn font-ui"
              onClick={handleTriggerDemoScam}
              disabled={isListening || isSimulating}
            >
              {isSimulating ? '⚡ Scam Threat Simulation in Progress…' : '⚡ Test Scam Call Alert (Demo)'}
            </button>
          </div>
        </div>
      </main>

      {/* Full-Screen Alert Takeover */}
      <AlertTakeover
        visible={isAlertVisible}
        warningNative={WARNING_TEXTS[activeLang]?.native}
        warningEnglish={WARNING_TEXTS[activeLang]?.english}
        contactName={profile.trusted_contacts?.[0]?.name || 'Family Contact'}
        language={activeLang}
        onDismiss={handleDismiss}
        onCallContact={handleCallContact}
      />
    </div>
  )
}
