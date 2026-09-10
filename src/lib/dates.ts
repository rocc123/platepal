import { DateTime } from 'luxon'
import { inferPeriodId } from './lookups.ts'

export function appZone(): string {
  return DateTime.local().zoneName || 'UTC'
}

export function nowLocal(): DateTime {
  return DateTime.local()
}

export type ZoneStamp = {
  eaten_at: string
  tz_name: string
  tz_offset_minutes: number
}

export function zoneStamp(when: DateTime = DateTime.local()): ZoneStamp {
  const local = when.setZone(when.zoneName || appZone())
  const utc = local.toUTC()
  const iso = utc.toISO()
  if (!iso) throw new Error('Could not convert that time to UTC.')
  return {
    eaten_at: iso,
    tz_name: local.zoneName || 'UTC',
    tz_offset_minutes: local.offset,
  }
}

export function fromUtc(iso: string, zone?: string | null): DateTime {
  return DateTime.fromISO(iso, { zone: 'utc' }).setZone(zone || appZone())
}

export function startOfLocalDay(date: Date, zone = appZone()): Date {
  return DateTime.fromJSDate(date).setZone(zone).startOf('day').toJSDate()
}

export function startOfNextLocalDay(date: Date, zone = appZone()): Date {
  return DateTime.fromJSDate(date).setZone(zone).startOf('day').plus({ days: 1 }).toJSDate()
}

export function addDays(date: Date, days: number): Date {
  return DateTime.fromJSDate(date).plus({ days }).toJSDate()
}

export function isSameLocalDay(a: Date, b: Date, zone = appZone()): boolean {
  return DateTime.fromJSDate(a).setZone(zone).hasSame(DateTime.fromJSDate(b).setZone(zone), 'day')
}

export function formatDayLabel(date: Date, now = new Date(), zone = appZone()): string {
  const value = DateTime.fromJSDate(date).setZone(zone).startOf('day')
  const today = DateTime.fromJSDate(now).setZone(zone).startOf('day')
  const delta = value.diff(today, 'days').days
  if (delta === 0) return 'Today'
  if (delta === -1) return 'Yesterday'
  if (delta === 1) return 'Tomorrow'
  return value.toFormat('cccc, LLL d')
}

export function formatTime(iso: string, zone?: string | null): string {
  return fromUtc(iso, zone).toFormat('t')
}

/** Clock time, plus a day when `when` is not today. */
export function formatClockOnDay(
  when: DateTime,
  now: DateTime<boolean> = DateTime.local(),
): string {
  const zone = when.zoneName || now.zoneName || appZone()
  const local = when.setZone(zone)
  const today = now.setZone(zone)
  const time = local.toFormat('t')
  if (local.hasSame(today, 'day')) return `at ${time}`
  if (local.hasSame(today.minus({ days: 1 }), 'day')) return `yesterday at ${time}`
  if (local.hasSame(today.plus({ days: 1 }), 'day')) return `tomorrow at ${time}`
  const daysAgo = Math.round(today.startOf('day').diff(local.startOf('day'), 'days').days)
  if (daysAgo > 1 && daysAgo < 7) return local.toFormat("cccc 'at' t")
  if (local.hasSame(today, 'year')) return local.toFormat("ccc, LLL d 'at' t")
  return local.toFormat("LLL d, yyyy 'at' t")
}

export function localDayKey(date: Date, zone = appZone()): string {
  return DateTime.fromJSDate(date).setZone(zone).toFormat('yyyy-LL-dd')
}

export function mealDayKey(iso: string, zone?: string | null): string {
  return fromUtc(iso, zone).toFormat('yyyy-LL-dd')
}

export function parseLocalDayKey(value: string | null, zone = appZone()): Date | null {
  if (!value) return null
  const parsed = DateTime.fromISO(value, { zone }).startOf('day')
  return parsed.isValid ? parsed.toJSDate() : null
}

export function weekdayShort(date: Date, zone = appZone()): string {
  return DateTime.fromJSDate(date).setZone(zone).toFormat('ccc')
}

export function defaultWhenForDay(day: Date, zone = appZone()): DateTime {
  const now = DateTime.local().setZone(zone)
  const target = DateTime.fromJSDate(day).setZone(zone)
  if (target.hasSame(now, 'day')) return now
  return target.set({ hour: 12, minute: 0, second: 0, millisecond: 0 })
}

export function localDateInput(when: DateTime): string {
  return when.toFormat('yyyy-LL-dd')
}

export function localTimeInput(when: DateTime): string {
  return when.toFormat('HH:mm')
}

export function dateTimeFromInputs(date: string, time: string, zone = appZone()): DateTime {
  const parsed = DateTime.fromISO(`${date}T${time}`, { zone })
  if (!parsed.isValid) throw new Error('Enter a valid date and time.')
  return parsed
}

export function formatSince(iso: string, zone?: string | null): string {
  const then = fromUtc(iso, zone)
  const now = DateTime.local()
  const minutes = Math.max(0, Math.round(now.diff(then, 'minutes').minutes))
  if (minutes < 1) return 'just now'
  if (minutes < 60) return minutes === 1 ? '1 minute ago' : `${minutes} minutes ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return hours === 1 ? '1 hour ago' : `${hours} hours ago`
  if (then.hasSame(now.minus({ days: 1 }), 'day')) return `yesterday at ${then.toFormat('t')}`
  return then.toFormat("cccc 'at' t")
}

export function inferPeriodFromWhen(when: DateTime): number {
  return inferPeriodId(when)
}
