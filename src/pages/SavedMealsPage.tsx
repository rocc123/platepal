import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUser } from '../components/AuthGate'
import { createMeal, deleteSavedMeal, fetchSavedMeals, renameSavedMeal } from '../lib/supabase'
import type { MealItem, SavedMeal } from '../lib/types'

export function SavedMealsPage() {
  const user = useUser()
  const navigate = useNavigate()
  const [meals, setMeals] = useState<SavedMeal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

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
      const items = (saved.items ?? []) as MealItem[]
      await createMeal(user.id, {
        note: saved.note || saved.name,
        source: 'saved',
        eaten_at: new Date().toISOString(),
        calories: saved.calories,
        protein_g: saved.protein_g,
        fiber_g: saved.fiber_g,
        carbs_g: saved.carbs_g,
        fat_g: saved.fat_g,
        confidence: null,
        items: items.length
          ? items
          : [
              {
                name: saved.name,
                grams: null,
                calories: saved.calories,
                protein_g: saved.protein_g,
                fiber_g: saved.fiber_g,
                carbs_g: saved.carbs_g,
                fat_g: saved.fat_g,
              },
            ],
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
      setError(err instanceof Error ? err.message : 'Could not delete template.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="page">
      <h1>Saved</h1>
      {loading ? <p className="status">Loading…</p> : null}
      {error ? <p className="error">{error}</p> : null}
      {!loading && meals.length === 0 ? (
        <p className="status">No templates yet. Save one from a meal.</p>
      ) : (
        <div className="meal-list">
          {meals.map((meal) => (
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
                      {meal.protein_g}g protein · {meal.fiber_g}g fiber
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
