import { DateTime } from 'luxon'
import { Link } from 'react-router-dom'
import { appZone } from '../lib/dates'
import {
  dayRhythm,
  formatDayRhythmCaption,
  nowOnDayPct,
  type EatingSpan,
} from '../lib/fasting'
import { getLookups, periodById } from '../lib/lookups'
import type { Meal } from '../lib/types'

const AXIS = ['12a', '6a', '12p', '6p', '12a'] as const

type DayRhythmBarProps = {
  meals: Meal[]
  dayKey: string
  now?: DateTime
  compact?: boolean
  linkMeals?: boolean
  fastStartedAt?: DateTime | null
}

function mealById(meals: Meal[], id: string): Meal | undefined {
  return meals.find((meal) => meal.id === id)
}

function spanTitle(span: EatingSpan, meals: Meal[]): string {
  const named = span.mealIds.map((id) => mealById(meals, id)).filter((meal): meal is Meal => Boolean(meal))
  if (named.length === 0) return 'Eating'
  return named
    .map((meal) => {
      const period = periodById(meal.meal_period_id, getLookups())?.label ?? 'Meal'
      return `${period} · ${span.start.toFormat('t')}–${span.end.toFormat('t')}`
    })
    .join(', ')
}

export function DayRhythmTrack({
  meals,
  dayKey,
  now,
  compact = false,
  linkMeals = false,
}: DayRhythmBarProps) {
  const zone = meals[0]?.tz_name || appZone()
  const rhythm = dayRhythm(meals, dayKey, zone)
  const nowPct = now ? nowOnDayPct(now, dayKey, zone) : null
  return (
    <div className={`day-rhythm-track${compact ? ' compact' : ''}`}>
      {rhythm.eating.map((span) => {
        const title = spanTitle(span, meals)
        const style = {
          left: `${span.leftPct}%`,
          width: `${Math.max(span.widthPct, compact ? 1.4 : 1.8)}%`,
        }
        const className = 'day-rhythm-eat'
        if (linkMeals && span.mealIds.length === 1) {
          return (
            <Link
              key={span.mealIds.join('-')}
              className={className}
              style={style}
              to={`/meals/${span.mealIds[0]}`}
              title={title}
              aria-label={title}
            />
          )
        }
        return <span key={span.mealIds.join('-') || `${span.leftPct}`} className={className} style={style} title={title} />
      })}
      {nowPct != null ? (
        <>
          <span className="day-rhythm-future" style={{ left: `${nowPct}%` }} />
          <span className="day-rhythm-now" style={{ left: `${nowPct}%` }} title="Now" />
        </>
      ) : null}
    </div>
  )
}

export function DayRhythmBar({
  meals,
  dayKey,
  now,
  linkMeals = true,
  fastStartedAt,
}: DayRhythmBarProps) {
  const zone = meals[0]?.tz_name || appZone()
  const rhythm = dayRhythm(meals, dayKey, zone)
  const viewedDay = DateTime.fromISO(dayKey, { zone }).set({ hour: 12 })
  const caption = formatDayRhythmCaption(rhythm, { fastStartedAt, now: now ?? viewedDay })
  return (
    <div className="day-rhythm">
      <DayRhythmTrack meals={meals} dayKey={dayKey} now={now} linkMeals={linkMeals} />
      <div className="day-rhythm-axis" aria-hidden="true">
        {AXIS.map((label, index) => (
          <span key={`${label}-${index}`}>{label}</span>
        ))}
      </div>
      <div className="day-rhythm-meta">
        <p className="day-rhythm-caption">{caption}</p>
        <p className="day-rhythm-legend" aria-hidden="true">
          <span>
            <i className="day-rhythm-swatch eat" />
            Eating
          </span>
          <span>
            <i className="day-rhythm-swatch fast" />
            Fasting
          </span>
        </p>
      </div>
    </div>
  )
}

