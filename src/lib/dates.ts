export function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function startOfNextLocalDay(date: Date): Date {
  const start = startOfLocalDay(date)
  start.setDate(start.getDate() + 1)
  return start
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

export function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

export function formatDayLabel(date: Date, now = new Date()): string {
  if (isSameLocalDay(date, now)) return 'Today'
  if (isSameLocalDay(date, addDays(now, -1))) return 'Yesterday'
  if (isSameLocalDay(date, addDays(now, 1))) return 'Tomorrow'
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  })
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function localDayKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function parseLocalDayKey(value: string | null): Date | null {
  if (!value) return null
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(year, month - 1, day)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null
  return date
}

export function weekdayShort(date: Date): string {
  return date.toLocaleDateString(undefined, { weekday: 'short' })
}

export function eatenAtForDay(day: Date, now = new Date()): string {
  if (isSameLocalDay(day, now)) return now.toISOString()
  const noon = startOfLocalDay(day)
  noon.setHours(12, 0, 0, 0)
  return noon.toISOString()
}
