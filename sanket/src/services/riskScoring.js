/**
 * riskScoring.js — Risk scoring service calling the n8n workflow.
 *
 * SKILLS.md §3 (risk-scoring) & TECHNICAL.md §4:
 * - Sends rolling transcript window to n8n webhook
 * - Expected response: { risk_score, flagged_phrases[], reasoning_trace }
 *
 * Latency budget: <= 1000ms (TECHNICAL.md §5)
 */

const N8N_WEBHOOK_URL = import.meta.env.VITE_N8N_WEBHOOK_URL
const IS_REHEARSAL = import.meta.env.VITE_DEMO_MODE === 'rehearsal'

/**
 * High-risk scam indicators for Indian context (used for heuristic verification and fallback)
 */
const SCAM_PATTERNS = [
  { regex: /otp|one time password|ओटीपी|ಒಟಿಪಿ/i, phrase: 'OTP request', weight: 45 },
  { regex: /kyc|update kyc|केवाईसी|ಕೆವೈಸಿ/i, phrase: 'KYC update urgency', weight: 35 },
  { regex: /suspend|block|freeze|बंद हो जाएगा|ಖಾತೆ ಬ್ಲಾಕ್/i, phrase: 'Account suspension threat', weight: 35 },
  { regex: /electricity|power cut|बिजली|ವಿದ್ಯುತ್/i, phrase: 'Utility disconnection threat', weight: 30 },
  { regex: /police|cbi|arrest|trai|court|FIR|अरेस्ट|ಪೊಲೀಸ್/i, phrase: 'Law enforcement impersonation', weight: 40 },
  { regex: /anydesk|teamviewer|rustdesk|quicksupport|apk/i, phrase: 'Remote access app installation', weight: 50 },
  { regex: /send money|transfer|upi|pay immediately|तुरंत पैसे/i, phrase: 'Coercive transfer demand', weight: 35 },
  { regex: /credit card|cvv|expiry date|कार्ड नंबर/i, phrase: 'Card credential solicitation', weight: 40 },
]

/**
 * Score a window of transcript lines for scam indicators.
 *
 * @param {string} sessionId
 * @param {Array<{text: string, language?: string, t?: string}>} transcriptWindow
 * @returns {Promise<RiskScoreResult>}
 */
export async function evaluateRisk(sessionId, transcriptWindow = []) {
  if (!transcriptWindow || transcriptWindow.length === 0) {
    return {
      risk_score: 0,
      threat_level: 'SAFE',
      flagged_phrases: [],
      reasoning_trace: 'Empty transcript window.',
      timestamp: new Date().toISOString(),
    }
  }

  // If live n8n webhook URL is configured and we are not in pure offline rehearsal
  if (N8N_WEBHOOK_URL && !IS_REHEARSAL) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 2000) // 2s timeout to protect latency budget

      const response = await fetch(N8N_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session_id: sessionId,
          transcript_window: transcriptWindow,
        }),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (response.ok) {
        const data = await response.json()
        const score = Math.max(0, Math.min(100, Math.round(Number(data.risk_score) || 0)))
        return {
          risk_score: score,
          threat_level: score >= 70 ? 'DANGER' : score >= 40 ? 'CAUTION' : 'SAFE',
          flagged_phrases: Array.isArray(data.flagged_phrases) ? data.flagged_phrases : [],
          reasoning_trace: data.reasoning_trace || 'n8n LLM reasoning evaluation completed.',
          timestamp: new Date().toISOString(),
        }
      }
      console.warn(`[riskScoring] n8n returned HTTP ${response.status}. Falling back to local evaluator.`)
    } catch (err) {
      console.warn('[riskScoring] n8n webhook unreachable or timed out. Falling back to local evaluator:', err.message)
    }
  }

  // Deterministic local pattern evaluator (fallback for rehearsal or n8n offline demo)
  return evaluateLocally(transcriptWindow)
}

/**
 * Local pattern evaluator based on Indian elder fraud threat taxonomy.
 * Matches keywords and calculates weighted risk score (0-100).
 */
export function evaluateLocally(transcriptWindow = []) {
  const combinedText = transcriptWindow.map(l => l.text || '').join(' ')
  let totalScore = 0
  const flagged = []

  for (const item of SCAM_PATTERNS) {
    if (item.regex.test(combinedText)) {
      totalScore += item.weight
      flagged.push(item.phrase)
    }
  }

  // Normalization curve: cap at 100
  const riskScore = Math.min(100, totalScore)
  const threatLevel = riskScore >= 70 ? 'DANGER' : riskScore >= 40 ? 'CAUTION' : 'SAFE'

  let reasoning = 'No threat indicators detected. Call conversational flow appears benign.'
  if (riskScore >= 70) {
    reasoning = `CRITICAL RISK: Multiple coercive scam signals detected (${flagged.join(', ')}). Immediate intervention required.`
  } else if (riskScore >= 40) {
    reasoning = `SUSPICIOUS ACTIVITY: Potential fraud signals detected (${flagged.join(', ')}). Increased surveillance recommended.`
  }

  return {
    risk_score: riskScore,
    threat_level: threatLevel,
    flagged_phrases: flagged,
    reasoning_trace: reasoning,
    timestamp: new Date().toISOString(),
  }
}

/**
 * @typedef {Object} RiskScoreResult
 * @property {number}   risk_score      0 to 100
 * @property {string}   threat_level    'SAFE' | 'CAUTION' | 'DANGER'
 * @property {string[]} flagged_phrases detected red-flag phrases
 * @property {string}   reasoning_trace explanatory text from LLM / rule engine
 * @property {string}   timestamp       ISO timestamp
 */
