import type { Lookups } from '../lib/lookups'

type MealWhenProps = {
  date: string
  time: string
  periodId: number
  lookups: Lookups
  onDateChange: (date: string) => void
  onTimeChange: (time: string) => void
  onPeriodChange: (periodId: number) => void
}

export function MealWhen({
  date,
  time,
  periodId,
  lookups,
  onDateChange,
  onTimeChange,
  onPeriodChange,
}: MealWhenProps) {
  return (
    <div className="when">
      <div className="item-grid">
        <label className="field">
          <span>Date</span>
          <input type="date" value={date} onChange={(event) => onDateChange(event.target.value)} />
        </label>
        <label className="field">
          <span>Time</span>
          <input type="time" value={time} onChange={(event) => onTimeChange(event.target.value)} />
        </label>
      </div>
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
}
