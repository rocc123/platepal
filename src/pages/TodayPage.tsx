import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { GoalBar } from '../components/GoalBar'
import { MealCard } from '../components/MealCard'
import { useUser } from '../components/AuthGate'
import { addDays, formatDayLabel, isSameLocalDay, localDayKey, parseLocalDayKey } from '../lib/dates'
import { ensureProfile, fetchMealsForDay } from '../lib/supabase'
import { sumMeals } from '../lib/totals'
import type { Meal, Profile } from '../lib/types'

export function TodayPage() {
  const user = useUser()
  const [searchParams, setSearchParams] = useSearchParams()
  const [day, setDay] = useState(() => parseLocalDayKey(searchParams.get('d')) ?? new Date())
  const [profile, setProfile] = useState<Profile | null>(null)
  const [meals, setMeals] = useState<Meal[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  function goTo(next: Date) {
    setDay(next)
    if (isSameLocalDay(next, new Date())) setSearchParams({})
    else setSearchParams({ d: localDayKey(next) })
  }

  useEffect(() => {
    const fromUrl = parseLocalDayKey(searchParams.get('d'))
    if (fromUrl && !isSameLocalDay(fromUrl, day)) setDay(fromUrl)
  }, [searchParams, day])

  useEffect(() => {
    let active = true
    setLoading(true)
    Promise.all([ensureProfile(user), fetchMealsForDay(user.id, day)])
      .then(([nextProfile, nextMeals]) => {
        if (!active) return
        setProfile(nextProfile)
        setMeals(nextMeals)
        setError(null)
      })
      .catch((err: unknown) => {
        if (!active) return
        setError(err instanceof Error ? err.message : 'Could not load today.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [user, day])

  const totals = sumMeals(meals)

  return (
    <div className="page">
      <div className="date-nav">
        <button
          type="button"
          className="icon-btn"
          onClick={() => goTo(addDays(day, -1))}
          aria-label="Previous day"
        >
          ‹
        </button>
        <h1>{formatDayLabel(day)}</h1>
        <button type="button" className="icon-btn" onClick={() => goTo(addDays(day, 1))} aria-label="Next day">
          ›
        </button>
      </div>

      {loading ? <p className="status">Loading…</p> : null}
      {error ? <p className="error">{error}</p> : null}

      {profile && !loading ? (
        <section className="card goal-stack">
          <GoalBar
            label="Protein"
            current={totals.protein_g}
            goal={profile.protein_goal_g}
            variant="protein"
          />
          <GoalBar
            label="Fiber"
            current={totals.fiber_g}
            goal={profile.fiber_goal_g}
            variant="fiber"
          />
          {profile.calorie_goal ? (
            <GoalBar
              label="Calories"
              current={totals.calories}
              goal={profile.calorie_goal}
              unit="cal"
              variant="calories"
            />
          ) : (
            <p className="cal-plain">{Math.round(totals.calories)} cal</p>
          )}
        </section>
      ) : null}

      <Link className="btn linkish" to={isSameLocalDay(day, new Date()) ? '/add' : `/add?d=${localDayKey(day)}`}>
        Add meal
      </Link>

      <section className="meal-list">
        {!loading && meals.length === 0 ? (
          <p className="status">No meals yet. Add breakfast.</p>
        ) : (
          meals.map((meal) => <MealCard key={meal.id} meal={meal} />)
        )}
      </section>
    </div>
  )
}
