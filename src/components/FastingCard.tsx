import { DateTime } from 'luxon'
import { formatTime } from '../lib/dates'
import { currentFasting, formatFastDuration, mealEndedAt, overnightFastMinutes } from '../lib/fasting'
import { getLookups, periodById } from '../lib/lookups'
import type { Meal } from '../lib/types'

type FastingCardProps = {
  viewingToday: boolean
  lastMeal: Meal | null
  previousMeal: Meal | null
  firstMeal: Meal | null
  now: DateTime<boolean>
}

function periodLabel(meal: Meal): string {
  return periodById(meal.meal_period_id, getLookups())?.label ?? 'meal'
}

export function FastingCard({ viewingToday, lastMeal, previousMeal, firstMeal, now }: FastingCardProps) {
  if (viewingToday) {
    const status = currentFasting(lastMeal, now)
    if (status.kind === 'none') return null
    if (status.kind === 'eating') {
      return (
        <section className="card last-ate fasting-card">
          <p className="last-ate-label">Eating</p>
          <p className="muted">
            {status.remainingMinutes < 1
              ? 'Wrapping up'
              : `${formatFastDuration(status.remainingMinutes)} left`}
            {' · '}
            {periodLabel(status.meal)}
          </p>
        </section>
      )
    }
    return (
      <section className="card last-ate fasting-card">
        <p className="last-ate-label">
          Fasting {status.elapsedMinutes < 1 ? 'just started' : formatFastDuration(status.elapsedMinutes)}
        </p>
        <p className="muted">
          Since {periodLabel(status.meal)} at {mealEndedAt(status.meal).toFormat('t')}
        </p>
      </section>
    )
  }

  const overnight = overnightFastMinutes(previousMeal, firstMeal)
  if (overnight == null || !previousMeal || !firstMeal) return null

  return (
    <section className="card last-ate fasting-card">
      <p className="last-ate-label">Fasted {formatFastDuration(overnight)}</p>
      <p className="muted">
        Overnight, until {periodLabel(firstMeal).toLowerCase()} at {formatTime(firstMeal.eaten_at, firstMeal.tz_name)}
      </p>
    </section>
  )
}
