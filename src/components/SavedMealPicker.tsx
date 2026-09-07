import { useMemo, useState } from 'react'
import { filterSavedMeals } from '../lib/savedMeals'
import type { SavedMeal } from '../lib/types'

type SavedMealPickerProps = {
  meals: SavedMeal[]
  loading?: boolean
  emptyHint?: string
  onPick: (meal: SavedMeal) => void
}

export function SavedMealPicker({
  meals,
  loading = false,
  emptyHint = 'Nothing saved yet. After you log a meal, keep it as a saved meal and give it a name.',
  onPick,
}: SavedMealPickerProps) {
  const [query, setQuery] = useState('')
  const filtered = useMemo(() => filterSavedMeals(meals, query), [meals, query])

  if (loading) return <p className="status">Loading saved meals…</p>

  return (
    <div className="saved-picker">
      {meals.length ? (
        <label className="field">
          <span>Find a saved meal</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Oat Breakfast, chicken bowl…"
            autoComplete="off"
          />
        </label>
      ) : null}
      {meals.length === 0 ? <p className="helper-copy">{emptyHint}</p> : null}
      {meals.length > 0 && filtered.length === 0 ? (
        <p className="helper-copy">No saved meals match that name.</p>
      ) : null}
      {filtered.length ? (
        <ul className="hit-list saved-hits">
          {filtered.map((meal) => {
            const extra = (meal.items ?? []).map((item) => item.name).filter(Boolean).slice(0, 2)
            return (
              <li key={meal.id}>
                <button type="button" className="hit saved-hit" onClick={() => onPick(meal)}>
                  <strong>{meal.name}</strong>
                  <span>
                    {meal.protein_g}g protein · {meal.fiber_g}g fiber
                    {extra.length ? ` · ${extra.join(', ')}` : ''}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}
