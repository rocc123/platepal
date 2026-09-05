type GoalBarProps = {
  label: string
  current: number
  goal: number
  unit?: string
  variant: 'protein' | 'fiber' | 'calories'
}

function formatAmount(value: number, variant: GoalBarProps['variant']) {
  if (variant === 'calories') return String(Math.round(value))
  return String(Math.round(value * 10) / 10)
}

export function GoalBar({ label, current, goal, unit = 'g', variant }: GoalBarProps) {
  const pct = goal > 0 ? Math.min(100, (current / goal) * 100) : 0
  return (
    <div className={`goal ${variant}`}>
      <div className="goal-head">
        <span className="goal-label">{label}</span>
        <span className="goal-value">
          {formatAmount(current, variant)} / {formatAmount(goal, variant)} {unit}
        </span>
      </div>
      <div className="track" aria-hidden="true">
        <div className="fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
