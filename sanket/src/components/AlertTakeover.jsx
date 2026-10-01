import { useEffect, useRef } from 'react'
import './AlertTakeover.css'

/**
 * AlertTakeover — full-screen elder alert (Calm mode, View C).
 *
 * frontend-design.md §5 (Elder Alert screen):
 * - Fixed alarm-crimson background — ignores all theme settings (§3.1)
 * - No glass, no blur, no gradient — brutalist clarity only
 * - Exactly TWO buttons: "I'm okay" (primary) + "Call [Name] now" (secondary)
 * - Native language FIRST, English SECOND — always both visible, never a toggle
 * - 64px minimum touch targets
 * - TTS audio fires simultaneously with screen appearing (caller's responsibility)
 * - Zero decorative motion — only the 150–250ms appear transition
 *
 * @param {boolean}  visible          whether the takeover is showing
 * @param {string}   warningNative    warning text in detected language
 * @param {string}   warningEnglish   English translation (always shown below)
 * @param {string}   contactName      trusted contact name for secondary button
 * @param {Function} onDismiss        "I'm okay" handler
 * @param {Function} onCallContact    "Call [Name]" handler
 * @param {string}   language         detected language code ('hi'|'kn'|'ta')
 */

const NATIVE_LABELS = {
  hi: { ok: 'मैं सुरक्षित हूँ', call: 'अभी {name} को कॉल करें' },
  kn: { ok: 'ನಾನು ಸುರಕ್ಷಿತ', call: 'ಈಗ {name} ಗೆ ಕರೆ ಮಾಡಿ' },
  ta: { ok: 'நான் பாதுகாப்பாக இருக்கிறேன்', call: 'இப்போது {name}-ஐ அழைக்கவும்' },
}

function AlertTakeover({
  visible = false,
  warningNative = 'यह कॉल असली नहीं लग रही',
  warningEnglish = 'This call may not be safe',
  contactName = 'your contact',
  onDismiss,
  onCallContact,
  language = 'hi',
}) {
  const primaryBtnRef = useRef(null)

  // Focus primary button when alert appears (accessibility)
  useEffect(() => {
    if (visible) {
      // Small delay to allow CSS transition to start
      const t = setTimeout(() => primaryBtnRef.current?.focus(), 100)
      return () => clearTimeout(t)
    }
  }, [visible])

  // Trap Escape key to "I'm okay" (guards against accidental dismiss — by design not wired)
  // Per §FR-C3: only two explicit actions, no keyboard shortcut dismiss

  if (!visible) return null

  const labels = NATIVE_LABELS[language] ?? NATIVE_LABELS.hi
  const callLabel = labels.call.replace('{name}', contactName)

  return (
    <div
      className="alert-takeover"
      role="alertdialog"
      aria-modal="true"
      aria-label="Scam call warning"
      aria-live="assertive"
      data-surface="calm"
    >
      <div className="alert-takeover__inner">
        {/* Warning icon */}
        <div className="alert-takeover__icon" aria-hidden="true">⚠</div>

        {/* Warning text — native language FIRST, English SECOND (§FR-C2) */}
        <div className="alert-takeover__message">
          <p className="alert-takeover__native font-script">{warningNative}</p>
          <p className="alert-takeover__english font-ui">{warningEnglish}</p>
        </div>

        {/* Actions — exactly two, no more (§FR-C3) */}
        <div className="alert-takeover__actions">
          {/* Primary: dismiss */}
          <button
            ref={primaryBtnRef}
            className="calm-btn alert-takeover__btn-primary font-script"
            onClick={onDismiss}
            aria-label="I am safe — dismiss warning"
          >
            <span>{labels.ok}</span>
            <span className="alert-takeover__btn-en font-ui">I'm okay</span>
          </button>

          {/* Secondary: call contact */}
          <button
            className="calm-btn alert-takeover__btn-secondary font-script"
            onClick={onCallContact}
            aria-label={`Call ${contactName} now`}
          >
            <span>{callLabel}</span>
            <span className="alert-takeover__btn-en font-ui">Call {contactName} now</span>
          </button>
        </div>
      </div>
    </div>
  )
}

export default AlertTakeover
