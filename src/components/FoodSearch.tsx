import { useEffect, useMemo, useState } from 'react'
import { enrichUsdaHit, itemFromHit, searchUsdaFoods, type FoodHit } from '../lib/foods'
import { filterPreviousFoods, previousFoodDetail, type PreviousFood } from '../lib/previousFoods'
import type { MealItem } from '../lib/types'

const RECENT_PREVIOUS_LIMIT = 8

export function FoodSearch({
  onPick,
  previousFoods = [],
  label = 'Look up a food',
}: {
  onPick: (item: MealItem, hit?: FoodHit) => void
  previousFoods?: PreviousFood[]
  label?: string
}) {
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<FoodHit[]>([])
  const [loading, setLoading] = useState(false)
  const [picking, setPicking] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const previousHits = useMemo(() => {
    const matched = filterPreviousFoods(previousFoods, query)
    return query.trim() ? matched : matched.slice(0, RECENT_PREVIOUS_LIMIT)
  }, [previousFoods, query])

  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed.length < 2) {
      setHits([])
      setError(null)
      setLoading(false)
      return
    }
    let active = true
    setLoading(true)
    const timer = window.setTimeout(() => {
      searchUsdaFoods(trimmed)
        .then((rows) => {
          if (!active) return
          setHits(rows)
          const previousMatched = filterPreviousFoods(previousFoods, trimmed)
          setError(rows.length || previousMatched.length ? null : 'No foods matched. Try a simpler name.')
        })
        .catch((err: unknown) => {
          if (!active) return
          setHits([])
          setError(err instanceof Error ? err.message : 'USDA lookup failed.')
        })
        .finally(() => {
          if (active) setLoading(false)
        })
    }, 350)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [query, previousFoods])

  return (
    <div className="lookup">
      <label className="field">
        <span>{label}</span>
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="cheese, chicken breast, leftover chili"
          autoComplete="off"
        />
      </label>
      {previousHits.length ? (
        <div className="lookup-group">
          <p className="lookup-kicker">Your foods</p>
          <ul className="hit-list">
            {previousHits.map((food) => (
              <li key={food.key}>
                <button
                  type="button"
                  className="hit saved-hit"
                  disabled={picking != null}
                  onClick={() => {
                    onPick(food.item)
                    setQuery('')
                    setHits([])
                  }}
                >
                  <strong>{food.item.name}</strong>
                  <span>{previousFoodDetail(food.item)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {loading ? <p className="status">Searching USDA…</p> : null}
      {picking != null ? <p className="status">Loading household measures…</p> : null}
      {error && !loading ? <p className="status">{error}</p> : null}
      {hits.length ? (
        <div className="lookup-group">
          {previousHits.length ? <p className="lookup-kicker">USDA</p> : null}
          <ul className="hit-list">
            {hits.map((hit, index) => (
              <li key={`${hit.name}-${index}`}>
                <button
                  type="button"
                  className="hit"
                  disabled={picking != null}
                  onClick={() => {
                    void (async () => {
                      setPicking(index)
                      setError(null)
                      try {
                        const enriched = await enrichUsdaHit(hit)
                        onPick(itemFromHit(enriched), enriched)
                        setQuery('')
                        setHits([])
                      } catch (err) {
                        setError(err instanceof Error ? err.message : 'USDA lookup failed.')
                      } finally {
                        setPicking(null)
                      }
                    })()
                  }}
                >
                  <strong>{hit.name}</strong>
                  <span>
                    {hit.detail} · {hit.per_100g.protein_g}g protein / 100g
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
