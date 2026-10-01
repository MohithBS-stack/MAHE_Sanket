import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import StateChip from './StateChip.jsx'
import './IncidentCard.css'

/**
 * IncidentCard — History list row (View F).
 *
 * frontend-design.md §9: timestamp, duration, peak risk color, one-line excerpt.
 *
 * @param {object} incident
 * @param {string} incident.session_id
 * @param {string} incident.started_at       ISO 8601
 * @param {string} incident.ended_at         ISO 8601 | null
 * @param {number} incident.peak_risk_score  0–100
 * @param {string} incident.status           'listening'|'caution'|'danger'|'resolved'
 * @param {string} incident.language_detected
 * @param {string} incident.transcript_excerpt  one-line text snippet
 * @param {string} incident.action_taken
 */
function IncidentCard({ incident }) {
  const navigate = useNavigate()

  const { riskState, durationStr, dateStr } = useMemo(() => {
    const score = incident.peak_risk_score ?? 0
    const state = score >= 70 ? 'danger' : score >= 40 ? 'caution' : 'safe'

    const start = incident.started_at ? new Date(incident.started_at) : null
    const end   = incident.ended_at   ? new Date(incident.ended_at)   : null
    const dur   = start && end ? Math.round((end - start) / 1000) : null
    const durStr = dur != null
      ? `${Math.floor(dur / 60)}m ${dur % 60}s`
      : 'Ongoing'

    const dateStr = start
      ? start.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
      : '—'

    return { riskState: state, durationStr: durStr, dateStr }
  }, [incident])

  const handleClick = () => {
    navigate(`/report/${incident.session_id}`)
  }

  return (
    <article
      className="incident-card"
      onClick={handleClick}
      onKeyDown={e => e.key === 'Enter' && handleClick()}
      tabIndex={0}
      role="button"
      aria-label={`Incident on ${dateStr} — peak risk ${incident.peak_risk_score}%`}
    >
      {/* Left: risk score badge */}
      <div className={`incident-card__score incident-card__score--${riskState} font-display`}>
        {incident.peak_risk_score ?? 0}
        <span className="incident-card__score-unit text-xs">%</span>
      </div>

      {/* Center: metadata + excerpt */}
      <div className="incident-card__body">
        <div className="incident-card__meta">
          <span className="font-mono text-xs incident-card__date">{dateStr}</span>
          <span className="text-xs incident-card__duration">{durationStr}</span>
          {incident.language_detected && (
            <span className="incident-card__lang text-xs">{LANG_LABELS[incident.language_detected] ?? incident.language_detected}</span>
          )}
        </div>

        {incident.transcript_excerpt && (
          <p className="incident-card__excerpt font-script text-sm">
            "{incident.transcript_excerpt}"
          </p>
        )}

        {incident.action_taken && incident.action_taken !== 'none' && (
          <p className="incident-card__action text-xs">
            Action: <span className="font-medium">{ACTION_LABELS[incident.action_taken] ?? incident.action_taken}</span>
          </p>
        )}
      </div>

      {/* Right: status chip */}
      <div className="incident-card__chip">
        <StateChip state={riskState} label={riskState === 'safe' ? 'Safe' : riskState.charAt(0).toUpperCase() + riskState.slice(1)} />
      </div>
    </article>
  )
}

const LANG_LABELS = { hi: 'Hindi', kn: 'Kannada', ta: 'Tamil', mixed: 'Code-mixed', en: 'English' }
const ACTION_LABELS = {
  dismissed_ok:   'Dismissed — safe',
  called_contact: 'Called contact',
  call_ended:     'Call ended',
  none:           'No action',
}

export default IncidentCard
