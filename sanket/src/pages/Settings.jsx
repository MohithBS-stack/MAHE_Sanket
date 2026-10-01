import { useState } from 'react'
import { Link } from 'react-router-dom'
import { getElderProfile, saveElderProfile, getSessions, clearAllSessions } from '../services/db.js'
import { sendTelegramAlert } from '../services/telegramNotify.js'
import { playVernacularAlert, WARNING_TEXTS } from '../services/sarvamTTS.js'
import './Settings.css'

export default function Settings({ theme = 'dark', onToggleTheme }) {
  const [profile, setProfile] = useState(() => getElderProfile())
  const [sessionsCount, setSessionsCount] = useState(() => getSessions().length)
  const [savedSuccess, setSavedSuccess] = useState(false)
  const [testAlertStatus, setTestAlertStatus] = useState(null)
  const [audioTesting, setAudioTesting] = useState(false)

  const handleProfileChange = (field, value) => {
    setProfile(prev => ({ ...prev, [field]: value }))
  }

  const handleContactChange = (field, value) => {
    setProfile(prev => {
      const contacts = [...(prev.trusted_contacts || [])]
      contacts[0] = { ...contacts[0], [field]: value }
      return { ...prev, trusted_contacts: contacts }
    })
  }

  const handleSave = (e) => {
    e?.preventDefault()
    saveElderProfile(profile)
    setSavedSuccess(true)
    setTimeout(() => setSavedSuccess(false), 2500)
  }

  const handleTestTelegramAlert = async () => {
    const contact = profile.trusted_contacts?.[0]
    const targetChatId = contact?.telegram_chat_id || import.meta.env.VITE_TELEGRAM_CHAT_ID
    setTestAlertStatus('Sending test alert to Telegram…')
    const res = await sendTelegramAlert({
      chat_id: targetChatId,
      elder_name: profile.name,
      risk_score: profile.sensitivity_threshold || 70,
      flagged_phrases: ['Test KYC Urgent Alert', 'OTP verification test'],
      session_id: 'test-session',
    })
    setTestAlertStatus(res.message)
    setTimeout(() => setTestAlertStatus(null), 5000)
  }

  const handleTestAudioVoice = async () => {
    setAudioTesting(true)
    const lang = profile.primary_language || 'hi'
    const warning = WARNING_TEXTS[lang] || WARNING_TEXTS.hi
    await playVernacularAlert(warning.native, lang)
    setAudioTesting(false)
  }

  const handleClearHistory = () => {
    if (window.confirm('Clear all stored incident history? This cannot be undone.')) {
      clearAllSessions()
      setSessionsCount(0)
    }
  }

  return (
    <div className="settings-page">
      {/* Top Header */}
      <header className="settings-header glass-card">
        <div className="settings-header__left">
          <Link to="/console" className="back-link text-sm font-ui">
            ← Back to Console
          </Link>
          <h1 className="settings-title font-display">System & Protection Settings</h1>
        </div>
        <div>
          <button className="btn btn--primary font-ui text-sm" onClick={handleSave}>
            {savedSuccess ? '✓ Saved Changes' : 'Save Settings'}
          </button>
        </div>
      </header>

      {/* Main Settings Form Grid */}
      <main className="settings-grid">
        {/* Section 1: Elder Profile */}
        <section className="settings-card glass-card">
          <h2 className="section-title text-sm font-ui uppercase tracking-wide">Elder Profile</h2>
          <div className="form-group">
            <label className="text-xs font-ui">Elder's Full Name</label>
            <input
              type="text"
              className="input-field font-ui text-sm"
              value={profile.name}
              onChange={(e) => handleProfileChange('name', e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="text-xs font-ui">Primary Vernacular Language</label>
            <select
              className="input-field font-ui text-sm"
              value={profile.primary_language}
              onChange={(e) => handleProfileChange('primary_language', e.target.value)}
            >
              <option value="hi">Hindi (हिंदी)</option>
              <option value="kn">Kannada (ಕನ್ನಡ)</option>
              <option value="ta">Tamil (தமிழ்)</option>
              <option value="en">English</option>
            </select>
            <span className="field-hint text-xs font-ui">
              Determines Sarvam ASR transcription language and Bulbul TTS voice dialect.
            </span>
          </div>

          <div className="form-group">
            <label className="text-xs font-ui">Elder Device Screen Theme</label>
            <select
              className="input-field font-ui text-sm"
              value={profile.theme_preference}
              onChange={(e) => handleProfileChange('theme_preference', e.target.value)}
            >
              <option value="light">Light Mode (Optimal for senior readability)</option>
              <option value="dark">Dark Mode</option>
            </select>
          </div>
        </section>

        {/* Section 2: Threat Detection Sensitivity */}
        <section className="settings-card glass-card">
          <div className="section-header-row">
            <h2 className="section-title text-sm font-ui uppercase tracking-wide">Threat Sensitivity Tuning</h2>
            <span className="threshold-indicator font-mono text-xs text-danger">
              Danger: {profile.sensitivity_threshold || 70}%
            </span>
          </div>

          <div className="form-group">
            <div className="label-row">
              <label className="text-xs font-ui">Intervention Threshold (Danger Trigger)</label>
              <span className="text-xs font-mono">{profile.sensitivity_threshold || 70}%</span>
            </div>
            <input
              type="range"
              min="50"
              max="90"
              step="5"
              value={profile.sensitivity_threshold || 70}
              onChange={(e) => handleProfileChange('sensitivity_threshold', Number(e.target.value))}
              className="range-slider"
            />
            <span className="field-hint text-xs font-ui">
              When risk score reaches this level, the full-screen Alert Takeover and Sarvam voice warning trigger simultaneously.
            </span>
          </div>

          <div className="form-group">
            <label className="text-xs font-ui">Test Vernacular Voice Alert</label>
            <button
              className="btn btn--secondary text-xs font-ui"
              onClick={handleTestAudioVoice}
              disabled={audioTesting}
            >
              {audioTesting ? 'Playing spoken warning…' : `🔊 Speak Warning in ${(profile.primary_language || 'hi').toUpperCase()}`}
            </button>
          </div>
        </section>

        {/* Section 3: Guardian & Family Contact */}
        <section className="settings-card glass-card">
          <h2 className="section-title text-sm font-ui uppercase tracking-wide">Trusted Guardian Contact</h2>
          <div className="form-group">
            <label className="text-xs font-ui">Guardian Name</label>
            <input
              type="text"
              className="input-field font-ui text-sm"
              value={profile.trusted_contacts?.[0]?.name || ''}
              onChange={(e) => handleContactChange('name', e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="text-xs font-ui">Phone Number (Called when elder taps button)</label>
            <input
              type="tel"
              className="input-field font-ui text-sm font-mono"
              value={profile.trusted_contacts?.[0]?.phone || ''}
              onChange={(e) => handleContactChange('phone', e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="text-xs font-ui">Telegram Chat ID (Silent Alerts)</label>
            <input
              type="text"
              className="input-field font-ui text-sm font-mono"
              placeholder="e.g. 123456789"
              value={profile.trusted_contacts?.[0]?.telegram_chat_id || ''}
              onChange={(e) => handleContactChange('telegram_chat_id', e.target.value)}
            />
            <div className="telegram-action-row">
              <button
                type="button"
                className="btn btn--secondary btn-sm text-xs font-ui"
                onClick={handleTestTelegramAlert}
              >
                Send Test Alert
              </button>
              {testAlertStatus && (
                <span className="text-xs font-ui text-secondary">{testAlertStatus}</span>
              )}
            </div>
          </div>
        </section>

        {/* Section 4: Privacy & Data Retention */}
        <section className="settings-card glass-card">
          <h2 className="section-title text-sm font-ui uppercase tracking-wide">Privacy & Data Management</h2>
          <p className="privacy-info text-xs font-ui">
            Per PRD §10, Sanket never persists safe call audio or transcripts. Only incidents with Caution (≥40%) or Danger (≥70%) scores are retained locally.
          </p>

          <div className="storage-stat-box chip">
            <span className="text-xs font-ui">Currently Retained Incident Reports:</span>
            <span className="font-mono text-xs font-bold">{sessionsCount} records</span>
          </div>

          <div className="data-actions">
            <button
              className="btn btn-clear-history text-xs font-ui"
              onClick={handleClearHistory}
              disabled={sessionsCount === 0}
            >
              Clear All Stored Incident Data
            </button>
          </div>

          <div className="form-group console-theme-setting">
            <label className="text-xs font-ui">Guardian Console Theme</label>
            <button
              type="button"
              onClick={onToggleTheme}
              className="btn btn--secondary text-xs font-mono"
            >
              Active: {theme === 'dark' ? '🌙 Dark Mode' : '☀ Light Mode'} (Click to Toggle)
            </button>
          </div>
        </section>
      </main>
    </div>
  )
}
