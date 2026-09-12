import { defaultSavedMealName, shortFoodLabel } from './mealNames'
import { ensurePortion } from './portions'
import type { MealItem, SavedMeal } from './types'

export { defaultSavedMealName, shortFoodLabel }

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
