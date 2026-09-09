/** USDA branded rows often read "TRIPLE CHOCOLATE PROTEIN BAR, TRIPLE CHOCOLATE". Drop the echo. */
function dropRepeatedSuffix(text: string): string {
  const match = text.match(/^(.*?),\s*([^,]+)$/)
  if (!match) return text
  const [, head, tail] = match
  return head.toLowerCase().includes(tail.trim().toLowerCase()) ? head.trim() : text
}

export function humanizeFoodName(raw: string): string {
  const cleaned = dropRepeatedSuffix(raw.replace(/\s+/g, ' ').trim())
  if (!cleaned) return 'Food'
  const catalog = cleaned === cleaned.toUpperCase() && /[A-Z]{3}/.test(cleaned)
  const source = catalog ? cleaned.toLowerCase() : cleaned
  return source.replace(/^\p{L}/u, (letter) => letter.toUpperCase())
}
