import { DateTime } from 'luxon'
import { fromUtc, mealDayKey } from './dates'
import type { Meal } from './types'

export const DEFAULT_MEAL_DURATION_MINUTES = 15
export const MIN_MEAL_DURATION_MINUTES = 0
export const MAX_MEAL_DURATION_MINUTES = 240

export function parseDurationMinutes(value: string | number | null | undefined): number {
  if (value == null || value === '') return DEFAULT_MEAL_DURATION_MINUTES
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return DEFAULT_MEAL_DURATION_MINUTES
  return Math.min(MAX_MEAL_DURATION_MINUTES, Math.max(MIN_MEAL_DURATION_MINUTES, Math.round(n)))
}

export function mealStartedAt(meal: Meal): DateTime {
  return fromUtc(meal.eaten_at, meal.tz_name)
}

export function mealEndedAt(meal: Meal): DateTime {
  return mealStartedAt(meal).plus({ minutes: parseDurationMinutes(meal.duration_minutes) })
}

export function fastingStartsLabel(start: DateTime, durationMinutes: number): string {
  const end = start.plus({ minutes: parseDurationMinutes(durationMinutes) })
  return `Fasting starts ${end.toFormat('t')}`
}

export function formatFastDuration(minutes: number): string {
  const value = Math.max(0, Math.round(minutes))
  if (value < 60) return `${value}m`
  const hours = Math.floor(value / 60)
  const rest = value % 60
  if (rest === 0) return `${hours}h`
  return `${hours}h ${rest}m`
}

export type FastingStatus =
  | { kind: 'none' }
  | { kind: 'eating'; meal: Meal; remainingMinutes: number }
  | { kind: 'fasting'; meal: Meal; elapsedMinutes: number }

export function currentFasting(lastMeal: Meal | null, now: DateTime<boolean> = DateTime.local()): FastingStatus {
  if (!lastMeal) return { kind: 'none' }
  const end = mealEndedAt(lastMeal)
  if (now < end) {
    return {
      kind: 'eating',
      meal: lastMeal,
      remainingMinutes: Math.max(0, Math.round(end.diff(now, 'minutes').minutes)),
    }
  }
  return {
    kind: 'fasting',
    meal: lastMeal,
    elapsedMinutes: Math.max(0, Math.round(now.diff(end, 'minutes').minutes)),
  }
}

export function overnightFastMinutes(
  previous: Meal | null,
  firstOfDay: Meal | null,
  now?: DateTime<boolean>,
): number | null {
  if (!previous) return null
  const start = mealEndedAt(previous)
  const end = firstOfDay ? mealStartedAt(firstOfDay) : now
  if (!end) return null
  return Math.max(0, Math.round(end.diff(start, 'minutes').minutes))
}

export function lastMealBefore(meals: Meal[], beforeIso: string): Meal | null {
  return (
    meals
      .filter((meal) => meal.eaten_at < beforeIso)
      .sort((a, b) => b.eaten_at.localeCompare(a.eaten_at))[0] ?? null
  )
}

export function firstMealOfDay(meals: Meal[], dayKey: string): Meal | null {
  return (
    meals
      .filter((meal) => mealDayKey(meal.eaten_at, meal.tz_name) === dayKey)
      .sort((a, b) => a.eaten_at.localeCompare(b.eaten_at))[0] ?? null
  )
}

