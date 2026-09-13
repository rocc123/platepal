import { useMemo, useState } from 'react'
import {
  filterPreviousFoods,
  previousFoodDetail,
  type PreviousFood,
} from '../lib/previousFoods'
import type { MealItem } from '../lib/types'

export function PreviousFoodPicker({
  foods,
  loading = false,
  emptyHint = 'Foods you log show up here. Search and tap one — no extra save step.',
  onPick,
}: {
  foods: PreviousFood[]
  loading?: boolean
  emptyHint?: string
  onPick: (item: MealItem) => void
}) {
  const [query, setQuery] = useState('')
  const filtered = useMemo(() => filterPreviousFoods(foods, query), [foods, query])

  if (loading) return <p className="status">Loading foods you have logged…</p>

  return (
    <div className="saved-picker">
      {foods.length ? (
        <label className="field">
          <span>Find a previous food</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="cheese, oats, leftover chili"
            autoComplete="off"
          />
        </label>
      ) : null}
      {foods.length === 0 ? <p className="helper-copy">{emptyHint}</p> : null}
      {foods.length > 0 && filtered.length === 0 ? (
        <p className="helper-copy">No previous foods match that name.</p>
      ) : null}
      {filtered.length ? (
        <ul className="hit-list saved-hits">
          {filtered.map((food) => (
            <li key={food.key}>
              <button type="button" className="hit saved-hit" onClick={() => onPick(food.item)}>
                <strong>{food.item.name}</strong>
                <span>{previousFoodDetail(food.item)}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

export function PreviousFoodsShelf({
  foods,
  loading = false,
  onPick,
}: {
  foods: PreviousFood[]
  loading?: boolean
  onPick: (item: MealItem) => void
}) {
  return (
    <div className="saved-shelf foods-shelf">
      <div className="saved-shelf-head">
        <p className="composer-kicker">Your foods</p>
        <p className="helper-copy">
          {loading
            ? 'Looking up foods you already logged…'
            : foods.length
              ? 'Search and tap one to reuse the last numbers. Edit the portion if this time is different.'
              : 'Nothing extra to save — after you log a food once, it shows up here.'}
        </p>
      </div>
      {loading || foods.length ? (
        <PreviousFoodPicker foods={foods} loading={loading} onPick={onPick} />
      ) : null}
    </div>
  )
}
