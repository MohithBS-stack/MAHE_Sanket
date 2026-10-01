import { useMemo } from 'react'
import './RiskGauge.css'

/**
 * RiskGauge — radial SVG gauge component with cyber-defense styling.
 *
 * @param {number}  score     0–100 risk score
 * @param {string}  label     status label ("Safe", "Caution", "Danger")
 * @param {boolean} animated  whether to animate arc transitions (default true)
 */
function RiskGauge({ score = 0, label = 'Listening', animated = true }) {
  const clampedScore = Math.max(0, Math.min(100, Math.round(score)))

  const riskClass = useMemo(() => {
    if (clampedScore >= 70) return 'danger'
    if (clampedScore >= 40) return 'caution'
    return 'safe'
  }, [clampedScore])

  // SVG arc geometry
  const size = 220
  const strokeWidth = 14
  const radius = (size - strokeWidth) / 2 - 10
  const cx = size / 2
  const cy = size / 2
  const circumference = 2 * Math.PI * radius
  // Arc spans 260° (bottom-left to bottom-right)
  const arcSweep = 260
  const arcLength = circumference * (arcSweep / 360)
  const dashOffset = arcLength - (arcLength * clampedScore) / 100
  const startAngle = 140

  // Tick marks
  const ticks = [0, 20, 40, 60, 80, 100]

  return (
    <div
      className={`risk-gauge risk-gauge--${riskClass}`}
      role="meter"
      aria-valuenow={clampedScore}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Risk level: ${clampedScore}% — ${label}`}
    >
      <svg
        className="risk-gauge__svg"
        viewBox={`0 0 ${size} ${size}`}
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="gaugeSafeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00f2c3" />
            <stop offset="100%" stopColor="#2bb3a3" />
          </linearGradient>
          <linearGradient id="gaugeCautionGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffb74d" />
            <stop offset="100%" stopColor="#f59e0b" />
          </linearGradient>
          <linearGradient id="gaugeDangerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ff3366" />
            <stop offset="100%" stopColor="#d6294b" />
          </linearGradient>
          <filter id="gaugeGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Outer decorative ticks */}
        {ticks.map((t) => {
          const angle = (startAngle + (t / 100) * arcSweep) * (Math.PI / 180)
          const tickR1 = radius + 10
          const tickR2 = radius + 15
          const x1 = cx + tickR1 * Math.cos(angle)
          const y1 = cy + tickR1 * Math.sin(angle)
          const x2 = cx + tickR2 * Math.cos(angle)
          const y2 = cy + tickR2 * Math.sin(angle)
          const isDangerZone = t >= 70
          return (
            <line
              key={t}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={isDangerZone ? 'rgba(255, 51, 102, 0.4)' : 'rgba(255, 255, 255, 0.15)'}
              strokeWidth={t === 40 || t === 70 ? 2 : 1}
            />
          )
        })}

        {/* Track (background arc) */}
        <circle
          className="risk-gauge__track"
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeDasharray={`${arcLength} ${circumference - arcLength}`}
          strokeDashoffset={0}
          strokeLinecap="round"
          transform={`rotate(${startAngle} ${cx} ${cy})`}
        />

        {/* Active arc */}
        <circle
          className={`risk-gauge__arc ${animated ? 'risk-gauge__arc--animated' : ''}`}
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeDasharray={`${arcLength} ${circumference - arcLength}`}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          stroke={`url(#${riskClass === 'danger' ? 'gaugeDangerGrad' : riskClass === 'caution' ? 'gaugeCautionGrad' : 'gaugeSafeGrad'})`}
          filter="url(#gaugeGlow)"
          transform={`rotate(${startAngle} ${cx} ${cy})`}
        />

        {/* Center score readout */}
        <foreignObject x={cx - 65} y={cy - 48} width="130" height="96">
          <div className="risk-gauge__center" xmlns="http://www.w3.org/1999/xhtml">
            <div className="risk-gauge__score-wrap">
              <span className="risk-gauge__score font-display">{clampedScore}</span>
              <span className="risk-gauge__unit text-xs font-ui">%</span>
            </div>
            <span className="risk-gauge__level font-mono text-xs">
              {clampedScore >= 70 ? 'CRITICAL' : clampedScore >= 40 ? 'SUSPECT' : 'NORMAL'}
            </span>
          </div>
        </foreignObject>
      </svg>

      {/* Status label chip */}
      <div className={`risk-gauge__label chip chip--${riskClass}`}>
        <span className={`risk-gauge__dot risk-gauge__dot--${riskClass}`} />
        <span className="text-xs font-medium font-ui">{label}</span>
      </div>
    </div>
  )
}

export default RiskGauge
