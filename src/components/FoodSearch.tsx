import { useEffect, useState } from 'react'
import { enrichUsdaHit, itemFromHit, searchUsdaFoods, type FoodHit } from '../lib/foods'
import type { MealItem } from '../lib/types'

export function FoodSearch({
  onPick,
  label = 'Look up a food (USDA)',
}: {
  onPick: (item: MealItem, hit: FoodHit) => void
  label?: string
}) {
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<FoodHit[]>([])
  const [loading, setLoading] = useState(false)
  const [picking, setPicking] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

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
          setError(rows.length ? null : 'No foods matched. Try a simpler name.')
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
  }, [query])

  return (
    <div className="lookup">
      <label className="field">
        <span>{label}</span>
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="chicken breast, oats, leftover chili"
          autoComplete="off"
        />
      </label>
      {loading ? <p className="status">Searching…</p> : null}
      {picking != null ? <p className="status">Loading household measures…</p> : null}
      {error && !loading ? <p className="status">{error}</p> : null}
      {hits.length ? (
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
      ) : null}
    </div>
  )
}
