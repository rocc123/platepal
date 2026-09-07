import { DateTime } from 'luxon'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useUser } from '../components/AuthGate'
import { FastingChart } from '../components/FastingChart'
import { addDays, localDayKey, mealDayKey, startOfLocalDay, startOfNextLocalDay, weekdayShort } from '../lib/dates'
import { firstMealOfDay, lastMealBefore, overnightFast } from '../lib/fasting'
import { ensureProfile, fetchMealsForRange } from '../lib/supabase'
import { sumMeals } from '../lib/totals'
import type { Meal, Profile } from '../lib/types'

type RangeDays = 7 | 14 | 30

type DayPoint = {
  key: string
  date: Date
  protein: number
  fiber: number
  calories: number
  carbs: number
  fat: number
  fastingMinutes: number | null
  fastStart: DateTime | null
  fastEnd: DateTime | null
  inProgress: boolean
}

function buildDays(range: RangeDays, meals: Meal[], now: DateTime<boolean> = DateTime.local()): DayPoint[] {
  const today = startOfLocalDay(new Date())
  const start = addDays(today, -(range - 1))
  const todayKey = localDayKey(today)
  const byDay = new Map<string, Meal[]>()
  for (const meal of meals) {
    const key = mealDayKey(meal.eaten_at, meal.tz_name)
    const list = byDay.get(key) ?? []
    list.push(meal)
    byDay.set(key, list)
  }
  const points: DayPoint[] = []
  for (let i = 0; i < range; i += 1) {
    const date = addDays(start, i)
    const key = localDayKey(date)
    const dayMeals = byDay.get(key) ?? []
    const totals = sumMeals(dayMeals)
    const first = firstMealOfDay(meals, key)
    const isToday = key === todayKey
    const previous = lastMealBefore(meals, first?.eaten_at ?? (isToday ? now.toUTC().toISO() ?? '' : ''))
    const overnight = overnightFast(previous, first, isToday && !first ? now : undefined)
    points.push({
      key,
      date,
      protein: totals.protein_g,
      fiber: totals.fiber_g,
      calories: totals.calories,
      carbs: totals.carbs_g,
      fat: totals.fat_g,
      fastingMinutes: overnight?.minutes ?? null,
      fastStart: overnight?.start ?? null,
      fastEnd: overnight?.end ?? null,
      inProgress: Boolean(isToday && overnight && !first),
    })
  }
  return points
}

function Chart({
  label,
  unit,
  points,
  goal,
  variant,
  valueOf,
}: {
  label: string
  unit: string
  points: DayPoint[]
  goal?: number
  variant: 'protein' | 'fiber' | 'calories' | 'carbs' | 'fat'
  valueOf: (point: DayPoint) => number | null
}) {
  const values = points.map(valueOf)
  const max = Math.max(goal ?? 0, ...values.map((value) => value ?? 0), 1)
  return (
    <section className="card chart-card">
      <div className="goal-head">
        <span className={`goal-label ${variant}`}>{label}</span>
        <span className="muted">{goal != null ? `Goal ${goal}${unit}` : ''}</span>
      </div>
      <div className="chart" style={{ gridTemplateColumns: `repeat(${points.length}, minmax(0, 1fr))` }}>
        {points.map((point, index) => {
          const value = values[index]
          const height = value == null ? 0 : Math.min(100, (value / max) * 100)
          const goalLine = goal != null ? Math.min(100, (goal / max) * 100) : null
          const title = value == null ? `${label} —` : `${label} ${Math.round(value)}${unit}`
          return (
            <Link key={point.key} className="chart-col" to={`/?d=${point.key}`} title={title}>
              <div className="chart-track">
                {goalLine != null ? <div className="chart-goal-line" style={{ bottom: `${goalLine}%` }} /> : null}
                <div className={`chart-fill ${variant}`} style={{ height: `${height}%` }} />
              </div>
              <span>{weekdayShort(point.date)}</span>
              <span className="chart-num">{value == null ? '–' : Math.round(value)}</span>
            </Link>
          )
        })}
      </div>
    </section>
  )
}

export function ChartsPage() {
  const user = useUser()
  const [range, setRange] = useState<RangeDays>(7)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [meals, setMeals] = useState<Meal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    const start = startOfLocalDay(addDays(new Date(), -(range - 1)))
    const lookback = addDays(start, -7)
    const end = startOfNextLocalDay(new Date())
    setLoading(true)
    Promise.all([ensureProfile(user), fetchMealsForRange(user.id, lookback, end)])
      .then(([nextProfile, nextMeals]) => {
        if (!active) return
        setProfile(nextProfile)
        setMeals(nextMeals)
        setError(null)
      })
      .catch((err: unknown) => {
        if (!active) return
        setError(err instanceof Error ? err.message : 'Could not load charts.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [user, range])

  const points = useMemo(() => buildDays(range, meals), [range, meals])
  const daysLogged = points.filter(
    (p) => p.protein > 0 || p.fiber > 0 || p.calories > 0 || p.carbs > 0 || p.fat > 0,
  ).length
  const proteinHits = profile ? points.filter((p) => p.protein >= profile.protein_goal_g).length : 0
  const fiberHits = profile ? points.filter((p) => p.fiber >= profile.fiber_goal_g).length : 0
  const fastingDays = points.filter((p) => p.fastingMinutes != null).length
  const fastingAvg =
    fastingDays === 0
      ? null
      : Math.round(points.reduce((sum, p) => sum + (p.fastingMinutes ?? 0), 0) / fastingDays / 60)

  return (
    <div className="page">
      <h1>Charts</h1>
      <div className="range-toggle" role="tablist" aria-label="Date range">
        {([7, 14, 30] as RangeDays[]).map((value) => (
          <button
            key={value}
            type="button"
            className={range === value ? 'btn' : 'btn-secondary'}
            onClick={() => setRange(value)}
          >
            {value}d
          </button>
        ))}
      </div>

      {loading ? <p className="status">Loading…</p> : null}
      {error ? <p className="error">{error}</p> : null}

      {!loading && daysLogged === 0 ? (
        <p className="status">No meals in this stretch. Add a few days to see the week.</p>
      ) : null}

      {profile && !loading ? (
        <>
          <p className="lede">
            {proteinHits}/{range} days hit protein · {fiberHits}/{range} days hit fiber
            {fastingAvg != null ? ` · ${fastingAvg}h avg overnight fast` : ''}
          </p>
          <Chart
            label="Protein"
            unit="g"
            points={points}
            goal={profile.protein_goal_g}
            variant="protein"
            valueOf={(point) => point.protein}
          />
          <Chart
            label="Fiber"
            unit="g"
            points={points}
            goal={profile.fiber_goal_g}
            variant="fiber"
            valueOf={(point) => point.fiber}
          />
          {profile.calorie_goal ? (
            <Chart
              label="Calories"
              unit=" cal"
              points={points}
              goal={profile.calorie_goal}
              variant="calories"
              valueOf={(point) => point.calories}
            />
          ) : null}
          <Chart
            label="Carbs"
            unit="g"
            points={points}
            variant="carbs"
            valueOf={(point) => point.carbs}
          />
          <Chart
            label="Fat"
            unit="g"
            points={points}
            variant="fat"
            valueOf={(point) => point.fat}
          />
          <FastingChart points={points} />
        </>
      ) : null}
    </div>
  )
}
