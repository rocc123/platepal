import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { DateTime } from 'luxon'
import { formatClockOnDay } from './dates.ts'

const zone = 'America/New_York'

describe('formatClockOnDay', () => {
  const now = DateTime.fromISO('2026-09-10T16:00', { zone })

  it('keeps today as a clock time', () => {
    const when = DateTime.fromISO('2026-09-10T14:30', { zone })
    assert.equal(formatClockOnDay(when, now), `at ${when.toFormat('t')}`)
  })

  it('names yesterday', () => {
    const when = DateTime.fromISO('2026-09-09T14:30', { zone })
    assert.equal(formatClockOnDay(when, now), `yesterday at ${when.toFormat('t')}`)
  })

  it('names tomorrow', () => {
    const when = DateTime.fromISO('2026-09-11T08:15', { zone })
    assert.equal(formatClockOnDay(when, now), `tomorrow at ${when.toFormat('t')}`)
  })

  it('uses the weekday within the last week', () => {
    const when = DateTime.fromISO('2026-09-07T14:30', { zone })
    assert.equal(formatClockOnDay(when, now), when.toFormat("cccc 'at' t"))
    assert.match(formatClockOnDay(when, now), /Monday/)
  })

  it('adds the calendar date after a week', () => {
    const when = DateTime.fromISO('2026-09-01T14:30', { zone })
    assert.equal(formatClockOnDay(when, now), when.toFormat("ccc, LLL d 'at' t"))
    assert.match(formatClockOnDay(when, now), /Sep 1/)
  })

  it('includes the year when it changed', () => {
    const when = DateTime.fromISO('2025-12-28T14:30', { zone })
    assert.equal(formatClockOnDay(when, now), when.toFormat("LLL d, yyyy 'at' t"))
    assert.match(formatClockOnDay(when, now), /2025/)
  })
})
