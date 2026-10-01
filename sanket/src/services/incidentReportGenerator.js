/**
 * incidentReportGenerator.js — Generates structured Incident Reports from call sessions.
 *
 * SKILLS.md §8 (incident-report-generator) & TECHNICAL.md §3:
 * - Assembles structured summary from raw session transcript and risk-scoring log.
 * - Extracts transcript excerpt around peak risk.
 * - Generates clear plain-language summary describing detected threats and actions.
 */

/**
 * Generate an IncidentReport from a Session object.
 *
 * @param {Object} session Session object matching TECHNICAL.md §3
 * @returns {IncidentReport}
 */
export function generateIncidentReport(session) {
  if (!session) {
    throw new Error('[incidentReportGenerator] Session object required')
  }

  const {
    session_id,
    started_at,
    ended_at,
    language_detected = 'hi',
    peak_risk_score = 0,
    transcript = [],
    risk_timeline = [],
    flagged_phrases = [],
    action_taken = 'none',
  } = session

  // 1. Calculate duration
  const start = new Date(started_at).getTime()
  const end = ended_at ? new Date(ended_at).getTime() : Date.now()
  const durationSec = Math.max(0, Math.round((end - start) / 1000))
  const mins = Math.floor(durationSec / 60)
  const secs = durationSec % 60
  const durationFormatted = `${mins}m ${secs}s`

  // 2. Find transcript excerpt around the peak risk moment
  let excerpt = ''
  if (transcript.length > 0) {
    // If flagged phrases exist, extract lines containing them or take the latest 3-5 lines
    const flaggedLines = transcript.filter(line => 
      flagged_phrases.some(phrase => line.text.toLowerCase().includes(phrase.toLowerCase()))
    )

    if (flaggedLines.length > 0) {
      excerpt = flaggedLines.map(l => `[${l.language || language_detected}] ${l.text}`).join('\n')
    } else {
      // Last 4 lines as representative excerpt
      excerpt = transcript.slice(-4).map(l => `[${l.language || language_detected}] ${l.text}`).join('\n')
    }
  } else {
    excerpt = 'No transcript lines recorded.'
  }

  // 3. Formulate plain-language incident summary
  const languageNames = {
    hi: 'Hindi',
    kn: 'Kannada',
    ta: 'Tamil',
    en: 'English',
    mixed: 'Code-mixed',
  }
  const langStr = languageNames[language_detected] || language_detected

  let threatLevel = 'Low'
  if (peak_risk_score >= 70) threatLevel = 'Critical (DANGER)'
  else if (peak_risk_score >= 40) threatLevel = 'Moderate (CAUTION)'

  const flaggedStr = flagged_phrases.length > 0 
    ? `Flagged high-risk phrases included: "${flagged_phrases.join('", "')}".`
    : 'No explicit keyword patterns flagged, but conversational urgency or financial coercion was identified.'

  const actionStr = {
    dismissed_ok: 'Elder reviewed the alert and tapped "I\'m okay".',
    called_contact: 'Elder triggered emergency assistance and connected to their trusted contact.',
    call_ended: 'Call was disconnected following intervention.',
    none: 'Monitoring completed without explicit manual intervention.',
  }[action_taken] || action_taken

  const summary = `During a ${durationFormatted} incoming call conducted in ${langStr}, Sanket flagged potential fraudulent activity with a peak threat level of ${peak_risk_score}/100 (${threatLevel}). ${flaggedStr} Immediate intervention was initiated. Action taken: ${actionStr}`

  return {
    session_id,
    summary,
    peak_risk_score,
    risk_timeline: risk_timeline.length > 0 ? risk_timeline : [{ t: started_at, score: peak_risk_score }],
    transcript_excerpt: excerpt,
    action_taken,
    duration: durationFormatted,
    language_detected,
    flagged_phrases,
    generated_at: new Date().toISOString(),
  }
}
