import { useEffect, useRef } from 'react'
import './TranscriptStream.css'

/**
 * TranscriptStream — live scrolling intelligence transcript panel.
 *
 * @param {TranscriptLine[]} lines        finalized transcript lines
 * @param {string|null}      interimText  current interim ASR result
 * @param {string[]}         flaggedPhrases suspicious keywords to highlight
 */
function TranscriptStream({ lines = [], interimText = null, flaggedPhrases = [] }) {
  const bottomRef = useRef(null)

  // Auto-scroll to bottom whenever lines or interim changes
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [lines, interimText])

  const hasContent = lines.length > 0 || interimText

  // Check if text has flagged keywords
  const isSuspicious = (text) => {
    if (!text || flaggedPhrases.length === 0) return false
    const lower = text.toLowerCase()
    return flaggedPhrases.some(p => lower.includes(p.toLowerCase()))
  }

  return (
    <div className="transcript-stream scroll-area" role="log" aria-live="polite" aria-label="Live call transcript">
      {!hasContent && (
        <div className="transcript-stream__empty font-ui">
          <div className="empty-radar-icon">📡</div>
          <p className="empty-title text-sm">Waiting for incoming call speech…</p>
          <p className="empty-sub text-xs">Audio chunks from speakerphone are continuously monitored in 16kHz WAV format.</p>
        </div>
      )}

      {lines.map((line, i) => {
        const suspicious = isSuspicious(line.text)
        return (
          <div
            key={line.t || i}
            className={`transcript-stream__line ${suspicious ? 'transcript-stream__line--flagged' : ''}`}
          >
            <div className="line-header">
              <span className={`speaker-tag text-xs font-mono ${suspicious ? 'speaker-tag--suspect' : 'speaker-tag--caller'}`}>
                {suspicious ? '🚨 SUSPECT' : '📞 CALLER'}
              </span>
              <span className="transcript-stream__time font-mono text-xs">
                {formatTime(line.t)}
              </span>
              {line.language && (
                <span className="transcript-stream__lang text-xs font-mono">
                  {line.language.toUpperCase()}
                </span>
              )}
            </div>

            <div className="line-body">
              <p className="transcript-stream__text font-script">
                {highlightText(line.text, flaggedPhrases)}
              </p>
            </div>
          </div>
        )
      })}

      {/* Interim result */}
      {interimText && (
        <div className="transcript-stream__line transcript-stream__line--interim">
          <div className="line-header">
            <span className="speaker-tag speaker-tag--interim text-xs font-mono">
              <span className="dot-flashing" /> ANALYZING
            </span>
            <span className="transcript-stream__time font-mono text-xs">LIVE</span>
          </div>
          <div className="line-body">
            <p className="transcript-stream__text font-script transcript-stream__interim-text">
              {interimText}
            </p>
          </div>
        </div>
      )}

      <div ref={bottomRef} aria-hidden="true" />
    </div>
  )
}

/** Highlights flagged keywords inside transcript string */
function highlightText(text, flaggedPhrases = []) {
  if (!flaggedPhrases || flaggedPhrases.length === 0) return text
  // Escape regex chars
  const pattern = flaggedPhrases
    .filter(p => p && p.trim().length > 1)
    .map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|')

  if (!pattern) return text

  const regex = new RegExp(`(${pattern})`, 'gi')
  const parts = text.split(regex)

  return parts.map((part, index) =>
    regex.test(part) ? (
      <mark key={index} className="scam-highlight">
        {part}
      </mark>
    ) : (
      part
    )
  )
}

/** Format ISO timestamp to MM:SS */
function formatTime(iso) {
  if (!iso) return '--:--'
  try {
    const d = new Date(iso)
    const m = String(d.getMinutes()).padStart(2, '0')
    const s = String(d.getSeconds()).padStart(2, '0')
    return `${m}:${s}`
  } catch {
    return '--:--'
  }
}

export default TranscriptStream
