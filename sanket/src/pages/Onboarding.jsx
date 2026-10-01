import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getElderProfile, saveElderProfile } from '../services/db.js'
import './Onboarding.css'

export default function Onboarding() {
  const navigate = useNavigate()
  const currentProfile = getElderProfile()

  const [step, setStep] = useState(1)
  const [name, setName] = useState(currentProfile.name || '')
  const [primaryLang, setPrimaryLang] = useState(currentProfile.primary_language || 'hi')
  const [elderTheme, setElderTheme] = useState(currentProfile.theme_preference || 'light')

  const [contactName, setContactName] = useState(currentProfile.trusted_contacts?.[0]?.name || '')
  const [contactPhone, setContactPhone] = useState(currentProfile.trusted_contacts?.[0]?.phone || '')
  const [telegramChatId, setTelegramChatId] = useState(currentProfile.trusted_contacts?.[0]?.telegram_chat_id || '')

  const [sensitivityThreshold, setSensitivityThreshold] = useState(currentProfile.sensitivity_threshold || 70)
  const [micTested, setMicTested] = useState(false)
  const [micError, setMicError] = useState(null)

  const handleTestMic = async () => {
    try {
      setMicError(null)
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      setMicTested(true)
      stream.getTracks().forEach((t) => t.stop())
    } catch (err) {
      setMicError(err.message || 'Microphone permission denied')
      setMicTested(false)
    }
  }

  const handleFinish = () => {
    const updatedProfile = {
      ...currentProfile,
      name: name.trim() || 'Elder',
      primary_language: primaryLang,
      theme_preference: elderTheme,
      sensitivity_threshold: Number(sensitivityThreshold),
      trusted_contacts: [
        {
          name: contactName.trim() || 'Family Member',
          phone: contactPhone.trim(),
          telegram_chat_id: telegramChatId.trim(),
        },
      ],
    }

    saveElderProfile(updatedProfile)
    navigate('/console')
  }

  return (
    <div className="onboarding-page">
      <div className="onboarding-card glass-card">
        {/* Brand Header */}
        <div className="onboarding-brand">
          <span className="brand-logo font-display">Sanket</span>
          <span className="brand-vernacular font-script">संकेत</span>
          <p className="brand-tagline text-xs font-ui">
            Real-time, vernacular scam-call interruption
          </p>
        </div>

        {/* Step Indicator */}
        <div className="onboarding-steps font-mono text-xs">
          <span className={`step-dot ${step >= 1 ? 'step-dot--active' : ''}`}>1. Elder Profile</span>
          <span className="step-sep">→</span>
          <span className={`step-dot ${step >= 2 ? 'step-dot--active' : ''}`}>2. Family Contact</span>
          <span className="step-sep">→</span>
          <span className={`step-dot ${step >= 3 ? 'step-dot--active' : ''}`}>3. Protection</span>
        </div>

        {/* STEP 1: Elder Profile */}
        {step === 1 && (
          <div className="onboarding-step-content">
            <h2 className="step-title font-display">Who are we protecting?</h2>
            <p className="step-desc text-sm font-ui">
              Set up the profile for the elder family member whose calls Sanket will monitor.
            </p>

            <div className="form-group">
              <label className="text-xs font-ui">Elder's Name</label>
              <input
                type="text"
                className="input-field font-ui text-sm"
                placeholder="e.g. Shanti Devi / Dadiji"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="text-xs font-ui">Primary Language Spoken on Calls</label>
              <select
                className="input-field font-ui text-sm"
                value={primaryLang}
                onChange={(e) => setPrimaryLang(e.target.value)}
              >
                <option value="hi">Hindi (हिंदी)</option>
                <option value="kn">Kannada (ಕನ್ನಡ)</option>
                <option value="ta">Tamil (தமிழ்)</option>
                <option value="en">English</option>
              </select>
              <span className="field-hint text-xs font-ui">
                Sanket uses Sarvam AI to understand regional and code-mixed speech.
              </span>
            </div>

            <div className="form-group">
              <label className="text-xs font-ui">Elder Screen Theme Preference</label>
              <select
                className="input-field font-ui text-sm"
                value={elderTheme}
                onChange={(e) => setElderTheme(e.target.value)}
              >
                <option value="light">Light Mode (Recommended for senior readability)</option>
                <option value="dark">Dark Mode</option>
              </select>
            </div>

            <button
              className="btn btn--primary btn-full font-ui"
              onClick={() => setStep(2)}
              disabled={!name.trim()}
            >
              Continue to Family Contact →
            </button>
          </div>
        )}

        {/* STEP 2: Trusted Contacts */}
        {step === 2 && (
          <div className="onboarding-step-content">
            <h2 className="step-title font-display">Trusted Family Guardian</h2>
            <p className="step-desc text-sm font-ui">
              If an active scam call is detected, Sanket will silently notify this guardian.
            </p>

            <div className="form-group">
              <label className="text-xs font-ui">Guardian Name</label>
              <input
                type="text"
                className="input-field font-ui text-sm"
                placeholder="e.g. Rohan (Son)"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="text-xs font-ui">Phone Number (shown on elder's alert screen)</label>
              <input
                type="tel"
                className="input-field font-ui text-sm font-mono"
                placeholder="+91 98765 43210"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="text-xs font-ui">Telegram Chat ID (optional for silent bot alert)</label>
              <input
                type="text"
                className="input-field font-ui text-sm font-mono"
                placeholder="e.g. 123456789 (leave blank for local demo)"
                value={telegramChatId}
                onChange={(e) => setTelegramChatId(e.target.value)}
              />
            </div>

            <div className="btn-row">
              <button className="btn btn--secondary font-ui" onClick={() => setStep(1)}>
                ← Back
              </button>
              <button
                className="btn btn--primary font-ui"
                onClick={() => setStep(3)}
                disabled={!contactName.trim()}
              >
                Continue to Audio Check →
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Sensitivity & Mic Check */}
        {step === 3 && (
          <div className="onboarding-step-content">
            <h2 className="step-title font-display">Protection & Audio Check</h2>
            <p className="step-desc text-sm font-ui">
              Verify microphone permission for speakerphone listening and calibrate sensitivity.
            </p>

            <div className="form-group">
              <div className="label-row">
                <label className="text-xs font-ui">Danger Alert Threshold: {sensitivityThreshold}%</label>
                <span className="text-xs font-mono text-muted">Default: 70%</span>
              </div>
              <input
                type="range"
                min="50"
                max="90"
                step="5"
                value={sensitivityThreshold}
                onChange={(e) => setSensitivityThreshold(e.target.value)}
                className="range-slider"
              />
              <span className="field-hint text-xs font-ui">
                When AI evaluates scam threat ≥ {sensitivityThreshold}%, the elder's full-screen warning and spoken alert fire immediately.
              </span>
            </div>

            <div className="mic-check-box chip">
              <div className="mic-status-row">
                <span className="mic-icon">{micTested ? '🟢' : '🎙'}</span>
                <div>
                  <h4 className="mic-title text-sm font-ui">Speakerphone Audio Permission</h4>
                  <p className="mic-sub text-xs font-ui">
                    {micTested ? 'Microphone access verified and ready!' : 'Ensure the browser can listen when calls are placed on speaker.'}
                  </p>
                </div>
              </div>

              {!micTested ? (
                <button className="btn btn--secondary btn-sm font-ui" onClick={handleTestMic}>
                  Grant & Test Mic Access
                </button>
              ) : (
                <span className="text-xs font-mono text-teal">✓ Audio input granted</span>
              )}

              {micError && <p className="error-msg text-xs font-ui">{micError}</p>}
            </div>

            <div className="btn-row">
              <button className="btn btn--secondary font-ui" onClick={() => setStep(2)}>
                ← Back
              </button>
              <button className="btn btn--primary font-ui" onClick={handleFinish}>
                Complete Setup & Launch Console →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
