export function humanizeFoodName(raw: string): string {
  const cleaned = raw.replace(/\s+/g, ' ').trim()
  if (!cleaned) return 'Food'
  const catalog = cleaned === cleaned.toUpperCase() && /[A-Z]{3}/.test(cleaned)
  const source = catalog ? cleaned.toLowerCase() : cleaned
  return source.replace(/^\p{L}/u, (letter) => letter.toUpperCase())
}
