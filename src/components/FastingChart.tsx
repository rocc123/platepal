import { DateTime } from 'luxon'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { appZone, localDayKey, weekdayShort } from '../lib/dates'
import { dayRhythm } from '../lib/fasting'
import type { Meal } from '../lib/types'
import { DayRhythmTrack } from './DayRhythmBar'

export type FastingChartPoint = {
  key: string
  date: Date
}

const AXIS = ['12a', '6a', '12p', '6p', '12a'] as const

export function FastingChart({ points, meals }: { points: FastingChartPoint[]; meals: Meal[] }) {
  const todayKey = localDayKey(new Date())
  const [nowMs, setNowMs] = useState(() => Date.now())

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 30_000)
    return () => window.clearInterval(id)
  }, [])

  const now = DateTime.fromMillis(nowMs)

  return (
    <section className="card chart-card fasting-chart-card">
      <div className="goal-head">
        <span className="goal-label fasting">Eating & fasting</span>
        <span className="muted">12a → 12a</span>
      </div>
      <div className="rhythm-chart">
        <div className="rhythm-chart-axis" aria-hidden="true">
          <span />
          <div className="day-rhythm-axis">
            {AXIS.map((label, index) => (
              <span key={`${label}-${index}`}>{label}</span>
            ))}
          </div>
          <span />
        </div>
        {points.map((point) => {
          const zone = meals[0]?.tz_name || appZone()
          const rhythm = dayRhythm(meals, point.key, zone)
          const label =
            rhythm.mealCount === 0
              ? `${weekdayShort(point.date)} · no meals`
              : `${weekdayShort(point.date)} · ${rhythm.mealCount} ${
                  rhythm.mealCount === 1 ? 'meal' : 'meals'
                } · ${rhythm.mealStarts.map((start) => start.toFormat('t')).join(', ')}`
          return (
            <Link key={point.key} className="rhythm-chart-row" to={`/?d=${point.key}`} title={label}>
              <span>{weekdayShort(point.date)}</span>
              <DayRhythmTrack
                meals={meals}
                dayKey={point.key}
                now={point.key === todayKey ? now : undefined}
                compact
              />
              <span className="chart-num">{rhythm.mealCount === 0 ? '–' : rhythm.mealCount}</span>
            </Link>
          )
        })}
      </div>
      <p className="day-rhythm-legend muted" aria-hidden="true">
        <span>
          <i className="day-rhythm-swatch eat" />
          Eating
        </span>
        <span>
          <i className="day-rhythm-swatch fast" />
          Fasting
        </span>
      </p>
    </section>
  )
}
