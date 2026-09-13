import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUser } from '../components/AuthGate'
import { inferPeriodFromWhen, nowLocal, zoneStamp } from '../lib/dates'
import { DEFAULT_MEAL_DURATION_MINUTES } from '../lib/fasting'
import { sourceIdByCode } from '../lib/lookups'
import { filterSavedMeals, itemsFromSavedMeal } from '../lib/savedMeals'
import { createMeal, deleteSavedMeal, fetchSavedMeals, renameSavedMeal } from '../lib/supabase'
import { formatFocusLine, formatOtherLine } from '../lib/totals'
import type { SavedMeal } from '../lib/types'

export function SavedMealsPage() {
  const user = useUser()
  const navigate = useNavigate()
  const [meals, setMeals] = useState<SavedMeal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const visible = useMemo(() => filterSavedMeals(meals, query), [meals, query])

  async function reload() {
    const rows = await fetchSavedMeals(user.id)
    setMeals(rows)
  }

  useEffect(() => {
    let active = true
    fetchSavedMeals(user.id)
      .then((rows) => {
        if (active) setMeals(rows)
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : 'Could not load saved meals.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [user.id])

  async function cloneMeal(saved: SavedMeal) {
    setBusyId(saved.id)
    setError(null)
    try {
      const items = itemsFromSavedMeal(saved)
      const when = nowLocal()
      await createMeal(user.id, {
        name: saved.name,
        note: saved.note || null,
        source_id: sourceIdByCode('saved'),
        meal_period_id: inferPeriodFromWhen(when),
        duration_minutes: DEFAULT_MEAL_DURATION_MINUTES,
        ...zoneStamp(when),
        calories: saved.calories,
        protein_g: saved.protein_g,
        fiber_g: saved.fiber_g,
        carbs_g: saved.carbs_g,
        fat_g: saved.fat_g,
        confidence: null,
        items,
      })
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not log that meal.')
      setBusyId(null)
    }
  }

  async function onRename(id: string) {
    if (!renameValue.trim()) return
    setBusyId(id)
    setError(null)
    try {
      await renameSavedMeal(id, user.id, renameValue)
      setRenamingId(null)
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not rename.')
    } finally {
      setBusyId(null)
    }
  }

  async function onDelete(id: string) {
    setBusyId(id)
    setError(null)
    try {
      await deleteSavedMeal(id, user.id)
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete saved meal.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="page">
      <h1>Saved meals</h1>
      <p className="lede">Name them something you’ll recognize — Oat Breakfast, gym lunch, Sunday eggs.</p>
      {loading ? <p className="status">Loading…</p> : null}
      {error ? <p className="error">{error}</p> : null}
      {!loading && meals.length > 0 ? (
        <label className="field">
          <span>Look one up</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Oat Breakfast"
            autoComplete="off"
          />
        </label>
      ) : null}
      {!loading && meals.length === 0 ? (
        <p className="status">No saved meals yet. Keep one when you add a meal and give it a name.</p>
      ) : !loading && visible.length === 0 ? (
        <p className="status">No saved meals match that name.</p>
      ) : (
        <div className="meal-list">
          {visible.map((meal) => (
            <article className="card saved-row" key={meal.id}>
              {renamingId === meal.id ? (
                <>
                  <label className="field">
                    <span>Name</span>
                    <input
                      type="text"
                      value={renameValue}
                      onChange={(event) => setRenameValue(event.target.value)}
                    />
                  </label>
                  <div className="row-actions two">
                    <button type="button" className="btn" disabled={busyId === meal.id} onClick={() => onRename(meal.id)}>
                      Save name
                    </button>
                    <button type="button" className="btn-secondary" onClick={() => setRenamingId(null)}>
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <button type="button" className="saved-main" onClick={() => cloneMeal(meal)} disabled={busyId === meal.id}>
                    <strong>{meal.name}</strong>
                    <span className="muted">
                      {formatFocusLine(meal.protein_g, meal.fiber_g)}
                      <br />
                      {formatOtherLine(meal.calories, meal.carbs_g, meal.fat_g)}
                    </span>
                  </button>
                  <div className="row-actions two">
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => {
                        setRenamingId(meal.id)
                        setRenameValue(meal.name)
                      }}
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      className="btn-danger"
                      disabled={busyId === meal.id}
                      onClick={() => onDelete(meal.id)}
                    >
                      Delete
                    </button>
                  </div>
                </>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
