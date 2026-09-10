import { DateTime } from 'luxon'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { DayRhythmBar } from './DayRhythmBar'
import { formatClockOnDay, formatTime } from '../lib/dates'
import {
  collectRhythmMeals,
  currentFasting,
  fastingDayNumber,
  formatFastDuration,
  formatFastingKicker,
  formatFastingSinceLine,
  isMultiDayFast,
  mealEndedAt,
  mealStartedAt,
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
  meals: Meal[]
  dayKey: string
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

export function FastingCard({
  viewingToday,
  lastMeal,
  previousMeal,
  firstMeal,
  meals,
  dayKey,
  addHref,
}: FastingCardProps) {
  const [nowMs, setNowMs] = useState(() => Date.now())

  useEffect(() => {
    if (!viewingToday) return
    const id = window.setInterval(() => setNowMs(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [viewingToday])

  const now = DateTime.fromMillis(nowMs)
  const rhythmMeals = useMemo(
    () => collectRhythmMeals(meals, [previousMeal, lastMeal]),
    [meals, previousMeal, lastMeal],
  )
  const fastStartedAt = lastMeal
    ? mealEndedAt(lastMeal)
    : previousMeal
      ? mealEndedAt(previousMeal)
      : null
  const bar = (
    <DayRhythmBar
      meals={rhythmMeals}
      dayKey={dayKey}
      now={viewingToday ? now : undefined}
      linkMeals
      fastStartedAt={fastStartedAt}
    />
  )

  if (viewingToday) {
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
          {bar}
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
            {periodLabel(status.meal)} · fast starts {formatClockOnDay(end, now)}
          </p>
          {bar}
        </section>
      )
    }

    const elapsedSeconds = Math.max(0, Math.round(now.diff(end, 'seconds').seconds))
    return (
      <section className="card last-ate fasting-card">
        <p className="composer-kicker">{formatFastingKicker(status.elapsedMinutes)}</p>
        <FastClock
          totalSeconds={elapsedSeconds}
          label={`Fasting ${formatFastDuration(status.elapsedMinutes)}`}
        />
        <p className="muted">{formatFastingSinceLine(periodLabel(status.meal), end, now)}</p>
        {bar}
      </section>
    )
  }

  const overnight = overnightFastMinutes(previousMeal, firstMeal)
  const multiDay = overnight != null && isMultiDayFast(overnight)
  const previousEnd = previousMeal ? mealEndedAt(previousMeal) : null

  if (overnight != null && firstMeal && previousMeal && previousEnd) {
    const until = `until ${periodLabel(firstMeal).toLowerCase()} at ${formatTime(firstMeal.eaten_at, firstMeal.tz_name)}`
    return (
      <section className="card last-ate fasting-card">
        <p className="composer-kicker">{multiDay ? `Fasting · day ${fastingDayNumber(overnight)}` : 'Overnight'}</p>
        <p className="last-ate-label">Fasted {formatFastDuration(overnight)}</p>
        <p className="muted">
          {multiDay
            ? `From ${periodLabel(previousMeal).toLowerCase()} ${formatClockOnDay(previousEnd, mealStartedAt(firstMeal))} ${until}`
            : `Until ${periodLabel(firstMeal).toLowerCase()} at ${formatTime(firstMeal.eaten_at, firstMeal.tz_name)}`}
        </p>
        {bar}
      </section>
    )
  }

  if (previousMeal && previousEnd && !firstMeal) {
    const viewedDay = DateTime.fromISO(dayKey, { zone: previousEnd.zoneName || undefined }).set({ hour: 12 })
    return (
      <section className="card last-ate fasting-card">
        <p className="composer-kicker">Fasting</p>
        <p className="last-ate-label">Fasted all day</p>
        <p className="muted">{formatFastingSinceLine(periodLabel(previousMeal), previousEnd, viewedDay)}</p>
        {bar}
      </section>
    )
  }

  return (
    <section className="card last-ate fasting-card">
      <p className="composer-kicker">Day</p>
      <p className="muted">Eating and fasting for this day.</p>
      {bar}
    </section>
  )
}
