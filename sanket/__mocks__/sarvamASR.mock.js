/**
 * __mocks__/sarvamASR.mock.js
 *
 * CLEARLY LABELED REHEARSAL MOCK — never used in the judged demo build.
 *
 * AGENTS.md §2: This file exists to let the team rehearse without burning
 * free-tier Sarvam API quota. It is ONLY loaded when VITE_DEMO_MODE=rehearsal.
 * The judged demo branch must use the real sarvamASR.js service.
 *
 * Usage in Console.jsx:
 *   const asrModule = import.meta.env.VITE_DEMO_MODE === 'rehearsal'
 *     ? await import('../../__mocks__/sarvamASR.mock.js')
 *     : await import('../services/sarvamASR.js')
 */

/**
 * Scripted demo transcript lines — simulates a typical scam call progression.
 * Designed so risk-scoring will hit CAUTION around line 4 and DANGER around line 7.
 */
const MOCK_SCRIPT = [
  { text: 'हाँ, बोलिए।', language_detected: 'hi' },
  { text: 'नमस्ते, मैं SBI बैंक से बात कर रहा हूँ।', language_detected: 'hi' },
  { text: 'आपका account suspend होने वाला है।', language_detected: 'hi' },
  { text: 'आपको अभी अपना KYC update करना होगा।', language_detected: 'hi' },
  { text: 'क्या आप मुझे अपना account number बता सकते हैं?', language_detected: 'hi' },
  { text: 'और आपके phone पर एक OTP आएगा।', language_detected: 'hi' },
  { text: 'वो OTP मुझे share करें, तभी account safe रहेगा।', language_detected: 'hi' },
]

let mockIndex = 0

/**
 * Mock transcribeChunk — cycles through MOCK_SCRIPT with realistic delay.
 * Returns one line at a time per call.
 */
export async function transcribeChunk(_audioBlob, _language = 'auto') {
  // Simulate ASR round-trip latency (600–900ms)
  await sleep(600 + Math.random() * 300)

  const line = MOCK_SCRIPT[mockIndex % MOCK_SCRIPT.length]
  mockIndex++

  return {
    text:              line.text,
    language_detected: line.language_detected,
    confidence:        0.92 + Math.random() * 0.07,
    is_final:          true,
    timestamp:         new Date().toISOString(),
    __mock__:          true, // always present — makes it obvious this is mock data
  }
}

/** Reset the mock script to beginning (call before each rehearsal run) */
export function resetMock() {
  mockIndex = 0
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
