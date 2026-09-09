import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { FastingCard } from '../components/FastingCard'
import { GoalBar } from '../components/GoalBar'
import { MealCard } from '../components/MealCard'
import { OtherMacros } from '../components/OtherMacros'
import { useUser } from '../components/AuthGate'
import { addDays, formatDayLabel, isSameLocalDay, localDayKey, parseLocalDayKey, startOfLocalDay } from '../lib/dates'
import { firstMealOfDay } from '../lib/fasting'
import { ensureProfile, fetchLatestMeal, fetchLatestMealBefore, fetchMealsForDay, loadLookups } from '../lib/supabase'
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
  const [lastMeal, setLastMeal] = useState<Meal | null>(null)
  const [previousMeal, setPreviousMeal] = useState<Meal | null>(null)

  const viewingToday = isSameLocalDay(day, new Date())
  const addHref = viewingToday ? '/add' : `/add?d=${localDayKey(day)}`

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
    const dayStartIso = startOfLocalDay(day).toISOString()
    Promise.all([
      ensureProfile(user),
      fetchMealsForDay(user.id, day),
      viewingToday ? fetchLatestMeal(user.id) : Promise.resolve(null),
      fetchLatestMealBefore(user.id, dayStartIso),
      loadLookups(),
    ])
      .then(([nextProfile, nextMeals, latest, previous]) => {
        if (!active) return
        setProfile(nextProfile)
        setMeals(nextMeals)
        setLastMeal(latest)
        setPreviousMeal(previous)
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
  }, [user, day, viewingToday])

  const totals = sumMeals(meals)
  const firstMeal = useMemo(() => firstMealOfDay(meals, localDayKey(day)), [meals, day])

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

      {!loading ? (
        <FastingCard
          viewingToday={viewingToday}
          lastMeal={lastMeal}
          previousMeal={previousMeal}
          firstMeal={firstMeal}
          meals={meals}
          dayKey={localDayKey(day)}
          addHref={addHref}
        />
      ) : null}

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
          ) : null}
          <OtherMacros
            calories={totals.calories}
            carbs={totals.carbs_g}
            fat={totals.fat_g}
            showCalories={!profile.calorie_goal}
          />
        </section>
      ) : null}

      <Link className="btn linkish" to={addHref}>
        Add meal
      </Link>

      <section className="meal-list">
        {!loading && meals.length === 0 ? (
          <div className="empty">
            <p>No meals yet. Add breakfast.</p>
          </div>
        ) : (
          meals.map((meal) => <MealCard key={meal.id} meal={meal} />)
        )}
      </section>
    </div>
  )
}
