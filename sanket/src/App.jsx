import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useState, useCallback } from 'react'
import Onboarding from './pages/Onboarding.jsx'
import Console from './pages/Console.jsx'
import ElderIdle from './pages/ElderIdle.jsx'
import History from './pages/History.jsx'
import IncidentReport from './pages/IncidentReport.jsx'
import Settings from './pages/Settings.jsx'

/**
 * App root.
 *
 * Theme state is held here and propagated via data-theme on the root div.
 * Per frontend-design.md §3.1:
 *   - Guardian Console defaults dark
 *   - Elder screens default light (overridden per ElderProfile.theme_preference)
 *   - Alert Takeover is always fixed alarm-crimson — ignores this state entirely
 */
function App() {
  const [guardianTheme, setGuardianTheme] = useState('dark')

  const toggleGuardianTheme = useCallback(() => {
    setGuardianTheme(t => t === 'dark' ? 'light' : 'dark')
  }, [])

  return (
    <div data-theme={guardianTheme} className="app-shell">
      <BrowserRouter>
        <Routes>
          {/* A — Onboarding & Setup */}
          <Route path="/onboarding" element={<Onboarding />} />

          {/* B — Guardian Console (main dashboard) */}
          <Route
            path="/console"
            element={
              <Console
                theme={guardianTheme}
                onToggleTheme={toggleGuardianTheme}
              />
            }
          />

          {/* C — Elder Alert Takeover (rendered by Console/ElderIdle, not a standalone route) */}

          {/* D — Incident Report */}
          <Route path="/report/:sessionId" element={<IncidentReport />} />

          {/* F — History */}
          <Route path="/history" element={<History />} />

          {/* G — Settings */}
          <Route
            path="/settings"
            element={<Settings theme={guardianTheme} onToggleTheme={toggleGuardianTheme} />}
          />

          {/* H — Elder Companion (idle) */}
          <Route path="/elder" element={<ElderIdle />} />

          {/* Default: go to console for demo, onboarding for real use */}
          <Route path="/" element={<Navigate to="/console" replace />} />
        </Routes>
      </BrowserRouter>
    </div>
  )
}

export default App
