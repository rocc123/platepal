import { useEffect, useState } from 'react'
import type { PreviousFood } from '../lib/previousFoods'
import { fetchPreviousFoods } from '../lib/supabase'

export function usePreviousFoods(userId: string) {
  const [foods, setFoods] = useState<PreviousFood[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    fetchPreviousFoods(userId)
      .then((rows) => {
        if (active) setFoods(rows)
      })
      .catch(() => {
        if (active) setFoods([])
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [userId])

  return { foods, loading }
}
