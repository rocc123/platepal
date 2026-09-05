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
