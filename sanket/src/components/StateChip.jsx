import './StateChip.css'

/**
 * StateChip — small pill with colored dot + label.
 *
 * frontend-design.md §9: one of three risk colors + "Listening" neutral state.
 * Used in: Console header, History list rows.
 *
 * @param {'safe'|'caution'|'danger'} state  risk state (default: 'safe')
 * @param {string} label  display label (default derived from state)
 */
const STATE_LABELS = {
  safe:    'Listening',
  caution: 'Caution',
  danger:  'Danger',
}

function StateChip({ state = 'safe', label }) {
  const displayLabel = label ?? STATE_LABELS[state] ?? 'Unknown'

  return (
    <span
      className={`state-chip state-chip--${state}`}
      role="status"
      aria-label={`Status: ${displayLabel}`}
    >
      <span className="state-chip__dot" aria-hidden="true" />
      <span className="state-chip__label text-sm font-medium font-ui">
        {displayLabel}
      </span>
    </span>
  )
}

export default StateChip
