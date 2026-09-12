import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { DateTime } from 'luxon'
import {
  dayRhythm,
  eatingSpansForDay,
  fastingDayNumber,
  fastingStartsLabel,
  formatDayRhythmCaption,
  isMultiDayFast,
  nowOnDayPct,
  placeOnWindow,
} from './fasting.ts'
import type { Meal } from './types.ts'

const zone = 'America/New_York'

function utcIso(local: string): string {
  const iso = DateTime.fromISO(local, { zone }).toUTC().toISO()
  if (!iso) throw new Error(`Could not convert ${local}`)
  return iso
}

function meal(id: string, local: string, durationMinutes: number): Meal {
  return {
    id,
    user_id: 'u1',
    eaten_at: utcIso(local),
    duration_minutes: durationMinutes,
    name: id,
    note: null,
    source_id: 4,
    meal_period_id: 1,
    tz_name: zone,
    tz_offset_minutes: DateTime.fromISO(local, { zone }).offset,
    calories: 0,
    protein_g: 0,
    fiber_g: 0,
    carbs_g: 0,
    fat_g: 0,
    confidence: null,
  }
}

describe('placeOnWindow', () => {
  it('places a span as a percent of the window', () => {
    const start = DateTime.fromISO('2026-09-08T00:00', { zone })
    const end = start.plus({ days: 1 })
    const placed = placeOnWindow(
      DateTime.fromISO('2026-09-08T08:00', { zone }),
      DateTime.fromISO('2026-09-08T08:30', { zone }),
      start,
      end,
    )
    assert.ok(placed)
    assert.ok(Math.abs(placed.leftPct - (8 / 24) * 100) < 0.05)
    assert.ok(Math.abs(placed.widthPct - (0.5 / 24) * 100) < 0.05)
  })
})

describe('eatingSpansForDay', () => {
  it('shows 8, 12, and 6 as three 30-minute eating windows', () => {
    const meals = [
      meal('b', '2026-09-08T08:00', 30),
      meal('l', '2026-09-08T12:00', 30),
      meal('d', '2026-09-08T18:00', 30),
    ]
    const spans = eatingSpansForDay(meals, '2026-09-08', zone)
    assert.equal(spans.length, 3)
    assert.ok(Math.abs(spans[0].leftPct - (8 / 24) * 100) < 0.05)
    assert.ok(Math.abs(spans[1].leftPct - 50) < 0.05)
    assert.ok(Math.abs(spans[2].leftPct - 75) < 0.05)
    for (const span of spans) {
      assert.ok(Math.abs(span.widthPct - (0.5 / 24) * 100) < 0.05)
    }
  })

  it('clips a late meal onto the next morning', () => {
    const meals = [meal('late', '2026-09-07T23:45', 30)]
    const today = eatingSpansForDay(meals, '2026-09-08', zone)
    assert.equal(today.length, 1)
    assert.ok(Math.abs(today[0].leftPct) < 0.05)
    assert.ok(Math.abs(today[0].widthPct - (15 / 1440) * 100) < 0.05)
  })

  it('merges overlapping meals into one mark', () => {
    const meals = [meal('a', '2026-09-08T08:00', 45), meal('b', '2026-09-08T08:20', 40)]
    const spans = eatingSpansForDay(meals, '2026-09-08', zone)
    assert.equal(spans.length, 1)
    assert.deepEqual(spans[0].mealIds, ['a', 'b'])
    assert.ok(Math.abs(spans[0].widthPct - (60 / 1440) * 100) < 0.05)
  })
})

describe('dayRhythm', () => {
  it('counts meals and eating minutes on the day', () => {
    const meals = [
      meal('b', '2026-09-08T08:00', 30),
      meal('l', '2026-09-08T12:00', 30),
      meal('d', '2026-09-08T18:00', 30),
    ]
    const rhythm = dayRhythm(meals, '2026-09-08', zone)
    assert.equal(rhythm.mealCount, 3)
    assert.equal(rhythm.eatingMinutes, 90)
    assert.deepEqual(
      rhythm.mealStarts.map((start) => start.toFormat('H:mm')),
      ['8:00', '12:00', '18:00'],
    )
    assert.match(formatDayRhythmCaption(rhythm), /^3 meals · /)
  })

  it('says when the day is empty', () => {
    const rhythm = dayRhythm([], '2026-09-08', zone)
    assert.equal(rhythm.mealCount, 0)
    assert.equal(formatDayRhythmCaption(rhythm), 'No meals yet')
  })

  it('names when an empty day is part of a longer fast', () => {
    const rhythm = dayRhythm([], '2026-09-10', zone)
    const started = DateTime.fromISO('2026-09-07T14:30', { zone })
    const now = DateTime.fromISO('2026-09-10T16:00', { zone })
    assert.equal(
      formatDayRhythmCaption(rhythm, { fastStartedAt: started, now }),
      `No meals · fasting since ${started.toFormat("cccc 'at' t")}`,
    )
  })
})

describe('fastingDayNumber', () => {
  it('counts the first 24 hours as day 1', () => {
    assert.equal(fastingDayNumber(0), 1)
    assert.equal(fastingDayNumber(23 * 60 + 59), 1)
    assert.equal(isMultiDayFast(23 * 60 + 59), false)
  })

  it('rolls to day 2 at 24 hours', () => {
    assert.equal(fastingDayNumber(24 * 60), 2)
    assert.equal(fastingDayNumber(47 * 60), 2)
    assert.equal(fastingDayNumber(72 * 60), 4)
    assert.equal(isMultiDayFast(24 * 60), true)
  })
})

describe('fastingStartsLabel', () => {
  it('includes the day when the meal is not today', () => {
    const start = DateTime.fromISO('2026-09-07T14:15', { zone })
    const now = DateTime.fromISO('2026-09-10T16:00', { zone })
    const label = fastingStartsLabel(start, 15, now)
    assert.match(label, /Fasting starts Monday at /)
  })
})

describe('nowOnDayPct', () => {
  it('returns the time of day as a percent', () => {
    const now = DateTime.fromISO('2026-09-08T20:30', { zone })
    const pct = nowOnDayPct(now, '2026-09-08', zone)
    assert.ok(pct != null)
    assert.ok(Math.abs(pct - (20.5 / 24) * 100) < 0.05)
  })

  it('is null on another day', () => {
    const now = DateTime.fromISO('2026-09-08T20:30', { zone })
    assert.equal(nowOnDayPct(now, '2026-09-07', zone), null)
  })
})
