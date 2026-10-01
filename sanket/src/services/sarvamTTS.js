/**
 * sarvamTTS.js — Sarvam Bulbul text-to-speech service.
 *
 * SKILLS.md §5 (vernacular-alert) & TECHNICAL.md §4:
 * - Synthesizes spoken warning in elder's detected language.
 * - Plays immediately over speakerphone simultaneously with AlertTakeover.
 * - If Sarvam API key is unset or network fails, falls back gracefully to Web Speech API.
 */

const API_BASE = 'https://api.sarvam.ai'
const API_KEY = import.meta.env.VITE_SARVAM_API_KEY
const IS_REHEARSAL = import.meta.env.VITE_DEMO_MODE === 'rehearsal'

/**
 * Standard warning messages per language (PRD §FR-C1 & frontend-design.md §5)
 */
export const WARNING_TEXTS = {
  hi: {
    native: 'सावधान! यह कॉल असली नहीं लग रही है। कृपया कोई OTP या पैसे न भेजें।',
    english: 'Warning! This call may not be safe. Do not share any OTP or transfer money.',
    langCode: 'hi-IN',
  },
  kn: {
    native: 'ಎಚ್ಚರಿಕೆ! ಈ ಕರೆ ಸುರಕ್ಷಿತವಾಗಿಲ್ಲ. ದಯವಿಟ್ಟು ಯಾವುದೇ OTP ಅಥವಾ ಹಣವನ್ನು ಹಂಚಿಕೊಳ್ಳಬೇಡಿ.',
    english: 'Warning! This call may not be safe. Do not share any OTP or transfer money.',
    langCode: 'kn-IN',
  },
  ta: {
    native: 'எச்சரிக்கை! இந்த அழைப்பு பாதுகாப்பானது அல்ல. எந்த ஒரு OTP அல்லது பணத்தையும் பகிர வேண்டாம்.',
    english: 'Warning! This call may not be safe. Do not share any OTP or transfer money.',
    langCode: 'ta-IN',
  },
  en: {
    native: 'Warning! This call may not be safe. Please do not share any OTP or transfer money.',
    english: 'Warning! This call may not be safe. Please do not share any OTP or transfer money.',
    langCode: 'en-IN',
  },
}

/**
 * Synthesize and play audio alert in the elder's vernacular language.
 *
 * @param {string} text Spoken message text
 * @param {string} language 'hi' | 'kn' | 'ta' | 'en'
 * @returns {Promise<boolean>}
 */
export async function playVernacularAlert(text, language = 'hi') {
  const normalizedLang = (language || 'hi').toLowerCase()
  const config = WARNING_TEXTS[normalizedLang] || WARNING_TEXTS.hi
  const alertText = text || config.native

  // 1. Try Sarvam Bulbul if key is provided and not in rehearsal
  if (API_KEY && !IS_REHEARSAL) {
    try {
      // Modern Sarvam Bulbul API expects text and language_code
      const response = await fetch(`${API_BASE}/text-to-speech`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-subscription-key': API_KEY,
        },
        body: JSON.stringify({
          text: alertText,
          language_code: config.langCode,
          speaker: 'shubh',
          model: 'bulbul:v3',
          pace: 1.0,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        const base64Audio = data.audios?.[0] || data.audio
        if (base64Audio) {
          const audio = new Audio(`data:audio/wav;base64,${base64Audio}`)
          await audio.play()
          return true
        }
      } else {
        const errText = await response.text().catch(() => '')
        console.warn(`[sarvamTTS] API error ${response.status}: ${errText}. Falling back to browser speech.`)
      }
    } catch (err) {
      console.warn('[sarvamTTS] Failed to reach Sarvam TTS, falling back to browser speech:', err.message)
    }
  }

  // 2. Fallback to Browser SpeechSynthesis (Web Speech API)
  return playBrowserSpeech(alertText, config.langCode)
}

/**
 * Fallback to browser's native SpeechSynthesis API
 */
function playBrowserSpeech(text, langCode) {
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window)) {
      console.warn('[sarvamTTS] SpeechSynthesis not supported in this browser.')
      resolve(false)
      return
    }

    window.speechSynthesis.cancel() // Stop any current speech
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = langCode
    utterance.rate = 0.95
    utterance.pitch = 1.0

    // Try finding matching voice
    const voices = window.speechSynthesis.getVoices()
    const matchingVoice = voices.find(v => v.lang.startsWith(langCode.slice(0, 2)))
    if (matchingVoice) {
      utterance.voice = matchingVoice
    }

    utterance.onend = () => resolve(true)
    utterance.onerror = (e) => {
      console.warn('[sarvamTTS] Browser speech error:', e)
      resolve(false)
    }

    window.speechSynthesis.speak(utterance)
  })
}
