import { asAnalyzedServing } from './portions.ts'
import { sumItems } from './totals.ts'
import type { AnalyzeResult, AnalyzeScene, MealItem } from './types.ts'

export const ANALYZE_SCENES: AnalyzeScene[] = ['plated_meal', 'recipe', 'packaged', 'mixed']

export function parseAnalyzeScene(value: unknown): AnalyzeScene | undefined {
  if (typeof value !== 'string') return undefined
  return ANALYZE_SCENES.includes(value as AnalyzeScene) ? (value as AnalyzeScene) : undefined
}

export function mergeMealItems(items: MealItem[], name?: string): MealItem {
  const source = items.filter((item) => item.name.trim())
  const rows = source.length ? source : items
  const grams = rows.reduce<number | null>((acc, item) => {
    if (item.grams == null) return acc
    return (acc ?? 0) + item.grams
  }, null)
  const fallback =
    rows
      .map((item) => item.name.trim())
      .filter(Boolean)
      .join(' + ') || 'Meal'
  return asAnalyzedServing({
    name: name?.trim() || fallback,
    grams,
    ...sumItems(rows),
  })
}

function groupingHint(
  scene: AnalyzeScene | undefined,
  collapsed: boolean,
  count: number,
): string | null {
  if (scene === 'recipe' || (collapsed && scene === 'packaged')) {
    return 'Read as a recipe, so this is the finished dish — not a row per ingredient.'
  }
  if (scene === 'plated_meal' && count === 1) {
    return 'Named the dish as you would say it. Split a side below only if you want it separate.'
  }
  if (scene === 'packaged' && count === 1) {
    return 'Read as one packaged food.'
  }
  return null
}

function joinAssumptions(hint: string | null, existing: string): string {
  const extra = existing.trim()
  if (!hint) return extra
  if (!extra) return hint
  if (extra.toLowerCase().includes(hint.slice(0, 24).toLowerCase())) return extra
  return `${hint} ${extra}`
}

export function normalizeAnalyzeResult(result: AnalyzeResult): AnalyzeResult {
  const named = result.items.filter((item) => item.name.trim())
  const scene = result.scene
  const title = result.title?.trim() || undefined
  let items = named
  const collapsed = (scene === 'recipe' || scene === 'packaged') && items.length > 2

  if (collapsed) {
    items = [mergeMealItems(items, title)]
  } else if (items.length > 6) {
    items = [...items.slice(0, 5), mergeMealItems(items.slice(5), 'Other foods')]
  }

  items = items.map(asAnalyzedServing)

  return {
    ...result,
    title: title || (items.length === 1 ? items[0]?.name : undefined),
    scene,
    items,
    totals: sumItems(items),
    assumptions: joinAssumptions(groupingHint(scene, collapsed, items.length), result.assumptions),
  }
}
