/**
 * sarvamASR.js — Sarvam Saarika ASR service.
 *
 * SKILLS.md §2 (asr-transcription):
 * - Sends audio chunks to Sarvam Saarika /speech-to-text
 * - Returns { text, language_detected, confidence, is_final, timestamp }
 *
 * TECHNICAL.md §4 note: exact request/response fields depend on the API
 * version live at build time. This module is written against the indicative
 * shape. If the live API differs, update this file and note the deviation.
 *
 * AGENTS.md §2: This module NEVER fabricates a Sarvam response.
 * The explicit mock lives in __mocks__/sarvamASR.mock.js — clearly labeled,
 * imported only when VITE_DEMO_MODE=rehearsal. Never silently fake here.
 */

const API_BASE = 'https://api.sarvam.ai'
const API_KEY  = import.meta.env.VITE_SARVAM_API_KEY

const LANGUAGE_MAP = {
  auto: 'unknown',
  unknown: 'unknown',
  hi: 'hi-IN',
  kn: 'kn-IN',
  ta: 'ta-IN',
  te: 'te-IN',
  bn: 'bn-IN',
  mr: 'mr-IN',
  gu: 'gu-IN',
  pa: 'pa-IN',
  ml: 'ml-IN',
  en: 'en-IN',
  ur: 'ur-IN',
}

/**
 * Transcribe one audio chunk via Sarvam Saaras (v3).
 *
 * @param {Blob}   audioBlob  raw audio blob (WAV or WebM)
 * @param {string} language   hint: 'auto' | 'hi' | 'kn' | 'ta' | 'en'
 * @returns {Promise<SarvamASRResult>}
 */
export async function transcribeChunk(audioBlob, language = 'auto') {
  if (!API_KEY) {
    throw new Error('[sarvamASR] VITE_SARVAM_API_KEY is not set. Check .env')
  }

  const langKey = (language || 'auto').toLowerCase()
  const targetLanguageCode = LANGUAGE_MAP[langKey] || (langKey.includes('-in') ? language : 'unknown')

  const rawType = audioBlob.type || 'audio/wav'
  const isWav = rawType.includes('wav')
  const ext = isWav ? 'wav' : 'webm'
  const cleanMime = isWav ? 'audio/wav' : (rawType.split(';')[0].trim() || 'audio/webm')
  const audioFile = new File([audioBlob], `chunk.${ext}`, { type: cleanMime })

  const formData = new FormData()
  formData.append('file', audioFile, `chunk.${ext}`)
  formData.append('language_code', targetLanguageCode)
  formData.append('model', 'saaras:v3')
  formData.append('with_timestamps', 'false')

  const response = await fetch(`${API_BASE}/speech-to-text`, {
    method: 'POST',
    headers: {
      'api-subscription-key': API_KEY,
    },
    body: formData,
  })

  if (!response.ok) {
    const errBody = await response.text().catch(() => '')
    let detail = errBody
    try {
      const parsed = JSON.parse(errBody)
      detail = parsed.detail || parsed.error?.message || errBody
    } catch {}
    throw new Error(`[sarvamASR] API error ${response.status}: ${detail}`)
  }

  const data = await response.json()

  // Normalize to our internal TranscriptLine shape
  return {
    text:              data.transcript ?? data.text ?? '',
    language_detected: data.language_code ?? data.language_detected ?? language,
    confidence:        data.language_probability ?? data.confidence ?? null,
    is_final:          true,
    timestamp:         new Date().toISOString(),
  }
}

/**
 * @typedef {Object} SarvamASRResult
 * @property {string}      text               transcribed text
 * @property {string}      language_detected  detected language code
 * @property {number|null} confidence         ASR confidence (0–1), if provided
 * @property {boolean}     is_final           always true for chunk-mode Saaras
 * @property {string}      timestamp          ISO 8601 timestamp of transcription
 */
