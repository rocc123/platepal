import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useUser } from '../components/AuthGate'
import { addDays, localDayKey, mealDayKey, startOfLocalDay, startOfNextLocalDay, weekdayShort } from '../lib/dates'
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
}

function buildDays(range: RangeDays, meals: Meal[]): DayPoint[] {
  const today = startOfLocalDay(new Date())
  const start = addDays(today, -(range - 1))
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
    const totals = sumMeals(byDay.get(key) ?? [])
    points.push({
      key,
      date,
      protein: totals.protein_g,
      fiber: totals.fiber_g,
      calories: totals.calories,
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
}: {
  label: string
  unit: string
  points: DayPoint[]
  goal: number
  variant: 'protein' | 'fiber' | 'calories'
}) {
  const max = Math.max(goal, ...points.map((p) => (variant === 'protein' ? p.protein : variant === 'fiber' ? p.fiber : p.calories)), 1)
  return (
    <section className="card chart-card">
      <div className="goal-head">
        <span className={`goal-label ${variant}`}>{label}</span>
        <span className="muted">
          Goal {goal}
          {unit}
        </span>
      </div>
      <div className="chart" style={{ gridTemplateColumns: `repeat(${points.length}, minmax(0, 1fr))` }}>
        {points.map((point) => {
          const value = variant === 'protein' ? point.protein : variant === 'fiber' ? point.fiber : point.calories
          const height = Math.min(100, (value / max) * 100)
          const goalLine = Math.min(100, (goal / max) * 100)
          return (
            <Link key={point.key} className="chart-col" to={`/?d=${point.key}`} title={`${label} ${value}${unit}`}>
              <div className="chart-track">
                <div className="chart-goal-line" style={{ bottom: `${goalLine}%` }} />
                <div className={`chart-fill ${variant}`} style={{ height: `${height}%` }} />
              </div>
              <span>{weekdayShort(point.date)}</span>
              <span className="chart-num">{Math.round(value)}</span>
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
    const end = startOfNextLocalDay(new Date())
    setLoading(true)
    Promise.all([ensureProfile(user), fetchMealsForRange(user.id, start, end)])
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
  const daysLogged = points.filter((p) => p.protein > 0 || p.fiber > 0 || p.calories > 0).length
  const proteinHits = profile ? points.filter((p) => p.protein >= profile.protein_goal_g).length : 0
  const fiberHits = profile ? points.filter((p) => p.fiber >= profile.fiber_goal_g).length : 0

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
          </p>
          <Chart
            label="Protein"
            unit="g"
            points={points}
            goal={profile.protein_goal_g}
            variant="protein"
          />
          <Chart label="Fiber" unit="g" points={points} goal={profile.fiber_goal_g} variant="fiber" />
          {profile.calorie_goal ? (
            <Chart
              label="Calories"
              unit=" cal"
              points={points}
              goal={profile.calorie_goal}
              variant="calories"
            />
          ) : null}
        </>
      ) : null}
    </div>
  )
}
