/**
 * db.js — Client-side storage layer for Sanket.
 *
 * TECHNICAL.md §2, §3 & PRD.md §10:
 * - Uses localStorage with a clean, structured schema.
 * - PRIVACY RULE (NON-NEGOTIABLE):
 *   Only sessions where peak_risk_score >= caution_threshold (default 40)
 *   are persisted. Safe/idle calls are immediately discarded without saving
 *   transcripts or metadata to disk.
 */

const STORAGE_KEYS = {
  SESSIONS: 'sanket_sessions',
  ELDER_PROFILE: 'sanket_elder_profile',
  SETTINGS: 'sanket_settings',
}

const DEFAULT_PROFILE = {
  id: 'elder-default-001',
  name: 'Shanti Devi',
  primary_language: 'hi',
  fallback_language: 'en',
  sensitivity_threshold: 70, // Danger threshold (Caution is 40)
  theme_preference: 'light',
  trusted_contacts: [
    {
      name: 'Rohan (Son)',
      telegram_chat_id: import.meta.env.VITE_TELEGRAM_CHAT_ID || '',
      phone: '+91 98765 43210',
    },
  ],
}

// Initial pre-seeded incidents for demo purposes if empty
const INITIAL_DEMO_INCIDENTS = [
  {
    session_id: 'demo-session-101',
    elder_profile_id: 'elder-default-001',
    started_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    ended_at: new Date(Date.now() - 86400000 * 2 + 180000).toISOString(),
    language_detected: 'hi',
    peak_risk_score: 88,
    status: 'danger',
    transcript: [
      { t: new Date(Date.now() - 86400000 * 2).toISOString(), text: 'नमस्ते, मैं बिजली विभाग से बोल रहा हूँ।', is_final: true, language: 'hi' },
      { t: new Date(Date.now() - 86400000 * 2 + 30000).toISOString(), text: 'आपका बिजली का बिल बकाया है, आज रात 9 बजे बिजली काट दी जाएगी।', is_final: true, language: 'hi' },
      { t: new Date(Date.now() - 86400000 * 2 + 60000).toISOString(), text: 'अभी तुरंत इस नंबर पर payment करें या OTP भेजें।', is_final: true, language: 'hi' },
    ],
    risk_timeline: [
      { t: new Date(Date.now() - 86400000 * 2).toISOString(), score: 10 },
      { t: new Date(Date.now() - 86400000 * 2 + 30000).toISOString(), score: 55 },
      { t: new Date(Date.now() - 86400000 * 2 + 60000).toISOString(), score: 88 },
    ],
    flagged_phrases: ['बिजली काट दी जाएगी', 'OTP भेजें', 'तुरंत payment'],
    action_taken: 'called_contact',
  },
  {
    session_id: 'demo-session-102',
    elder_profile_id: 'elder-default-001',
    started_at: new Date(Date.now() - 86400000 * 5).toISOString(),
    ended_at: new Date(Date.now() - 86400000 * 5 + 120000).toISOString(),
    language_detected: 'kn',
    peak_risk_score: 75,
    status: 'danger',
    transcript: [
      { t: new Date(Date.now() - 86400000 * 5).toISOString(), text: 'ನಿಮ್ಮ ಬ್ಯಾಂಕ್ ಖಾತೆ ಬ್ಲಾಕ್ ಆಗಿದೆ.', is_final: true, language: 'kn' },
      { t: new Date(Date.now() - 86400000 * 5 + 40000).toISOString(), text: 'KYC ನವೀಕರಿಸಲು ತಕ್ಷಣ OTP ನೀಡಿ.', is_final: true, language: 'kn' },
    ],
    risk_timeline: [
      { t: new Date(Date.now() - 86400000 * 5).toISOString(), score: 45 },
      { t: new Date(Date.now() - 86400000 * 5 + 40000).toISOString(), score: 75 },
    ],
    flagged_phrases: ['ಖಾತೆ ಬ್ಲಾಕ್ ಆಗಿದೆ', 'OTP ನೀಡಿ'],
    action_taken: 'call_ended',
  },
]

/**
 * Get the active elder profile
 */
export function getElderProfile() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ELDER_PROFILE)
    if (!raw) {
      saveElderProfile(DEFAULT_PROFILE)
      return DEFAULT_PROFILE
    }
    return JSON.parse(raw)
  } catch (err) {
    console.error('[db] Error reading elder profile:', err)
    return DEFAULT_PROFILE
  }
}

/**
 * Save or update the active elder profile
 */
export function saveElderProfile(profile) {
  try {
    localStorage.setItem(STORAGE_KEYS.ELDER_PROFILE, JSON.stringify(profile))
  } catch (err) {
    console.error('[db] Error saving elder profile:', err)
  }
}

/**
 * Get all stored sessions (newest first).
 */
export function getSessions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SESSIONS)
    if (!raw) {
      // Seed initial incidents
      localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(INITIAL_DEMO_INCIDENTS))
      return INITIAL_DEMO_INCIDENTS
    }
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch (err) {
    console.error('[db] Error reading sessions:', err)
    return []
  }
}

/**
 * Get a specific session by ID.
 */
export function getSessionById(sessionId) {
  const sessions = getSessions()
  return sessions.find(s => s.session_id === sessionId) || null
}

/**
 * Save a completed or ongoing session.
 * CRITICAL PRIVACY RULE: Only persists if peak_risk_score >= cautionThreshold (40).
 * Safe sessions (risk < 40) return false and are never written to disk.
 *
 * @param {Object} session
 * @param {number} cautionThreshold
 * @returns {boolean} true if saved, false if discarded per privacy rules
 */
export function saveSession(session, cautionThreshold = 40) {
  if (!session || typeof session.peak_risk_score !== 'number') {
    return false
  }

  // PRIVACY CHECK: Discard safe calls
  if (session.peak_risk_score < cautionThreshold) {
    console.info(`[db] Session ${session.session_id} peak risk (${session.peak_risk_score}) below caution threshold (${cautionThreshold}). Discarded per privacy rule.`)
    return false
  }

  try {
    const sessions = getSessions()
    const index = sessions.findIndex(s => s.session_id === session.session_id)
    if (index >= 0) {
      sessions[index] = session
    } else {
      sessions.unshift(session)
    }
    localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions))
    return true
  } catch (err) {
    console.error('[db] Error saving session:', err)
    return false
  }
}

/**
 * Delete a session from storage
 */
export function deleteSession(sessionId) {
  try {
    const sessions = getSessions().filter(s => s.session_id !== sessionId)
    localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions))
    return true
  } catch (err) {
    console.error('[db] Error deleting session:', err)
    return false
  }
}

/**
 * Clear all incident history
 */
export function clearAllSessions() {
  try {
    localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify([]))
    return true
  } catch (err) {
    console.error('[db] Error clearing sessions:', err)
    return false
  }
}
