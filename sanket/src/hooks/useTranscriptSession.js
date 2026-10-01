import { useState, useRef, useCallback } from 'react'
import { saveSession, getElderProfile } from '../services/db.js'

/**
 * useTranscriptSession — manages rolling transcript and session telemetry.
 *
 * SKILLS.md §2, PRD.md §10 & TECHNICAL.md §3:
 * - Accumulates TranscriptLine[] during active listening
 * - Records risk timeline and flagged phrases
 * - ENFORCES PRIVACY RULE: only persists session to storage if peak_risk_score >= caution_threshold (40)
 */
export function useTranscriptSession() {
  const [sessionId, setSessionId] = useState(null)
  const [transcript, setTranscript] = useState([])
  const [riskTimeline, setRiskTimeline] = useState([])
  const [peakRiskScore, setPeakRiskScore] = useState(0)
  const [flaggedPhrases, setFlaggedPhrases] = useState([])
  const [status, setStatus] = useState('idle') // 'idle' | 'listening' | 'caution' | 'danger' | 'resolved'
  const [languageDetected, setLanguageDetected] = useState('hi')
  const [actionTaken, setActionTaken] = useState('none')
  const [startedAt, setStartedAt] = useState(null)

  // Use refs to track current state for synchronous access in async callbacks
  const sessionRef = useRef({
    sessionId: null,
    transcript: [],
    riskTimeline: [],
    peakRiskScore: 0,
    flaggedPhrases: [],
    status: 'idle',
    languageDetected: 'hi',
    actionTaken: 'none',
    startedAt: null,
  })

  /**
   * Start a brand new listening session
   */
  const startSession = useCallback(() => {
    const newId = `sanket-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`
    const now = new Date().toISOString()
    const profile = getElderProfile()

    setSessionId(newId)
    setTranscript([])
    setRiskTimeline([{ t: now, score: 0 }])
    setPeakRiskScore(0)
    setFlaggedPhrases([])
    setStatus('listening')
    setLanguageDetected(profile.primary_language || 'hi')
    setActionTaken('none')
    setStartedAt(now)

    sessionRef.current = {
      sessionId: newId,
      elderProfileId: profile.id,
      transcript: [],
      riskTimeline: [{ t: now, score: 0 }],
      peakRiskScore: 0,
      flaggedPhrases: [],
      status: 'listening',
      languageDetected: profile.primary_language || 'hi',
      actionTaken: 'none',
      startedAt: now,
    }

    return newId
  }, [])

  /**
   * Add a new transcript line from ASR
   */
  const addTranscriptLine = useCallback((line) => {
    const formattedLine = {
      t: line.timestamp || new Date().toISOString(),
      text: line.text,
      is_final: line.is_final ?? true,
      language: line.language_detected || sessionRef.current.languageDetected,
    }

    setTranscript(prev => [...prev, formattedLine])
    sessionRef.current.transcript.push(formattedLine)

    if (line.language_detected) {
      setLanguageDetected(line.language_detected)
      sessionRef.current.languageDetected = line.language_detected
    }
  }, [])

  /**
   * Record a new risk scoring result from n8n / risk service
   */
  const recordRiskScore = useCallback((score, phrases = [], cautionThreshold = 40, dangerThreshold = 70) => {
    const now = new Date().toISOString()
    const validScore = Math.max(0, Math.min(100, Math.round(score)))

    // Update risk timeline
    setRiskTimeline(prev => [...prev, { t: now, score: validScore }])
    sessionRef.current.riskTimeline.push({ t: now, score: validScore })

    // Update peak risk
    setPeakRiskScore(prev => {
      const nextPeak = Math.max(prev, validScore)
      sessionRef.current.peakRiskScore = nextPeak
      return nextPeak
    })

    // Update flagged phrases (unique set)
    if (phrases && phrases.length > 0) {
      setFlaggedPhrases(prev => {
        const set = new Set([...prev, ...phrases])
        const updated = Array.from(set)
        sessionRef.current.flaggedPhrases = updated
        return updated
      })
    }

    // Update status based on thresholds
    setStatus(currentStatus => {
      let nextStatus = currentStatus
      if (validScore >= dangerThreshold) {
        nextStatus = 'danger'
      } else if (validScore >= cautionThreshold && currentStatus !== 'danger') {
        nextStatus = 'caution'
      } else if (validScore < cautionThreshold && currentStatus !== 'danger' && currentStatus !== 'caution') {
        nextStatus = 'listening'
      }
      sessionRef.current.status = nextStatus
      return nextStatus
    })
  }, [])

  /**
   * Record action taken (e.g. from AlertTakeover button click)
   */
  const recordAction = useCallback((action) => {
    setActionTaken(action)
    setStatus('resolved')
    sessionRef.current.actionTaken = action
    sessionRef.current.status = 'resolved'
  }, [])

  /**
   * End the session and conditionally save per privacy rules
   */
  const endSession = useCallback((cautionThreshold = 40) => {
    const current = sessionRef.current
    if (!current.sessionId) return null

    const endedAt = new Date().toISOString()
    const fullSession = {
      session_id: current.sessionId,
      elder_profile_id: current.elderProfileId || 'elder-default-001',
      started_at: current.startedAt,
      ended_at: endedAt,
      language_detected: current.languageDetected,
      peak_risk_score: current.peakRiskScore,
      status: current.status === 'listening' ? 'resolved' : current.status,
      transcript: [...current.transcript],
      risk_timeline: [...current.riskTimeline],
      flagged_phrases: [...current.flaggedPhrases],
      action_taken: current.actionTaken,
    }

    // PRIVACY ENFORCEMENT:
    // Only persists if peak_risk_score >= cautionThreshold (40)
    const saved = saveSession(fullSession, cautionThreshold)

    setStatus('idle')
    sessionRef.current.status = 'idle'

    return {
      session: fullSession,
      persisted: saved,
    }
  }, [])

  /**
   * Reset session completely
   */
  const resetSession = useCallback(() => {
    setSessionId(null)
    setTranscript([])
    setRiskTimeline([])
    setPeakRiskScore(0)
    setFlaggedPhrases([])
    setStatus('idle')
    setActionTaken('none')
    setStartedAt(null)
    sessionRef.current = {
      sessionId: null,
      transcript: [],
      riskTimeline: [],
      peakRiskScore: 0,
      flaggedPhrases: [],
      status: 'idle',
      languageDetected: 'hi',
      actionTaken: 'none',
      startedAt: null,
    }
  }, [])

  return {
    sessionId,
    transcript,
    riskTimeline,
    peakRiskScore,
    flaggedPhrases,
    status,
    languageDetected,
    actionTaken,
    startedAt,
    startSession,
    addTranscriptLine,
    recordRiskScore,
    recordAction,
    endSession,
    resetSession,
  }
}
