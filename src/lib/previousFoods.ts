import { formatPortion } from './portions.ts'
import { formatFocusLine } from './totals.ts'
import type { MealItem } from './types.ts'

export type PreviousFoodRow = {
  item: MealItem
  eaten_at: string
}

export type PreviousFood = {
  key: string
  last_eaten_at: string
  item: MealItem
}

export function foodSearchKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function cloneMealItem(item: MealItem): MealItem {
  return {
    name: item.name.trim(),
    grams: item.grams,
    quantity: item.quantity,
    unit: item.unit,
    grams_per_unit: item.grams_per_unit,
    calories: item.calories,
    protein_g: item.protein_g,
    fiber_g: item.fiber_g,
    carbs_g: item.carbs_g,
    fat_g: item.fat_g,
    measures: item.measures,
    per_100g: item.per_100g,
  }
}

/** Newest first. Same name (ignoring case and extra spaces) keeps the latest numbers. */
export function uniquePreviousFoods(rows: PreviousFoodRow[]): PreviousFood[] {
  const sorted = [...rows].sort((a, b) => b.eaten_at.localeCompare(a.eaten_at))
  const seen = new Set<string>()
  const out: PreviousFood[] = []
  for (const row of sorted) {
    const name = row.item.name.trim()
    if (!name) continue
    const key = foodSearchKey(name)
    if (seen.has(key)) continue
    seen.add(key)
    out.push({
      key,
      last_eaten_at: row.eaten_at,
      item: cloneMealItem(row.item),
    })
  }
  return out
}

export function filterPreviousFoods(foods: PreviousFood[], query: string): PreviousFood[] {
  const needle = foodSearchKey(query)
  if (!needle) return foods
  return foods.filter((food) => foodSearchKey(food.item.name).includes(needle))
}

export function previousFoodDetail(item: MealItem): string {
  const bits: string[] = []
  const portion = formatPortion(item)
  if (portion && portion !== 'Add a portion') bits.push(portion)
  bits.push(formatFocusLine(item.protein_g, item.fiber_g))
  return bits.join(' · ')
}

export function previousFoodAssumption(name: string): string {
  return `From the last time you logged “${name.trim()}”. Change the amount if this portion is different.`
}
