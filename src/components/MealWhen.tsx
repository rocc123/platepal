import { dateTimeFromInputs } from '../lib/dates'
import { DEFAULT_MEAL_DURATION_MINUTES, fastingStartsLabel, parseDurationMinutes } from '../lib/fasting'
import type { Lookups } from '../lib/lookups'

type MealWhenProps = {
  date: string
  time: string
  durationMinutes: number
  periodId: number
  lookups: Lookups
  compact?: boolean
  onDateChange: (date: string) => void
  onTimeChange: (time: string) => void
  onDurationChange: (minutes: number) => void
  onPeriodChange: (periodId: number) => void
}

function whenSummary(date: string, time: string, durationMinutes: number, periodLabel: string) {
  try {
    const when = dateTimeFromInputs(date, time)
    return `${when.toFormat('ccc, LLL d · t')} · ${periodLabel} · ${durationMinutes} min`
  } catch {
    return `${periodLabel} · ${durationMinutes} min`
  }
}

export function MealWhen({
  date,
  time,
  durationMinutes,
  periodId,
  lookups,
  compact = false,
  onDateChange,
  onTimeChange,
  onDurationChange,
  onPeriodChange,
}: MealWhenProps) {
  const periodLabel = lookups.periods.find((period) => period.id === periodId)?.label ?? 'Meal'
  let fastingHint = `Default ${DEFAULT_MEAL_DURATION_MINUTES} minutes. Fasting starts when the meal ends.`
  try {
    fastingHint = fastingStartsLabel(dateTimeFromInputs(date, time), durationMinutes)
  } catch {
    // keep the default hint until date/time are valid
  }

  const fields = (
    <div className="when">
      <div className="item-grid when-grid">
        <label className="field">
          <span>Date</span>
          <input type="date" value={date} onChange={(event) => onDateChange(event.target.value)} />
        </label>
        <label className="field">
          <span>Started</span>
          <input type="time" value={time} onChange={(event) => onTimeChange(event.target.value)} />
        </label>
        <label className="field">
          <span>Ate for (min)</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={240}
            value={durationMinutes}
            onChange={(event) => onDurationChange(parseDurationMinutes(event.target.value))}
          />
        </label>
      </div>
      <p className="muted">{fastingHint}</p>
      <div className="period-toggle" role="group" aria-label="Meal">
        {lookups.periods.map((period) => (
          <button
            key={period.id}
            type="button"
            className={period.id === periodId ? 'btn' : 'btn-secondary'}
            onClick={() => onPeriodChange(period.id)}
          >
            {period.label}
          </button>
        ))}
      </div>
    </div>
  )

  if (!compact) return fields

  return (
    <details className="when-fold">
      <summary>
        <span>{whenSummary(date, time, durationMinutes, periodLabel)}</span>
        <em>change if needed</em>
      </summary>
      {fields}
    </details>
  )
}
