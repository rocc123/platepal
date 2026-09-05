import { DateTime } from 'luxon'
import type { MealPeriodRow, MealSourceRow } from './types'

export type Lookups = {
  sources: MealSourceRow[]
  periods: MealPeriodRow[]
}

export const LOOKUP_SEED: Lookups = {
  sources: [
    { id: 1, code: 'photo', label: 'Photo', sort_order: 1 },
    { id: 2, code: 'text', label: 'Text', sort_order: 2 },
    { id: 3, code: 'saved', label: 'Saved', sort_order: 3 },
    { id: 4, code: 'manual', label: 'Manual', sort_order: 4 },
  ],
  periods: [
    { id: 1, code: 'breakfast', label: 'Breakfast', sort_order: 1, start_hour: 5, end_hour: 11 },
    { id: 2, code: 'lunch', label: 'Lunch', sort_order: 2, start_hour: 11, end_hour: 16 },
    { id: 3, code: 'dinner', label: 'Dinner', sort_order: 3, start_hour: 16, end_hour: 22 },
    { id: 4, code: 'snack', label: 'Snack', sort_order: 4, start_hour: 22, end_hour: 5 },
  ],
}

let cache: Lookups = LOOKUP_SEED

export function getLookups(): Lookups {
  return cache
}

export function setLookups(next: Lookups) {
  cache = next
}

export function sourceIdByCode(code: string, lookups = cache): number {
  const row = lookups.sources.find((item) => item.code === code)
  if (!row) throw new Error(`Unknown meal source: ${code}`)
  return row.id
}

export function periodById(id: number, lookups = cache): MealPeriodRow | undefined {
  return lookups.periods.find((item) => item.id === id)
}

export function sourceById(id: number, lookups = cache): MealSourceRow | undefined {
  return lookups.sources.find((item) => item.id === id)
}

function hourInRange(hour: number, start: number, end: number) {
  if (start === end) return true
  if (start < end) return hour >= start && hour < end
  return hour >= start || hour < end
}

export function inferPeriodId(when: DateTime, lookups = cache): number {
  const hour = when.hour
  const match = lookups.periods.find((period) => {
    if (period.start_hour == null || period.end_hour == null) return false
    return hourInRange(hour, period.start_hour, period.end_hour)
  })
  if (match) return match.id
  const snack = lookups.periods.find((period) => period.code === 'snack')
  return snack?.id ?? lookups.periods[lookups.periods.length - 1].id
}
