import type { Meal, MealItem } from './types'

export type NutritionTotals = {
  calories: number
  protein_g: number
  fiber_g: number
  carbs_g: number
  fat_g: number
}

export function emptyTotals(): NutritionTotals {
  return { calories: 0, protein_g: 0, fiber_g: 0, carbs_g: 0, fat_g: 0 }
}

export function roundNutrition(totals: NutritionTotals): NutritionTotals {
  return {
    calories: Math.round(totals.calories),
    protein_g: Math.round(totals.protein_g * 10) / 10,
    fiber_g: Math.round(totals.fiber_g * 10) / 10,
    carbs_g: Math.round(totals.carbs_g * 10) / 10,
    fat_g: Math.round(totals.fat_g * 10) / 10,
  }
}

export function sumItems(items: MealItem[]): NutritionTotals {
  return roundNutrition(
    items.reduce((acc, item) => {
      acc.calories += item.calories || 0
      acc.protein_g += item.protein_g || 0
      acc.fiber_g += item.fiber_g || 0
      acc.carbs_g += item.carbs_g || 0
      acc.fat_g += item.fat_g || 0
      return acc
    }, emptyTotals()),
  )
}

export function sumMeals(meals: Meal[]): NutritionTotals {
  return roundNutrition(
    meals.reduce((acc, meal) => {
      acc.calories += meal.calories || 0
      acc.protein_g += meal.protein_g || 0
      acc.fiber_g += meal.fiber_g || 0
      acc.carbs_g += meal.carbs_g || 0
      acc.fat_g += meal.fat_g || 0
      return acc
    }, emptyTotals()),
  )
}
