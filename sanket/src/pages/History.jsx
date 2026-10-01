import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import IncidentCard from '../components/IncidentCard.jsx'
import { getSessions, clearAllSessions } from '../services/db.js'
import './History.css'

export default function History() {
  const [sessions, setSessions] = useState(() => getSessions())
  const [searchQuery, setSearchQuery] = useState('')
  const [filterLang, setFilterLang] = useState('all')
  const [filterRisk, setFilterRisk] = useState('all')

  const filteredIncidents = useMemo(() => {
    return sessions.filter((session) => {
      // Language filter
      if (filterLang !== 'all' && session.language_detected !== filterLang) {
        return false
      }

      // Risk score filter
      const score = session.peak_risk_score ?? 0
      if (filterRisk === 'danger' && score < 70) return false
      if (filterRisk === 'caution' && (score < 40 || score >= 70)) return false

      // Search query (matches flagged phrases or transcript text)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchPhrase = session.flagged_phrases?.some((p) => p.toLowerCase().includes(q))
        const matchTranscript = session.transcript?.some((t) => t.text?.toLowerCase().includes(q))
        return matchPhrase || matchTranscript
      }

      return true
    })
  }, [sessions, filterLang, filterRisk, searchQuery])

  // Aggregate metrics
  const stats = useMemo(() => {
    const total = sessions.length
    const dangerCount = sessions.filter((s) => (s.peak_risk_score ?? 0) >= 70).length
    const avgRisk = total > 0
      ? Math.round(sessions.reduce((acc, s) => acc + (s.peak_risk_score ?? 0), 0) / total)
      : 0
    return { total, dangerCount, avgRisk }
  }, [sessions])

  const handleClearHistory = () => {
    if (window.confirm('Are you sure you want to clear all stored incident reports? This action cannot be undone.')) {
      clearAllSessions()
      setSessions([])
    }
  }

  return (
    <div className="history-page">
      {/* Top Header */}
      <header className="history-header glass-card">
        <div className="history-header__left">
          <Link to="/console" className="back-link text-sm font-ui">
            ← Back to Console
          </Link>
          <h1 className="history-title font-display">Call & Incident History</h1>
        </div>
        <div className="history-header__right">
          {sessions.length > 0 && (
            <button className="btn-clear-history text-xs font-ui" onClick={handleClearHistory}>
              Clear History
            </button>
          )}
        </div>
      </header>

      {/* Metric Cards Banner */}
      <section className="history-stats-grid">
        <div className="stat-card glass-card">
          <span className="stat-label text-xs font-ui">Incidents Recorded</span>
          <span className="stat-value font-display">{stats.total}</span>
          <span className="stat-sub text-xs font-mono">Persisted per privacy rule</span>
        </div>
        <div className="stat-card glass-card">
          <span className="stat-label text-xs font-ui">Scam Calls Intercepted</span>
          <span className="stat-value stat-value--danger font-display">{stats.dangerCount}</span>
          <span className="stat-sub text-xs font-mono">Risk score ≥ 70%</span>
        </div>
        <div className="stat-card glass-card">
          <span className="stat-label text-xs font-ui">Average Threat Score</span>
          <span className="stat-value stat-value--caution font-display">{stats.avgRisk}%</span>
          <span className="stat-sub text-xs font-mono">Across recorded incidents</span>
        </div>
      </section>

      {/* Filter and Search Bar */}
      <section className="history-controls glass-card">
        <div className="search-box">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            className="search-input font-ui text-sm"
            placeholder="Search transcript phrases or keywords (e.g. OTP, electricity, bank)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="filter-group font-ui text-xs">
          <label>
            Language:
            <select
              className="filter-select"
              value={filterLang}
              onChange={(e) => setFilterLang(e.target.value)}
            >
              <option value="all">All Languages</option>
              <option value="hi">Hindi (हिंदी)</option>
              <option value="kn">Kannada (ಕನ್ನಡ)</option>
              <option value="ta">Tamil (தமிழ்)</option>
            </select>
          </label>

          <label>
            Threat Level:
            <select
              className="filter-select"
              value={filterRisk}
              onChange={(e) => setFilterRisk(e.target.value)}
            >
              <option value="all">All Levels</option>
              <option value="danger">Danger (≥70%)</option>
              <option value="caution">Caution (40-69%)</option>
            </select>
          </label>
        </div>
      </section>

      {/* Privacy Notice Banner (PRD §10) */}
      <div className="privacy-banner chip">
        <span className="privacy-icon">🛡</span>
        <p className="privacy-text text-xs font-ui">
          <strong>Privacy Guard Active:</strong> Sanket strictly discards safe call transcripts immediately without saving. Only calls breaching the Caution (40%) or Danger (70%) threshold are persisted here for guardian review.
        </p>
      </div>

      {/* Incidents List */}
      <main className="history-list">
        {filteredIncidents.length === 0 ? (
          <div className="empty-history glass-card">
            <span className="empty-icon">✓</span>
            <h2 className="empty-title font-display text-lg">No incidents match your filter</h2>
            <p className="empty-desc text-sm font-ui">
              {sessions.length === 0
                ? 'No fraudulent or suspicious calls have been flagged yet.'
                : 'Try clearing your search or changing the filter criteria.'}
            </p>
          </div>
        ) : (
          filteredIncidents.map((incident) => (
            <IncidentCard key={incident.session_id} incident={incident} />
          ))
        )}
      </main>
    </div>
  )
}
