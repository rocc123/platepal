import { DateTime } from 'luxon'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { formatTime } from '../lib/dates'
import {
  currentFasting,
  formatFastDuration,
  mealEndedAt,
  overnightFastMinutes,
  splitFastSeconds,
} from '../lib/fasting'
import { getLookups, periodById } from '../lib/lookups'
import type { Meal } from '../lib/types'

type FastingCardProps = {
  viewingToday: boolean
  lastMeal: Meal | null
  previousMeal: Meal | null
  firstMeal: Meal | null
  addHref: string
}

function periodLabel(meal: Meal): string {
  return periodById(meal.meal_period_id, getLookups())?.label ?? 'meal'
}

function FastClock({ totalSeconds, label }: { totalSeconds: number; label: string }) {
  const { hours, minutes, seconds } = splitFastSeconds(totalSeconds)
  return (
    <p className="fast-clock" aria-live="polite" aria-label={label}>
      {hours > 0 ? (
        <span className="fast-unit">
          <strong>{hours}</strong>
          <em>h</em>
        </span>
      ) : null}
      <span className="fast-unit">
        <strong>{hours > 0 ? String(minutes).padStart(2, '0') : minutes}</strong>
        <em>m</em>
      </span>
      <span className="fast-unit">
        <strong>{String(seconds).padStart(2, '0')}</strong>
        <em>s</em>
      </span>
    </p>
  )
}

export function FastingCard({ viewingToday, lastMeal, previousMeal, firstMeal, addHref }: FastingCardProps) {
  const [nowMs, setNowMs] = useState(() => Date.now())

  useEffect(() => {
    if (!viewingToday) return
    const id = window.setInterval(() => setNowMs(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [viewingToday])

  if (viewingToday) {
    const now = DateTime.fromMillis(nowMs)
    const status = currentFasting(lastMeal, now)
    if (status.kind === 'none') {
      return (
        <section className="card last-ate fasting-card fasting-empty">
          <p className="composer-kicker">Fasting</p>
          <p className="last-ate-label">Enter your last meal</p>
          <p className="muted">
            The clock starts when that meal ends. Add what you last ate — even if it was yesterday —
            and we’ll count from there.
          </p>
          <Link className="btn linkish" to={addHref}>
            Add last meal
          </Link>
        </section>
      )
    }

    const end = mealEndedAt(status.meal)
    if (status.kind === 'eating') {
      const remainingSeconds = Math.max(0, Math.round(end.diff(now, 'seconds').seconds))
      return (
        <section className="card last-ate fasting-card">
          <p className="composer-kicker">Eating</p>
          <FastClock
            totalSeconds={remainingSeconds}
            label={`${formatFastDuration(status.remainingMinutes)} left in this meal`}
          />
          <p className="muted">
            {periodLabel(status.meal)} · fast starts at {end.toFormat('t')}
          </p>
        </section>
      )
    }

    const elapsedSeconds = Math.max(0, Math.round(now.diff(end, 'seconds').seconds))
    return (
      <section className="card last-ate fasting-card">
        <p className="composer-kicker">Fasting</p>
        <FastClock
          totalSeconds={elapsedSeconds}
          label={`Fasting ${formatFastDuration(status.elapsedMinutes)}`}
        />
        <p className="muted">
          Since {periodLabel(status.meal).toLowerCase()} at {end.toFormat('t')}
        </p>
      </section>
    )
  }

  const overnight = overnightFastMinutes(previousMeal, firstMeal)
  if (overnight == null || !previousMeal || !firstMeal) return null

  return (
    <section className="card last-ate fasting-card">
      <p className="composer-kicker">Overnight</p>
      <p className="last-ate-label">Fasted {formatFastDuration(overnight)}</p>
      <p className="muted">
        Until {periodLabel(firstMeal).toLowerCase()} at {formatTime(firstMeal.eaten_at, firstMeal.tz_name)}
      </p>
    </section>
  )
}
