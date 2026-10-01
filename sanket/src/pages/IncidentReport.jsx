import { useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getSessionById } from '../services/db.js'
import { generateIncidentReport } from '../services/incidentReportGenerator.js'
import RiskGauge from '../components/RiskGauge.jsx'
import './IncidentReport.css'

export default function IncidentReport() {
  const { sessionId } = useParams()
  const [copied, setCopied] = useState(false)

  const session = useMemo(() => {
    return getSessionById(sessionId)
  }, [sessionId])

  const report = useMemo(() => {
    if (!session) return null
    try {
      return generateIncidentReport(session)
    } catch (err) {
      console.error('[IncidentReport] Error generating report:', err)
      return null
    }
  }, [session])

  const handleCopySummary = () => {
    if (!report) return
    const textToCopy = `SANKET INCIDENT REPORT\nSession ID: ${report.session_id}\nPeak Threat: ${report.peak_risk_score}%\nLanguage: ${report.language_detected}\nSummary: ${report.summary}\nAction Taken: ${report.action_taken}`
    navigator.clipboard.writeText(textToCopy)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  if (!session || !report) {
    return (
      <div className="report-not-found glass-card">
        <h2 className="font-display">Incident Report Not Found</h2>
        <p className="text-sm font-ui">
          No incident data found for session ID <code>{sessionId}</code>. It may have been a safe call discarded per privacy rules or deleted.
        </p>
        <Link to="/history" className="btn btn--primary font-ui text-sm">
          Return to Incident History
        </Link>
      </div>
    )
  }

  const isDanger = report.peak_risk_score >= 70
  const isCaution = report.peak_risk_score >= 40 && !isDanger

  return (
    <div className="incident-report-page">
      {/* Top Header */}
      <header className="report-header glass-card">
        <div className="report-header__left">
          <Link to="/history" className="back-link text-sm font-ui">
            ← Back to Incidents
          </Link>
          <div className="title-row">
            <h1 className="report-title font-display">Post-Call Incident Report</h1>
            <span className={`status-pill status-pill--${isDanger ? 'danger' : isCaution ? 'caution' : 'safe'} text-xs font-mono`}>
              {isDanger ? 'CRITICAL FRAUD THREAT' : 'SUSPICIOUS (CAUTION)'}
            </span>
          </div>
          <span className="report-meta text-xs font-mono">
            Session: {report.session_id} • Generated at: {new Date(report.generated_at).toLocaleString('en-IN')}
          </span>
        </div>

        <div className="report-header__actions">
          <button className="btn btn--secondary text-xs font-ui" onClick={handleCopySummary}>
            {copied ? '✓ Copied Summary' : '📋 Copy Report Summary'}
          </button>
        </div>
      </header>

      {/* Main Grid */}
      <div className="report-grid">
        {/* Left Column: Summary, Timeline, Excerpt */}
        <main className="report-main">
          {/* Plain-Language Executive Summary */}
          <section className="report-section glass-card">
            <h2 className="section-title text-sm font-ui uppercase tracking-wide">Plain-Language Incident Summary</h2>
            <p className="report-summary-text font-ui">{report.summary}</p>
          </section>

          {/* Critical Transcript Excerpt */}
          <section className="report-section glass-card">
            <div className="section-header-row">
              <h2 className="section-title text-sm font-ui uppercase tracking-wide">Threat Moment Transcript Excerpt</h2>
              <span className="lang-tag text-xs font-mono">Language: {report.language_detected.toUpperCase()}</span>
            </div>
            <div className="excerpt-box chip">
              <pre className="excerpt-pre font-script">{report.transcript_excerpt}</pre>
            </div>
          </section>

          {/* Risk Progression Timeline */}
          <section className="report-section glass-card">
            <h2 className="section-title text-sm font-ui uppercase tracking-wide">Risk Timeline Progression</h2>
            <div className="timeline-steps">
              {report.risk_timeline.map((item, idx) => {
                const itemTime = item.t ? new Date(item.t).toLocaleTimeString('en-IN', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }) : `--:--`
                const itemState = item.score >= 70 ? 'danger' : item.score >= 40 ? 'caution' : 'safe'
                return (
                  <div key={idx} className={`timeline-node timeline-node--${itemState}`}>
                    <div className="timeline-dot" />
                    <div className="timeline-info">
                      <span className="timeline-score font-display">{item.score}%</span>
                      <span className="timeline-time font-mono text-xs">{itemTime}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        </main>

        {/* Right Column: Telemetry & Actions */}
        <aside className="report-aside">
          {/* Risk Gauge Card */}
          <div className="aside-card glass-card">
            <h3 className="aside-title text-xs font-ui uppercase">Peak Risk Evaluated</h3>
            <div className="report-gauge-box">
              <RiskGauge
                score={report.peak_risk_score}
                label={isDanger ? 'Critical Threat' : 'Elevated Risk'}
                animated={false}
              />
            </div>
          </div>

          {/* Incident Metadata Card */}
          <div className="aside-card glass-card">
            <h3 className="aside-title text-xs font-ui uppercase">Call Metadata</h3>
            <ul className="meta-list font-ui text-sm">
              <li>
                <span className="meta-label">Call Duration:</span>
                <span className="meta-val font-mono">{report.duration}</span>
              </li>
              <li>
                <span className="meta-label">Action Taken:</span>
                <span className="meta-val font-semibold">{report.action_taken}</span>
              </li>
              <li>
                <span className="meta-label">Vernacular Speech:</span>
                <span className="meta-val">{report.language_detected?.toUpperCase()}</span>
              </li>
              <li>
                <span className="meta-label">TTS Warning Played:</span>
                <span className="meta-val text-teal">Yes (Sarvam Bulbul)</span>
              </li>
            </ul>
          </div>

          {/* Flagged Phrases Card */}
          <div className="aside-card glass-card">
            <h3 className="aside-title text-xs font-ui uppercase">Flagged Fraud Indicators</h3>
            {report.flagged_phrases.length === 0 ? (
              <p className="text-xs font-ui text-muted">None explicitly cataloged</p>
            ) : (
              <div className="report-phrases-list">
                {report.flagged_phrases.map((phrase, i) => (
                  <span key={i} className="report-phrase-tag font-ui text-xs">
                    ⚠ {phrase}
                  </span>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}
