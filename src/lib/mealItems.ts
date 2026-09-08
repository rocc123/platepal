import type { MealItem } from './types'

export function blankMealItem(): MealItem {
  return {
    name: '',
    grams: null,
    quantity: 1,
    unit: 'serving',
    grams_per_unit: null,
    calories: 0,
    protein_g: 0,
    fiber_g: 0,
    carbs_g: 0,
    fat_g: 0,
  }
}

export function namedMealItems(items: MealItem[] | null | undefined): MealItem[] {
  return (items ?? []).filter((item) => item.name.trim())
}

export function appendMealItems(current: MealItem[] | null | undefined, incoming: MealItem[]): MealItem[] {
  const kept = namedMealItems(current)
  return kept.length ? [...kept, ...incoming] : incoming
}
