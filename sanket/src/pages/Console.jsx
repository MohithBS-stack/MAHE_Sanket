import { useState, useEffect, useRef, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import RiskGauge from '../components/RiskGauge.jsx'
import TranscriptStream from '../components/TranscriptStream.jsx'
import StateChip from '../components/StateChip.jsx'
import AlertTakeover from '../components/AlertTakeover.jsx'
import { useTranscriptSession } from '../hooks/useTranscriptSession.js'
import { useAudioCapture } from '../hooks/useAudioCapture.js'
import { getElderProfile } from '../services/db.js'
import { evaluateRisk } from '../services/riskScoring.js'
import { transcribeChunk } from '../services/sarvamASR.js'
import { playVernacularAlert, WARNING_TEXTS } from '../services/sarvamTTS.js'
import { sendTelegramAlert } from '../services/telegramNotify.js'
import { RISK_TEST_CASES } from '../data/riskTestSet.js'
import './Console.css'

export default function Console({ theme = 'dark', onToggleTheme }) {
  const navigate = useNavigate()
  const profile = getElderProfile()

  // State from our session hook
  const {
    sessionId,
    transcript,
    flaggedPhrases,
    status,
    languageDetected,
    startSession,
    addTranscriptLine,
    recordRiskScore,
    recordAction,
    endSession,
  } = useTranscriptSession()

  // Local UI states
  const [currentScore, setCurrentScore] = useState(0)
  const [currentReasoning, setCurrentReasoning] = useState('System idle. Ready to monitor call audio on speakerphone.')
  const [interimText, setInterimText] = useState(null)
  const [interventionLog, setInterventionLog] = useState([])
  const [showAlertTakeover, setShowAlertTakeover] = useState(false)
  const [isSimulating, setIsSimulating] = useState(false)
  const [selectedScenarioId, setSelectedScenarioId] = useState(RISK_TEST_CASES[0]?.id || '')
  const [customTestText, setCustomTestText] = useState('')
  const [incomingCall, setIncomingCall] = useState(null) // { caller, number, scenario }
  const [isTestPromptSending, setIsTestPromptSending] = useState(false)

  const canvasRef = useRef(null)
  const hasTriggeredAlertRef = useRef(false)
  const ringtoneCtxRef = useRef(null)
  const transcriptRef = useRef(transcript)

  useEffect(() => {
    transcriptRef.current = transcript
  }, [transcript])

  // Append entry to intervention log
  const logIntervention = useCallback((msg, type = 'info') => {
    const time = new Date().toLocaleTimeString('en-IN', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
    setInterventionLog(prev => [{ time, message: msg, type, id: `${Date.now()}-${Math.random()}` }, ...prev.slice(0, 24)])
  }, [])

  // Handle incoming live audio chunk from useAudioCapture
  const handleAudioChunk = useCallback(async (blob) => {
    if (!sessionId) return
    try {
      setInterimText('Analyzing speech audio with Sarvam Saaras…')
      const asrResult = await transcribeChunk(blob, profile.primary_language || 'auto')
      setInterimText(null)

      if (asrResult.text && asrResult.text.trim().length > 0) {
        addTranscriptLine(asrResult)

        // Evaluate risk over rolling transcript
        const currentTranscript = [...transcriptRef.current, { text: asrResult.text, language: asrResult.language_detected }]
        const evalResult = await evaluateRisk(sessionId, currentTranscript)

        setCurrentScore(evalResult.risk_score)
        setCurrentReasoning(evalResult.reasoning_trace)
        recordRiskScore(evalResult.risk_score, evalResult.flagged_phrases, 40, profile.sensitivity_threshold || 70)

        if (evalResult.flagged_phrases.length > 0) {
          logIntervention(`Phrases flagged: ${evalResult.flagged_phrases.join(', ')} (Score: ${evalResult.risk_score}%)`, 'warning')
        } else {
          logIntervention(`Transcribed: "${asrResult.text}" (Risk: ${evalResult.risk_score}%)`, 'info')
        }
      }
    } catch (err) {
      setInterimText(null)
      // Provide clear friendly notice without alarming the user
      logIntervention(`ASR Notice: ${err.message}`, 'error')
    }
  }, [sessionId, profile, addTranscriptLine, recordRiskScore, logIntervention])

  // Audio capture hook
  const { start: startMic, stop: stopMic, isListening, analyserNode, audioLevel, error: micError } = useAudioCapture({
    onChunk: handleAudioChunk,
    chunkMs: 3500,
  })

  // Start Call Monitoring
  const handleStartListening = () => {
    hasTriggeredAlertRef.current = false
    const id = startSession()
    logIntervention(`🎙 Speakerphone call protection activated for ${profile.name} (Session: ${id.slice(-6)})`, 'info')
    startMic()
  }

  // Stop Call Monitoring
  const handleStopListening = () => {
    stopMic()
    stopRingtone()
    setIncomingCall(null)
    const result = endSession(40)
    if (result) {
      if (result.persisted) {
        logIntervention(`Call ended. Peak risk ${result.session.peak_risk_score}% saved to Incident History.`, 'info')
      } else {
        logIntervention(`Call ended. Risk remained safe (<40%). Discarded without saving per privacy policy.`, 'info')
      }
    }
    setInterimText(null)
    setIsSimulating(false)
  }

  // Monitor danger threshold & trigger vernacular TTS + Telegram alerts
  useEffect(() => {
    const dangerThreshold = profile.sensitivity_threshold || 70
    if (currentScore >= dangerThreshold && !hasTriggeredAlertRef.current && status !== 'idle') {
      hasTriggeredAlertRef.current = true
      setShowAlertTakeover(true)

      const lang = languageDetected || profile.primary_language || 'hi'
      const warning = WARNING_TEXTS[lang] || WARNING_TEXTS.hi

      logIntervention(`🚨 DANGER THRESHOLD BREACHED (${currentScore}% >= ${dangerThreshold}%)!`, 'danger')
      logIntervention(`Dispatched Sarvam Bulbul voice warning in ${lang.toUpperCase()}`, 'danger')

      // 1. Spoken voice alert
      playVernacularAlert(warning.native, lang)

      // 2. Silent family notification
      const contact = profile.trusted_contacts?.[0]
      sendTelegramAlert({
        chat_id: contact?.telegram_chat_id,
        elder_name: profile.name,
        risk_score: currentScore,
        flagged_phrases: flaggedPhrases,
        session_id: sessionId,
      })
      logIntervention(`Family notification dispatched to ${contact?.name || 'Guardian'}`, 'info')
    }
  }, [currentScore, status, profile, languageDetected, flaggedPhrases, sessionId, logIntervention])

  // Synthesize Phone Ringtone
  const playRingtone = () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext
      const ctx = new AudioCtx()
      ringtoneCtxRef.current = ctx

      const osc1 = ctx.createOscillator()
      const osc2 = ctx.createOscillator()
      const gain = ctx.createGain()

      osc1.frequency.value = 440 // A4
      osc2.frequency.value = 480 // B4

      // Ring cadence (2s ring, 4s silence)
      gain.gain.setValueAtTime(0, ctx.currentTime)
      gain.gain.setValueAtTime(0.15, ctx.currentTime + 0.1)
      gain.gain.setValueAtTime(0.15, ctx.currentTime + 1.8)
      gain.gain.setValueAtTime(0, ctx.currentTime + 2.0)

      osc1.connect(gain)
      osc2.connect(gain)
      gain.connect(ctx.destination)

      osc1.start()
      osc2.start()

      // Repeat cadence
      const interval = setInterval(() => {
        if (!ringtoneCtxRef.current) {
          clearInterval(interval)
          return
        }
        gain.gain.setValueAtTime(0.15, ctx.currentTime + 0.1)
        gain.gain.setValueAtTime(0.15, ctx.currentTime + 1.8)
        gain.gain.setValueAtTime(0, ctx.currentTime + 2.0)
      }, 3500)
    } catch (e) {
      console.warn('Ringtone sound unavailable:', e)
    }
  }

  const stopRingtone = () => {
    if (ringtoneCtxRef.current) {
      try {
        ringtoneCtxRef.current.close()
      } catch {}
      ringtoneCtxRef.current = null
    }
  }

  // Trigger Incoming Scam Call Simulation
  const handleTriggerIncomingCall = () => {
    if (isListening || isSimulating || incomingCall) return
    const scenario = RISK_TEST_CASES.find(c => c.id === selectedScenarioId) || RISK_TEST_CASES[0]

    let callerName = 'Electricity Department Urgent Notice'
    let callerNumber = '+91 91234 56789'
    if (scenario.id.includes('bank') || scenario.id.includes('sbi')) {
      callerName = 'SBI Bank Card Operations'
      callerNumber = '+91 98112 40019'
    } else if (scenario.id.includes('police') || scenario.id.includes('cbi')) {
      callerName = 'TRAI Anti-Fraud Unit'
      callerNumber = '+91 11 2345 6789'
    }

    setIncomingCall({ caller: callerName, number: callerNumber, scenario })
    playRingtone()
    logIntervention(`📞 Incoming suspicious call received: "${callerName}" (${callerNumber})`, 'warning')
  }

  // Accept Incoming Call & Run Simulation
  const handleAcceptIncomingCall = async () => {
    stopRingtone()
    const activeScenario = incomingCall?.scenario || RISK_TEST_CASES[0]
    setIncomingCall(null)
    setIsSimulating(true)
    hasTriggeredAlertRef.current = false

    const activeSessionId = startSession()
    logIntervention(`Call answered. Sanket speakerphone monitor engaged for "${activeScenario.description}"`, 'info')

    for (let i = 0; i < activeScenario.lines.length; i++) {
      const lineObj = activeScenario.lines[i]
      setInterimText(`[Caller Speaking…] "${lineObj.text}"`)

      // Speak the scam line using browser speech or Sarvam TTS
      try {
        if ('speechSynthesis' in window) {
          const utterance = new SpeechSynthesisUtterance(lineObj.text)
          utterance.lang = activeScenario.language === 'kn' ? 'kn-IN' : activeScenario.language === 'ta' ? 'ta-IN' : 'hi-IN'
          utterance.rate = 1.05
          window.speechSynthesis.speak(utterance)
        }
      } catch {}

      await new Promise(r => setTimeout(r, 1600))

      const formattedLine = {
        text: lineObj.text,
        language_detected: activeScenario.language,
        timestamp: new Date().toISOString(),
        is_final: true,
      }
      addTranscriptLine(formattedLine)
      setInterimText(null)

      // Rolling evaluation
      const currentLines = activeScenario.lines.slice(0, i + 1)
      const evalResult = await evaluateRisk(activeSessionId, currentLines)

      setCurrentScore(evalResult.risk_score)
      setCurrentReasoning(evalResult.reasoning_trace)
      recordRiskScore(evalResult.risk_score, evalResult.flagged_phrases, 40, profile.sensitivity_threshold || 70)

      if (evalResult.risk_score >= 40) {
        logIntervention(`Risk elevated to ${evalResult.risk_score}% — Threat: ${evalResult.threat_level}`, evalResult.risk_score >= 70 ? 'danger' : 'warning')
      }

      await new Promise(r => setTimeout(r, 900))
    }

    setIsSimulating(false)
  }

  const handleDeclineIncomingCall = () => {
    stopRingtone()
    setIncomingCall(null)
    logIntervention('Call declined by user.', 'info')
  }

  // Quick Scam Test Prompt Injection (Voice Chat testing)
  const handleInjectTestPrompt = async (text, lang = 'hi') => {
    if (!text.trim() || isTestPromptSending) return
    setIsTestPromptSending(true)

    let activeSessionId = sessionId
    if (!activeSessionId) {
      activeSessionId = startSession()
      logIntervention(`Interactive test session created (${activeSessionId.slice(-6)})`, 'info')
    }

    const newLine = {
      text: text.trim(),
      language_detected: lang,
      timestamp: new Date().toISOString(),
      is_final: true,
    }
    addTranscriptLine(newLine)

    const updatedTranscript = [...transcriptRef.current, { text: text.trim(), language: lang }]
    const evalResult = await evaluateRisk(activeSessionId, updatedTranscript)

    setCurrentScore(evalResult.risk_score)
    setCurrentReasoning(evalResult.reasoning_trace)
    recordRiskScore(evalResult.risk_score, evalResult.flagged_phrases, 40, profile.sensitivity_threshold || 70)

    logIntervention(`Evaluated Phrase: "${text}" → Risk Score: ${evalResult.risk_score}%`, evalResult.risk_score >= 70 ? 'danger' : evalResult.risk_score >= 40 ? 'warning' : 'info')
    setCustomTestText('')
    setIsTestPromptSending(false)
  }

  // Waveform & Frequency Spectrum Canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let frameId

    const render = () => {
      const width = canvas.width
      const height = canvas.height
      ctx.clearRect(0, 0, width, height)

      if (isListening && analyserNode) {
        const bufferLength = analyserNode.frequencyBinCount
        const dataArray = new Uint8Array(bufferLength)
        analyserNode.getByteFrequencyData(dataArray)

        const barWidth = (width / bufferLength) * 2.2
        let x = 0

        const color = currentScore >= 70 ? '#ff3366' : currentScore >= 40 ? '#f59e0b' : '#00f2c3'
        const glow = currentScore >= 70 ? 'rgba(255, 51, 102, 0.4)' : currentScore >= 40 ? 'rgba(245, 158, 11, 0.4)' : 'rgba(0, 242, 195, 0.4)'

        for (let i = 0; i < bufferLength; i++) {
          const barHeight = (dataArray[i] / 255) * height * 0.9
          ctx.fillStyle = color
          ctx.shadowBlur = 8
          ctx.shadowColor = glow
          ctx.fillRect(x, height - barHeight, barWidth - 1, barHeight)
          x += barWidth
        }
      } else if (isSimulating) {
        // High-energy pulsing sine soundwave
        const color = currentScore >= 70 ? '#ff3366' : currentScore >= 40 ? '#f59e0b' : '#00f2c3'
        ctx.strokeStyle = color
        ctx.lineWidth = 2.5
        ctx.shadowBlur = 10
        ctx.shadowColor = color
        ctx.beginPath()

        const t = Date.now() / 150
        for (let x = 0; x < width; x += 2) {
          const y = height / 2 + Math.sin(x * 0.04 + t) * (height * 0.3) * Math.sin(t * 0.8)
          if (x === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.stroke()
      } else {
        // Subtle cyber baseline
        ctx.strokeStyle = 'rgba(228, 239, 239, 0.15)'
        ctx.lineWidth = 1.5
        ctx.shadowBlur = 0
        ctx.beginPath()
        ctx.moveTo(0, height / 2)
        ctx.lineTo(width, height / 2)
        ctx.stroke()
      }

      frameId = requestAnimationFrame(render)
    }

    render()
    return () => cancelAnimationFrame(frameId)
  }, [isListening, analyserNode, isSimulating, currentScore])

  // Dismiss takeover action handler
  const handleAlertDismiss = () => {
    setShowAlertTakeover(false)
    recordAction('dismissed_ok')
    logIntervention('Elder tapped "I\'m okay". Threat marked dismissed by user.', 'info')
    handleStopListening()
  }

  // Call contact action handler
  const handleAlertCallContact = () => {
    setShowAlertTakeover(false)
    recordAction('called_contact')
    const contact = profile.trusted_contacts?.[0]
    logIntervention(`Elder requested emergency contact: Calling ${contact?.name || 'Family'} (${contact?.phone || ''})`, 'danger')
    handleStopListening()
    if (sessionId) {
      navigate(`/report/${sessionId}`)
    }
  }

  const activeState = currentScore >= 70 ? 'danger' : currentScore >= 40 ? 'caution' : 'safe'

  return (
    <div className="console-page" data-theme={theme}>
      {/* Top Console Navigation Bar */}
      <header className="console-header glass-card">
        <div className="console-header__left">
          <div className="console-logo">
            <span className="console-logo__icon">🛡</span>
            <div className="console-logo__text">
              <span className="console-logo__brand font-display">Sanket</span>
              <span className="console-logo__vernacular font-script">संकेत</span>
            </div>
          </div>
          <StateChip state={activeState} label={status === 'idle' ? 'System Idle' : isListening ? 'Listening (Live Mic)' : isSimulating ? 'Call in Progress' : 'Watching'} />
          <div className="console-elder-tag chip text-xs font-ui">
            <span className="tag-dot" />
            <span>Protecting: <strong>{profile.name}</strong> ({profile.primary_language?.toUpperCase()})</span>
          </div>
        </div>

        <nav className="console-header__nav font-ui">
          <Link to="/elder" className="console-nav-link text-xs">👵 Elder View</Link>
          <Link to="/history" className="console-nav-link text-xs">📜 Incident Vault</Link>
          <Link to="/settings" className="console-nav-link text-xs">⚙ Settings</Link>
          <button
            onClick={onToggleTheme}
            className="console-theme-btn chip text-xs font-mono"
            title="Toggle Light/Dark Theme"
          >
            {theme === 'dark' ? '☀ Light' : '🌙 Dark'}
          </button>
        </nav>
      </header>

      {/* Microphone Error Warning Banner if access blocked */}
      {micError && (
        <div className="mic-error-banner chip font-ui text-xs">
          <span>⚠️ <strong>Microphone Permission Needed:</strong> {micError}. Please allow microphone in browser to enable speakerphone monitoring.</span>
        </div>
      )}

      {/* Simulated Incoming Phone Call Modal / Banner */}
      {incomingCall && (
        <div className="incoming-call-banner glass-card animate-slide-down">
          <div className="incoming-call-info">
            <div className="incoming-call-ring-icon">📞</div>
            <div>
              <div className="incoming-call-badge text-xs font-mono">🚨 SUSPICIOUS INCOMING CALL</div>
              <h3 className="incoming-call-caller font-display text-sm">{incomingCall.caller}</h3>
              <p className="incoming-call-num font-mono text-xs">{incomingCall.number}</p>
            </div>
          </div>
          <div className="incoming-call-actions">
            <button className="btn btn--primary btn--call-accept font-ui" onClick={handleAcceptIncomingCall}>
              <span>✓ Answer & Monitor</span>
            </button>
            <button className="btn btn--danger btn--call-decline font-ui" onClick={handleDeclineIncomingCall}>
              <span>✕ Decline</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Cockpit Grid */}
      <main className="console-grid">
        {/* LEFT COLUMN: Audio Radar & Live Transcript Intelligence */}
        <section className="console-column console-column--left glass-card">
          <div className="column-header">
            <div className="column-header__title-group">
              <span className="section-icon">📡</span>
              <h2 className="text-xs font-ui uppercase tracking-wide">Live Audio Intelligence</h2>
              <span className="language-badge text-xs font-mono">
                {languageDetected ? `Detected: ${languageDetected.toUpperCase()}` : 'Sarvam Saaras v3'}
              </span>
            </div>
            <div className="session-status-cluster font-mono text-xs">
              <span className="radar-pulse-dot" />
              <span>{sessionId ? `ID: ${sessionId.slice(-6)}` : 'Standby'}</span>
            </div>
          </div>

          {/* Real-time Waveform & VU Meter */}
          <div className="waveform-container">
            <canvas ref={canvasRef} width="600" height="52" className="waveform-canvas" />
            <div className="waveform-footer">
              <div className="vu-meter">
                <span className="vu-label font-mono text-xs">VU MIC</span>
                <div className="vu-bar-track">
                  <div
                    className="vu-bar-fill"
                    style={{
                      width: `${audioLevel}%`,
                      backgroundColor: audioLevel > 70 ? '#ff3366' : audioLevel > 40 ? '#f59e0b' : '#00f2c3'
                    }}
                  />
                </div>
                <span className="vu-val font-mono text-xs">{audioLevel}%</span>
              </div>
              <span className="waveform-label text-xs font-mono">
                {isListening ? '● 16kHz Studio Audio Active' : isSimulating ? '● Synthetic Threat Audio' : '○ Standby'}
              </span>
            </div>
          </div>

          {/* Live Transcript Stream */}
          <div className="transcript-box">
            <TranscriptStream
              lines={transcript}
              interimText={interimText}
              flaggedPhrases={flaggedPhrases}
            />
          </div>

          {/* Mic Controls & Call Simulators */}
          <div className="console-controls glass-card">
            <div className="console-controls__live">
              {!isListening ? (
                <button
                  className="btn btn--primary btn--listen-glow"
                  onClick={handleStartListening}
                  disabled={isSimulating}
                >
                  <span className="btn-icon">🎙</span> Start Mic Listening
                </button>
              ) : (
                <button className="btn btn--danger btn--stop-pulse" onClick={handleStopListening}>
                  <span className="btn-icon">⏹</span> Stop Listening
                </button>
              )}

              <button
                className="btn btn--secondary btn--call-sim"
                onClick={handleTriggerIncomingCall}
                disabled={isListening || isSimulating || incomingCall}
              >
                <span>📞 Simulate Scam Call</span>
              </button>
            </div>

            {/* Demo Scenario Selector */}
            <div className="console-controls__sim">
              <select
                className="select-scenario text-xs font-ui"
                value={selectedScenarioId}
                onChange={(e) => setSelectedScenarioId(e.target.value)}
                disabled={isListening || isSimulating}
              >
                {RISK_TEST_CASES.map((tc) => (
                  <option key={tc.id} value={tc.id}>
                    [{tc.language.toUpperCase()}] {tc.description}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Quick Voice / Text Threat Testing Bar */}
          <div className="quick-test-bar chip">
            <div className="quick-test-label text-xs font-mono">
              <span>⚡ QUICK SCAM PROMPTS:</span>
            </div>
            <div className="quick-test-chips">
              <button
                className="test-prompt-chip font-ui text-xs"
                onClick={() => handleInjectTestPrompt('आपका बिजली का बिल बकाया है, आज रात 9 बजे बिजली काट दी जाएगी।')}
                disabled={isSimulating}
              >
                ⚡ "बिजली काट दी जाएगी"
              </button>
              <button
                className="test-prompt-chip font-ui text-xs"
                onClick={() => handleInjectTestPrompt('SBI Bank alert: Your account is blocked. Share OTP immediately to restore.')}
                disabled={isSimulating}
              >
                🏦 "SBI Account Blocked - OTP"
              </button>
              <button
                className="test-prompt-chip font-ui text-xs"
                onClick={() => handleInjectTestPrompt('Police CBI Digital Arrest: Transfer money to RBI safety account now.')}
                disabled={isSimulating}
              >
                👮 "CBI Digital Arrest Transfer"
              </button>
              <button
                className="test-prompt-chip font-ui text-xs"
                onClick={() => handleInjectTestPrompt('Install AnyDesk APK link right now to fix banking error.')}
                disabled={isSimulating}
              >
                💻 "Install AnyDesk APK"
              </button>
            </div>

            <form
              className="custom-test-form"
              onSubmit={(e) => {
                e.preventDefault()
                handleInjectTestPrompt(customTestText, profile.primary_language || 'hi')
              }}
            >
              <input
                type="text"
                className="custom-test-input font-ui text-xs"
                placeholder="Or type/paste any suspect sentence to evaluate threat..."
                value={customTestText}
                onChange={(e) => setCustomTestText(e.target.value)}
                disabled={isSimulating}
              />
              <button
                type="submit"
                className="btn btn--secondary btn-xs font-ui"
                disabled={!customTestText.trim() || isTestPromptSending}
              >
                Test Phrase →
              </button>
            </form>
          </div>
        </section>

        {/* RIGHT COLUMN: Threat Assessment & Intervention Engine */}
        <section className="console-column console-column--right glass-card">
          <div className="column-header">
            <div className="column-header__title-group">
              <span className="section-icon">🧠</span>
              <h2 className="text-xs font-ui uppercase tracking-wide">Threat Assessment Engine</h2>
            </div>
            <span className="threshold-pill text-xs font-mono">
              Danger ≥ {profile.sensitivity_threshold || 70}%
            </span>
          </div>

          {/* Radial Risk Gauge */}
          <div className="gauge-wrapper">
            <RiskGauge
              score={currentScore}
              label={currentScore >= 70 ? 'CRITICAL DANGER' : currentScore >= 40 ? 'SUSPECT CALL' : 'NORMAL / SAFE'}
              animated={true}
            />
          </div>

          {/* Flagged Red-Flag Phrases */}
          <div className="flagged-section">
            <h3 className="section-subtitle text-xs font-ui">Flagged Threat Signatures</h3>
            {flaggedPhrases.length === 0 ? (
              <p className="no-flags-text text-xs font-ui">No suspicious phrases detected in live call.</p>
            ) : (
              <div className="phrase-chips-container">
                {flaggedPhrases.map((phrase, idx) => (
                  <span key={idx} className="phrase-chip font-ui text-xs">
                    ⚠ {phrase}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* AI Multi-Step Reasoning Trace */}
          <div className="reasoning-box chip">
            <div className="reasoning-header">
              <span className="reasoning-label text-xs font-mono">AI Reasoning Trace</span>
              <span className="reasoning-model text-xs font-mono">Sanket Rule + LLM</span>
            </div>
            <p className="reasoning-text text-xs font-ui">{currentReasoning}</p>
          </div>

          {/* Quick Manual Emergency Triggers for Testing */}
          <div className="manual-triggers chip">
            <span className="text-xs font-mono text-muted uppercase">Guardian Quick Interventions</span>
            <div className="manual-trigger-buttons">
              <button
                className="btn btn--secondary btn-xs font-ui"
                onClick={() => {
                  const lang = languageDetected || profile.primary_language || 'hi'
                  playVernacularAlert(WARNING_TEXTS[lang]?.native, lang)
                  logIntervention(`Manual Vernacular TTS alert triggered in ${lang.toUpperCase()}`, 'info')
                }}
              >
                🔊 Play Spoken Warning
              </button>
              <button
                className="btn btn--secondary btn-xs font-ui"
                onClick={async () => {
                  const contact = profile.trusted_contacts?.[0]
                  const res = await sendTelegramAlert({
                    chat_id: contact?.telegram_chat_id,
                    elder_name: profile.name,
                    risk_score: currentScore || 85,
                    flagged_phrases: flaggedPhrases.length > 0 ? flaggedPhrases : ['Sample Emergency Alert Test'],
                    session_id: sessionId || 'test-session',
                  })
                  logIntervention(`Telegram test alert: ${res.message}`, res.success ? 'info' : 'error')
                }}
              >
                ✈ Test Telegram Bot
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* BOTTOM: Real-Time Intervention Log */}
      <section className="intervention-log glass-card">
        <div className="intervention-log__header">
          <div className="log-title-wrap">
            <span className="log-icon">📋</span>
            <h2 className="text-xs font-ui uppercase tracking-wider">Real-Time Intervention Audit Trail</h2>
          </div>
          <span className="log-count text-xs font-mono">{interventionLog.length} events logged</span>
        </div>
        <div className="intervention-log__list scroll-area">
          {interventionLog.length === 0 ? (
            <p className="empty-log text-xs font-ui">Awaiting speech audio or simulated calls...</p>
          ) : (
            interventionLog.map((item) => (
              <div key={item.id} className={`log-entry log-entry--${item.type}`}>
                <span className="log-time font-mono text-xs">{item.time}</span>
                <span className="log-dot-indicator" />
                <span className="log-msg font-ui text-xs">{item.message}</span>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Full-Screen Elder Alert Takeover (Triggered when Danger >= 70%) */}
      <AlertTakeover
        visible={showAlertTakeover}
        warningNative={WARNING_TEXTS[languageDetected || 'hi']?.native}
        warningEnglish={WARNING_TEXTS[languageDetected || 'hi']?.english}
        contactName={profile.trusted_contacts?.[0]?.name || 'Family Contact'}
        language={languageDetected || 'hi'}
        onDismiss={handleAlertDismiss}
        onCallContact={handleAlertCallContact}
      />
    </div>
  )
}
