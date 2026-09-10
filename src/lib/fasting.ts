import { DateTime } from 'luxon'
import { appZone, formatClockOnDay, fromUtc, mealDayKey } from './dates.ts'
import type { Meal } from './types.ts'

export const DEFAULT_MEAL_DURATION_MINUTES = 15
export const MIN_MEAL_DURATION_MINUTES = 0
export const MAX_MEAL_DURATION_MINUTES = 240
export const DURATION_PRESETS = [15, 20, 30, 45] as const
export const FAST_WINDOW_START_HOUR = 18
export const FAST_WINDOW_HOURS = 18

export function parseDurationMinutes(value: string | number | null | undefined): number {
  if (value == null || value === '') return DEFAULT_MEAL_DURATION_MINUTES
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return DEFAULT_MEAL_DURATION_MINUTES
  return Math.min(MAX_MEAL_DURATION_MINUTES, Math.max(MIN_MEAL_DURATION_MINUTES, Math.round(n)))
}

export function sanitizeDurationDigits(value: string): string {
  return value.replace(/\D/g, '').slice(0, 3)
}

export function mealStartedAt(meal: Meal): DateTime {
  return fromUtc(meal.eaten_at, meal.tz_name)
}

export function mealEndedAt(meal: Meal): DateTime {
  return mealStartedAt(meal).plus({ minutes: parseDurationMinutes(meal.duration_minutes) })
}

export function fastingStartsLabel(
  start: DateTime,
  durationMinutes: number,
  now: DateTime<boolean> = DateTime.local(),
): string {
  const end = start.plus({ minutes: parseDurationMinutes(durationMinutes) })
  return `Fasting starts ${formatClockOnDay(end, now)}`
}

export function formatFastDuration(minutes: number): string {
  const value = Math.max(0, Math.round(minutes))
  if (value < 60) return `${value}m`
  const hours = Math.floor(value / 60)
  const rest = value % 60
  if (rest === 0) return `${hours}h`
  return `${hours}h ${rest}m`
}

export const MINUTES_PER_FAST_DAY = 24 * 60

export function isMultiDayFast(minutes: number): boolean {
  return Math.max(0, minutes) >= MINUTES_PER_FAST_DAY
}

/** 1-based day of the fast: first 24h is day 1, then day 2, and so on. */
export function fastingDayNumber(elapsedMinutes: number): number {
  return Math.floor(Math.max(0, elapsedMinutes) / MINUTES_PER_FAST_DAY) + 1
}

export function formatFastingKicker(elapsedMinutes: number): string {
  const day = fastingDayNumber(elapsedMinutes)
  return day >= 2 ? `Fasting · day ${day}` : 'Fasting'
}

export function formatFastingSinceLine(
  periodLabel: string,
  endedAt: DateTime,
  now?: DateTime,
): string {
  return `Since ${periodLabel.toLowerCase()} ${formatClockOnDay(endedAt, now)}`
}

export function splitFastSeconds(totalSeconds: number): { hours: number; minutes: number; seconds: number } {
  const value = Math.max(0, Math.floor(totalSeconds))
  return {
    hours: Math.floor(value / 3600),
    minutes: Math.floor((value % 3600) / 60),
    seconds: value % 60,
  }
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

export type OvernightFast = {
  start: DateTime
  end: DateTime
  minutes: number
}

export function overnightFast(
  previous: Meal | null,
  firstOfDay: Meal | null,
  now?: DateTime<boolean>,
): OvernightFast | null {
  if (!previous) return null
  const start = mealEndedAt(previous)
  const end = firstOfDay ? mealStartedAt(firstOfDay) : now
  if (!end) return null
  return {
    start,
    end,
    minutes: Math.max(0, Math.round(end.diff(start, 'minutes').minutes)),
  }
}

export function overnightFastMinutes(
  previous: Meal | null,
  firstOfDay: Meal | null,
  now?: DateTime<boolean>,
): number | null {
  return overnightFast(previous, firstOfDay, now)?.minutes ?? null
}

export function overnightWindow(dayKey: string, zone = appZone()) {
  const day = DateTime.fromISO(dayKey, { zone }).startOf('day')
  const start = day.minus({ days: 1 }).set({
    hour: FAST_WINDOW_START_HOUR,
    minute: 0,
    second: 0,
    millisecond: 0,
  })
  return {
    start,
    end: start.plus({ hours: FAST_WINDOW_HOURS }),
  }
}

export function fastBandPlacement(
  fastStart: DateTime,
  fastEnd: DateTime,
  windowStart: DateTime,
  windowEnd: DateTime,
): { top: number; height: number } | null {
  const total = windowEnd.diff(windowStart, 'minutes').minutes
  if (total <= 0) return null
  const start = fastStart < windowStart ? windowStart : fastStart
  const end = fastEnd > windowEnd ? windowEnd : fastEnd
  if (end <= start) return null
  return {
    top: (start.diff(windowStart, 'minutes').minutes / total) * 100,
    height: (end.diff(start, 'minutes').minutes / total) * 100,
  }
}

export function formatFastHoursCompact(minutes: number): string {
  const hours = Math.round((minutes / 60) * 10) / 10
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(1)
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

const MIN_PLACE_MINUTES = 1

export type DayWindow = {
  start: DateTime
  end: DateTime
}

export function localDayWindow(dayKey: string, zone = appZone()): DayWindow {
  const start = DateTime.fromISO(dayKey, { zone }).startOf('day')
  return { start, end: start.plus({ days: 1 }) }
}

export type PlacedSpan = {
  start: DateTime
  end: DateTime
  leftPct: number
  widthPct: number
}

export function placeOnWindow(
  spanStart: DateTime,
  spanEnd: DateTime,
  windowStart: DateTime,
  windowEnd: DateTime,
): PlacedSpan | null {
  const total = windowEnd.diff(windowStart, 'minutes').minutes
  if (total <= 0) return null
  const start = spanStart < windowStart ? windowStart : spanStart
  const end = spanEnd > windowEnd ? windowEnd : spanEnd
  if (end <= start) return null
  return {
    start,
    end,
    leftPct: (start.diff(windowStart, 'minutes').minutes / total) * 100,
    widthPct: (end.diff(start, 'minutes').minutes / total) * 100,
  }
}

function mealSpan(meal: Meal): { start: DateTime; end: DateTime } {
  const start = mealStartedAt(meal)
  const end = mealEndedAt(meal)
  if (end > start) return { start, end }
  return { start, end: start.plus({ minutes: MIN_PLACE_MINUTES }) }
}

export type EatingSpan = PlacedSpan & {
  mealIds: string[]
}

function mergeEatingSpans(spans: EatingSpan[], dayStart: DateTime, dayEnd: DateTime): EatingSpan[] {
  const total = dayEnd.diff(dayStart, 'minutes').minutes
  const merged: EatingSpan[] = []
  for (const span of spans) {
    const last = merged[merged.length - 1]
    if (!last || span.start > last.end) {
      merged.push({ ...span, mealIds: [...span.mealIds] })
      continue
    }
    last.end = span.end > last.end ? span.end : last.end
    last.mealIds.push(...span.mealIds)
    last.widthPct = (last.end.diff(last.start, 'minutes').minutes / total) * 100
  }
  return merged
}

export function eatingSpansForDay(meals: Meal[], dayKey: string, zone = appZone()): EatingSpan[] {
  const { start: dayStart, end: dayEnd } = localDayWindow(dayKey, zone)
  const placed = meals
    .map((meal) => {
      const { start, end } = mealSpan(meal)
      const span = placeOnWindow(start, end, dayStart, dayEnd)
      return span ? { ...span, mealIds: [meal.id] } : null
    })
    .filter((span): span is EatingSpan => span != null)
    .sort((a, b) => a.start.toMillis() - b.start.toMillis())
  return mergeEatingSpans(placed, dayStart, dayEnd)
}

export type DayRhythm = {
  dayKey: string
  eating: EatingSpan[]
  mealCount: number
  eatingMinutes: number
  mealStarts: DateTime[]
}

export function mealsOverlappingDay(meals: Meal[], dayKey: string, zone = appZone()): Meal[] {
  const { start: dayStart, end: dayEnd } = localDayWindow(dayKey, zone)
  return meals.filter((meal) => {
    const { start, end } = mealSpan(meal)
    return end > dayStart && start < dayEnd
  })
}

export function dayRhythm(meals: Meal[], dayKey: string, zone = appZone()): DayRhythm {
  const { start: dayStart, end: dayEnd } = localDayWindow(dayKey, zone)
  const overlapping = mealsOverlappingDay(meals, dayKey, zone)
  const eatingMinutes = overlapping.reduce((sum, meal) => {
    const { start, end } = mealSpan(meal)
    const clippedStart = start < dayStart ? dayStart : start
    const clippedEnd = end > dayEnd ? dayEnd : end
    return sum + Math.max(0, clippedEnd.diff(clippedStart, 'minutes').minutes)
  }, 0)
  const mealStarts = overlapping
    .map((meal) => mealStartedAt(meal))
    .filter((start) => start >= dayStart && start < dayEnd)
    .sort((a, b) => a.toMillis() - b.toMillis())
  return {
    dayKey,
    eating: eatingSpansForDay(overlapping, dayKey, zone),
    mealCount: overlapping.length,
    eatingMinutes: Math.round(eatingMinutes),
    mealStarts,
  }
}

export function nowOnDayPct(now: DateTime, dayKey: string, zone = appZone()): number | null {
  const { start, end } = localDayWindow(dayKey, zone)
  const local = now.setZone(zone)
  if (local < start || local >= end) return null
  const total = end.diff(start, 'minutes').minutes
  if (total <= 0) return null
  return (local.diff(start, 'minutes').minutes / total) * 100
}

export function formatDayRhythmCaption(
  rhythm: DayRhythm,
  options?: { fastStartedAt?: DateTime | null; now?: DateTime },
): string {
  if (rhythm.mealCount === 0) {
    if (options?.fastStartedAt) {
      return `No meals · fasting since ${formatClockOnDay(options.fastStartedAt, options.now)}`
    }
    return 'No meals yet'
  }
  const noun = rhythm.mealCount === 1 ? 'meal' : 'meals'
  if (rhythm.mealCount <= 5 && rhythm.mealStarts.length > 0) {
    return `${rhythm.mealCount} ${noun} · ${rhythm.mealStarts.map((start) => start.toFormat('t')).join(', ')}`
  }
  return `${rhythm.mealCount} ${noun} · ${formatFastDuration(rhythm.eatingMinutes)} eating`
}

export function collectRhythmMeals(meals: Meal[], extras: Array<Meal | null | undefined>): Meal[] {
  const byId = new Map(meals.map((meal) => [meal.id, meal]))
  for (const extra of extras) {
    if (extra && !byId.has(extra.id)) byId.set(extra.id, extra)
  }
  return [...byId.values()]
}

