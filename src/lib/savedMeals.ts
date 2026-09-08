import { ensurePortion } from './portions'
import type { MealItem, SavedMeal } from './types'

function firstClause(value: string): string {
  return value.split(/[,+&]| and /i)[0]?.trim() || value.trim()
}

function capitalizeFirst(value: string): string {
  return value.replace(/^\p{L}/u, (letter) => letter.toUpperCase())
}

export function shortFoodLabel(name: string): string {
  return capitalizeFirst(firstClause(name.replace(/\s+/g, ' ').trim()))
}

export function defaultSavedMealName(
  items: MealItem[],
  note = '',
  periodLabel?: string | null,
): string {
  const foods = items.map((item) => shortFoodLabel(item.name)).filter(Boolean)
  let base: string
  if (foods.length === 1) base = foods[0]
  else if (foods.length === 2) base = `${foods[0]} + ${foods[1]}`
  else if (foods.length > 2) base = `${foods[0]} + ${foods.length - 1} more`
  else if (note.trim()) base = shortFoodLabel(note)
  else base = 'Meal'

  if (periodLabel && foods.length <= 1 && !base.toLowerCase().includes(periodLabel.toLowerCase())) {
    return `${base} ${periodLabel}`
  }
  return base
}

export function itemsFromSavedMeal(saved: SavedMeal): MealItem[] {
  const items = (saved.items ?? []).filter((item) => item.name.trim()).map(ensurePortion)
  if (items.length) return items
  return [
    ensurePortion({
      name: saved.name,
      grams: null,
      calories: saved.calories,
      protein_g: saved.protein_g,
      fiber_g: saved.fiber_g,
      carbs_g: saved.carbs_g,
      fat_g: saved.fat_g,
    }),
  ]
}

export function filterSavedMeals(meals: SavedMeal[], query: string): SavedMeal[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return meals
  return meals.filter((meal) => {
    if (meal.name.toLowerCase().includes(needle)) return true
    if (meal.note?.toLowerCase().includes(needle)) return true
    return (meal.items ?? []).some((item) => item.name.toLowerCase().includes(needle))
  })
}
