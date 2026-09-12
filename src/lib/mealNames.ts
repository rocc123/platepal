import type { Meal, MealItem } from './types'

function firstClause(value: string): string {
  return value.split(/[,+&]| and /i)[0]?.trim() || value.trim()
}

function capitalizeFirst(value: string): string {
  return value.replace(/^\p{L}/u, (letter) => letter.toUpperCase())
}

/** Drop "200g" / "1 cup" prefixes so a typed note does not become the meal title. */
function stripLeadingAmount(value: string): string {
  return value
    .replace(/^\d+(?:\.\d+)?\s*(?:g|kg|oz|lb|ml|l|cup|cups|tbsp|tsp|serving|servings)?\s+/i, '')
    .trim()
}

export function shortFoodLabel(name: string): string {
  const cleaned = name.replace(/\s+/g, ' ').trim()
  if (!cleaned) return ''
  return capitalizeFirst(stripLeadingAmount(firstClause(cleaned)))
}

export function looksLikeDishTitle(value: string): boolean {
  const trimmed = value.replace(/\s+/g, ' ').trim()
  if (!trimmed) return false
  if (trimmed.length > 42) return false
  if (/[,;]/.test(trimmed)) return false
  return true
}

function composeFoodNames(items: MealItem[]): string {
  const foods = items.map((item) => shortFoodLabel(item.name)).filter(Boolean)
  if (foods.length === 1) return foods[0]
  if (foods.length === 2) return `${foods[0]} + ${foods[1]}`
  if (foods.length === 3) return `${foods[0]} + ${foods[1]} + ${foods[2]}`
  if (foods.length > 3) return `${foods[0]} + ${foods[1]} + ${foods.length - 2} more`
  return ''
}

export function mealNameFromItems(
  items: MealItem[],
  options?: { title?: string | null; note?: string | null; fallback?: string | null },
): string {
  const title = options?.title?.replace(/\s+/g, ' ').trim()
  if (title) return capitalizeFirst(title)

  const fromFoods = composeFoodNames(items)
  if (fromFoods) return fromFoods

  const note = options?.note?.replace(/\s+/g, ' ').trim()
  if (note) return shortFoodLabel(note) || options?.fallback?.trim() || 'Meal'

  return options?.fallback?.trim() || 'Meal'
}

export function displayMealName(meal: Pick<Meal, 'name' | 'note'>, periodLabel?: string | null): string {
  if (meal.name?.trim()) return meal.name.trim()
  const note = meal.note?.trim()
  if (note && looksLikeDishTitle(note)) return shortFoodLabel(note)
  return periodLabel?.trim() || 'Meal'
}

export function defaultSavedMealName(
  items: MealItem[],
  note = '',
  periodLabel?: string | null,
): string {
  const base = mealNameFromItems(items, { note, fallback: 'Meal' })
  if (periodLabel && items.filter((item) => item.name.trim()).length <= 1 && !base.toLowerCase().includes(periodLabel.toLowerCase())) {
    if (base === 'Meal') return periodLabel
    return `${base} ${periodLabel}`
  }
  return base
}
