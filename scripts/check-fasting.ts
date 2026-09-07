import { DateTime } from 'luxon'
import {
  DEFAULT_MEAL_DURATION_MINUTES,
  fastBandPlacement,
  formatFastHoursCompact,
  overnightWindow,
  parseDurationMinutes,
  sanitizeDurationDigits,
} from '../src/lib/fasting.ts'

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message)
}

assert(parseDurationMinutes('') === DEFAULT_MEAL_DURATION_MINUTES, 'empty persists as default')
assert(parseDurationMinutes('20') === 20, 'parses 20')
assert(parseDurationMinutes('30') === 30, 'parses 30')
assert(parseDurationMinutes('3') === 3, 'parses a leading 3')
assert(parseDurationMinutes('240') === 240, 'allows max')
assert(parseDurationMinutes('999') === 240, 'clamps above max')
assert(sanitizeDurationDigits('30 min') === '30', 'strips non-digits')
assert(sanitizeDurationDigits('1234') === '123', 'caps at 3 digits')
assert(sanitizeDurationDigits('') === '', 'keeps an empty draft')

const zone = 'America/New_York'
const window = overnightWindow('2026-09-07', zone)
assert(window.start.hour === 18, 'window starts at 6pm')
assert(window.start.toFormat('yyyy-LL-dd') === '2026-09-06', 'window starts the previous day')
assert(window.end.hour === 12, 'window ends at noon')
assert(window.end.toFormat('yyyy-LL-dd') === '2026-09-07', 'window ends on the day')

const dinnerToBreakfast = fastBandPlacement(
  DateTime.fromISO('2026-09-06T20:15', { zone }),
  DateTime.fromISO('2026-09-07T08:15', { zone }),
  window.start,
  window.end,
)
assert(dinnerToBreakfast, 'places a typical overnight')
assert(Math.abs(dinnerToBreakfast.top - (2.25 / 18) * 100) < 0.05, '8:15pm is 2.25h after 6pm')
assert(Math.abs(dinnerToBreakfast.height - (12 / 18) * 100) < 0.05, '12h fast fills 12 of 18 hours')

const lateSnack = fastBandPlacement(
  DateTime.fromISO('2026-09-06T23:00', { zone }),
  DateTime.fromISO('2026-09-07T07:00', { zone }),
  window.start,
  window.end,
)
assert(lateSnack, 'places a late snack night')
assert(lateSnack.top > (dinnerToBreakfast?.top ?? 0), 'late start sits lower than 8pm')
assert(lateSnack.height < (dinnerToBreakfast?.height ?? 0), 'shorter fast is a shorter band')

const beforeWindow = fastBandPlacement(
  DateTime.fromISO('2026-09-06T15:00', { zone }),
  DateTime.fromISO('2026-09-07T09:00', { zone }),
  window.start,
  window.end,
)
assert(beforeWindow, 'clamps an early start to 6pm')
assert(Math.abs(beforeWindow.top) < 0.05, 'early start pins to the top')

assert(formatFastHoursCompact(750) === '12.5', 'keeps a half hour')
assert(formatFastHoursCompact(720) === '12', 'drops .0')

console.log('check-fasting: ok')
