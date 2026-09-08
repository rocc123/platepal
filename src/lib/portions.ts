import { roundNutrition, type NutritionTotals } from './totals.ts'
import { PORTION_UNITS, type MealItem, type PortionMeasure, type PortionUnit } from './types.ts'

export { PORTION_UNITS }
export type { PortionMeasure, PortionUnit }

export const OZ_IN_GRAMS = 28.349523125
export const ML_PER_CUP = 236.5882365
export const TBSP_PER_CUP = 16
export const TSP_PER_CUP = 48

export const QUANTITY_CHIPS = [1 / 4, 1 / 3, 1 / 2, 1, 2] as const

const FRACTIONS: Array<[number, string]> = [
  [1 / 8, '1/8'],
  [1 / 4, '1/4'],
  [1 / 3, '1/3'],
  [3 / 8, '3/8'],
  [1 / 2, '1/2'],
  [5 / 8, '5/8'],
  [2 / 3, '2/3'],
  [3 / 4, '3/4'],
  [7 / 8, '7/8'],
]

const UNIT_LABELS: Record<PortionUnit, string> = {
  serving: 'serving',
  piece: 'piece',
  cup: 'cup',
  tbsp: 'tbsp',
  tsp: 'tsp',
  oz: 'oz',
  ml: 'ml',
  g: 'g',
}

const UNIT_PATTERNS: Array<[RegExp, PortionUnit]> = [
  [/\b(tablespoons?|tbsps?|tbs)\b/i, 'tbsp'],
  [/\b(teaspoons?|tsps?)\b/i, 'tsp'],
  [/\b(fluid\s*ounces?|fl\.?\s*oz)\b/i, 'serving'],
  [/\b(ounces?|oz)\b/i, 'oz'],
  [/\b(milliliters?|millilitres?|mls?)\b/i, 'ml'],
  [/\b(grams?|grms?|g)\b/i, 'g'],
  [/\b(cups?|c)\b/i, 'cup'],
  [
    /\b(slices?|pieces?|pcs?|eggs?|cookies?|crackers?|bars?|patties|patty|links?|items?|fruits?|waffles?|pancakes?|scoops?)\b/i,
    'piece',
  ],
  [/\b(servings?|containers?|packages?|packs?|cans?|bottles?|pouches?)\b/i, 'serving'],
]

export type HouseholdPortion = {
  quantity: number
  unit: PortionUnit
  gramsPerUnit: number | null
  label: string
}

export function isPortionUnit(value: unknown): value is PortionUnit {
  return typeof value === 'string' && (PORTION_UNITS as readonly string[]).includes(value)
}

export function unitLabel(unit: PortionUnit): string {
  return UNIT_LABELS[unit]
}

export function measureKey(measure: Pick<PortionMeasure, 'unit' | 'gramsPerUnit'>): string {
  const grams = measure.gramsPerUnit == null ? 'x' : String(roundGrams(measure.gramsPerUnit))
  return `${measure.unit}:${grams}`
}

export function parseQuantity(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const mixed = trimmed.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/)
  if (mixed) {
    const whole = Number(mixed[1])
    const num = Number(mixed[2])
    const den = Number(mixed[3])
    if (!den) return null
    const next = whole + num / den
    return Number.isFinite(next) && next >= 0 ? next : null
  }
  const frac = trimmed.match(/^(\d+)\s*\/\s*(\d+)$/)
  if (frac) {
    const den = Number(frac[2])
    if (!den) return null
    const next = Number(frac[1]) / den
    return Number.isFinite(next) && next >= 0 ? next : null
  }
  const next = Number(trimmed)
  return Number.isFinite(next) && next >= 0 ? next : null
}

export function formatQuantity(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return ''
  if (value === 0) return '0'
  const sign = value < 0 ? '-' : ''
  const abs = Math.abs(value)
  const whole = Math.floor(abs + 1e-9)
  const frac = abs - whole
  if (frac < 0.0001) return `${sign}${whole}`
  for (const [amount, label] of FRACTIONS) {
    if (Math.abs(frac - amount) < 0.012) {
      return whole === 0 ? `${sign}${label}` : `${sign}${whole} ${label}`
    }
  }
  const rounded = Math.round(abs * 100) / 100
  return `${sign}${Number.isInteger(rounded) ? String(rounded) : String(rounded)}`
}

export function formatGramsAmount(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return ''
  const rounded = Math.round(value * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}

export function formatPortion(item: MealItem): string {
  const qty = formatQuantity(item.quantity)
  const unit = item.unit
  const unitText = unit ? unitLabel(unit) : ''
  const head = qty && unit ? `${qty} ${pluralUnit(unit, item.quantity)}` : qty || unitText
  if (item.grams == null) return head || 'Add a portion'
  const grams = `${formatGramsAmount(item.grams)}g`
  if (!head || unit === 'g') return grams
  return `${head} · ${grams}`
}

export function pluralUnit(unit: PortionUnit, quantity: number | null | undefined): string {
  const label = unitLabel(unit)
  if (unit === 'g' || unit === 'ml' || unit === 'oz' || unit === 'tbsp' || unit === 'tsp') return label
  const n = quantity ?? 1
  if (Math.abs(n - 1) < 0.001) return label
  if (unit === 'serving') return 'servings'
  if (unit === 'piece') return 'pieces'
  if (unit === 'cup') return 'cups'
  return label
}

export function measureLabel(measure: PortionMeasure): string {
  if (measure.label && measure.label !== unitLabel(measure.unit)) return measure.label
  return unitLabel(measure.unit)
}

function roundGrams(value: number): number {
  return Math.round(value * 10) / 10
}

function scaleTotals(totals: NutritionTotals, factor: number): NutritionTotals {
  return roundNutrition({
    calories: totals.calories * factor,
    protein_g: totals.protein_g * factor,
    fiber_g: totals.fiber_g * factor,
    carbs_g: totals.carbs_g * factor,
    fat_g: totals.fat_g * factor,
  })
}

function itemTotals(item: MealItem): NutritionTotals {
  return {
    calories: item.calories,
    protein_g: item.protein_g,
    fiber_g: item.fiber_g,
    carbs_g: item.carbs_g,
    fat_g: item.fat_g,
  }
}

function nutritionForGrams(item: MealItem, grams: number | null, factor: number): NutritionTotals {
  if (grams != null && item.per_100g) {
    const scale = grams / 100
    return roundNutrition({
      calories: item.per_100g.calories * scale,
      protein_g: item.per_100g.protein_g * scale,
      fiber_g: item.per_100g.fiber_g * scale,
      carbs_g: item.per_100g.carbs_g * scale,
      fat_g: item.per_100g.fat_g * scale,
    })
  }
  return scaleTotals(itemTotals(item), factor)
}

export function parseHouseholdPhrase(text: string, grams?: number | null): HouseholdPortion | null {
  const cleaned = text.replace(/\s+/g, ' ').trim()
  if (!cleaned) return null
  const withoutParens = cleaned.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim()
  const match = withoutParens.match(
    /^(?:about|approx\.?|approximately)?\s*(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?)\s+(.+)$/i,
  )
  const quantity = match ? parseQuantity(match[1]) : 1
  const rest = match ? match[2] : withoutParens
  if (quantity == null || quantity <= 0) return null
  const unit = unitFromPhrase(rest)
  if (!unit && !match) return null
  const resolved = unit ?? 'serving'
  const gramsPerUnit = grams != null && Number.isFinite(grams) ? grams / quantity : null
  return {
    quantity,
    unit: resolved,
    gramsPerUnit,
    label: rest.replace(/^[.,;]+|[.,;]+$/g, '').trim() || unitLabel(resolved),
  }
}

export function unitFromPhrase(text: string): PortionUnit | null {
  const cleaned = text.replace(/\s+/g, ' ').trim()
  if (!cleaned) return null
  for (const [pattern, unit] of UNIT_PATTERNS) {
    if (pattern.test(cleaned)) return unit
  }
  return null
}

export type UsdaPortionLike = {
  amount?: number | null
  gramWeight?: number | null
  portionDescription?: string | null
  modifier?: string | null
  measureUnit?: { name?: string | null; abbreviation?: string | null } | null
}

export function measureFromUsdaPortion(portion: UsdaPortionLike): PortionMeasure | null {
  const grams = Number(portion.gramWeight)
  const amount = Number(portion.amount)
  const qty = Number.isFinite(amount) && amount > 0 ? amount : 1
  if (!Number.isFinite(grams) || grams <= 0) return null
  const description = [portion.portionDescription, portion.modifier]
    .map((part) => String(part ?? '').trim())
    .filter(Boolean)
    .join(' ')
  const unitName = portion.measureUnit?.name || portion.measureUnit?.abbreviation || ''
  const unit = unitFromPhrase(description) ?? unitFromPhrase(unitName) ?? 'serving'
  const label =
    description.replace(/^\d+(\s+\d+\/\d+|\/\d+)?\s+/, '').trim() ||
    unitName.trim() ||
    unitLabel(unit)
  return {
    unit,
    gramsPerUnit: grams / qty,
    label,
  }
}

export function measuresFromUsdaPortions(portions: UsdaPortionLike[] | null | undefined): PortionMeasure[] {
  return (portions ?? []).map(measureFromUsdaPortion).filter((row): row is PortionMeasure => Boolean(row))
}

export type SearchMeasureLike = {
  disseminationText?: string | null
  gramWeight?: number | null
}

export function measuresFromSearchMeasures(rows: SearchMeasureLike[] | null | undefined): PortionMeasure[] {
  return (rows ?? [])
    .map((row) => {
      const grams = Number(row.gramWeight)
      if (!Number.isFinite(grams) || grams <= 0) return null
      const parsed = parseHouseholdPhrase(String(row.disseminationText ?? ''), grams)
      return parsed
        ? {
            unit: parsed.unit,
            gramsPerUnit: parsed.gramsPerUnit,
            label: parsed.label,
          }
        : { unit: 'serving' as const, gramsPerUnit: grams, label: String(row.disseminationText ?? 'serving') }
    })
    .filter((row): row is PortionMeasure => Boolean(row))
}

export function defaultPortionFromHousehold(
  household: string | null | undefined,
  grams: number | null | undefined,
): HouseholdPortion | null {
  if (!household?.trim()) return null
  return parseHouseholdPhrase(household, grams)
}

export function buildMeasureSet(measures: PortionMeasure[]): PortionMeasure[] {
  const next: PortionMeasure[] = []
  function add(measure: PortionMeasure) {
    if (measure.gramsPerUnit != null && !(measure.gramsPerUnit > 0)) return
    const key = measureKey(measure)
    if (next.some((row) => measureKey(row) === key)) return
    next.push({
      unit: measure.unit,
      gramsPerUnit: measure.gramsPerUnit == null ? null : roundGrams(measure.gramsPerUnit),
      label: measure.label || unitLabel(measure.unit),
    })
  }

  for (const measure of measures) add(measure)

  const cup = next.find((row) => row.unit === 'cup' && row.gramsPerUnit)
  const tbsp = next.find((row) => row.unit === 'tbsp' && row.gramsPerUnit)
  const tsp = next.find((row) => row.unit === 'tsp' && row.gramsPerUnit)
  const ml = next.find((row) => row.unit === 'ml' && row.gramsPerUnit)

  if (cup?.gramsPerUnit) {
    add({ unit: 'tbsp', gramsPerUnit: cup.gramsPerUnit / TBSP_PER_CUP, label: 'tbsp' })
    add({ unit: 'tsp', gramsPerUnit: cup.gramsPerUnit / TSP_PER_CUP, label: 'tsp' })
    add({ unit: 'ml', gramsPerUnit: cup.gramsPerUnit / ML_PER_CUP, label: 'ml' })
  } else if (tbsp?.gramsPerUnit) {
    add({ unit: 'cup', gramsPerUnit: tbsp.gramsPerUnit * TBSP_PER_CUP, label: 'cup' })
    add({ unit: 'tsp', gramsPerUnit: tbsp.gramsPerUnit / 3, label: 'tsp' })
    add({ unit: 'ml', gramsPerUnit: (tbsp.gramsPerUnit * TBSP_PER_CUP) / ML_PER_CUP, label: 'ml' })
  } else if (tsp?.gramsPerUnit) {
    add({ unit: 'tbsp', gramsPerUnit: tsp.gramsPerUnit * 3, label: 'tbsp' })
    add({ unit: 'cup', gramsPerUnit: tsp.gramsPerUnit * TSP_PER_CUP, label: 'cup' })
    add({ unit: 'ml', gramsPerUnit: (tsp.gramsPerUnit * TSP_PER_CUP) / ML_PER_CUP, label: 'ml' })
  } else if (ml?.gramsPerUnit) {
    add({ unit: 'cup', gramsPerUnit: ml.gramsPerUnit * ML_PER_CUP, label: 'cup' })
    add({ unit: 'tbsp', gramsPerUnit: (ml.gramsPerUnit * ML_PER_CUP) / TBSP_PER_CUP, label: 'tbsp' })
    add({ unit: 'tsp', gramsPerUnit: (ml.gramsPerUnit * ML_PER_CUP) / TSP_PER_CUP, label: 'tsp' })
  }

  if (next.some((row) => row.gramsPerUnit != null)) {
    add({ unit: 'oz', gramsPerUnit: OZ_IN_GRAMS, label: 'oz' })
    add({ unit: 'g', gramsPerUnit: 1, label: 'g' })
  }

  const rank = (unit: PortionUnit) => PORTION_UNITS.indexOf(unit)
  return next.sort((a, b) => rank(a.unit) - rank(b.unit) || a.label.localeCompare(b.label))
}

export function availableMeasures(item: MealItem): PortionMeasure[] {
  const unit = item.unit ?? 'serving'
  const gramsPerUnit = item.grams_per_unit ?? null
  const current: PortionMeasure = {
    unit,
    gramsPerUnit,
    label:
      item.measures?.find((row) => row.unit === unit && row.gramsPerUnit === gramsPerUnit)?.label ||
      unitLabel(unit),
  }
  return buildMeasureSet([current, ...(item.measures ?? [])])
}

export function ensurePortion(item: MealItem): MealItem {
  const unit = isPortionUnit(item.unit) ? item.unit : item.grams != null ? 'g' : 'serving'
  const quantity =
    item.quantity != null && Number.isFinite(item.quantity)
      ? item.quantity
      : unit === 'g' && item.grams != null
        ? item.grams
        : 1
  const grams_per_unit =
    item.grams_per_unit != null && Number.isFinite(item.grams_per_unit)
      ? item.grams_per_unit
      : unit === 'g'
        ? 1
        : item.grams != null && quantity
          ? item.grams / quantity
          : null
  const next: MealItem = {
    ...item,
    quantity,
    unit,
    grams_per_unit,
  }
  return { ...next, measures: availableMeasures(next) }
}

export function asAnalyzedServing(item: MealItem): MealItem {
  const grams = item.grams
  return ensurePortion({
    ...item,
    quantity: 1,
    unit: 'serving',
    grams_per_unit: grams,
    measures: buildMeasureSet([
      { unit: 'serving', gramsPerUnit: grams, label: 'this serving' },
    ]),
  })
}

export function portionFromHousehold(
  household: HouseholdPortion,
  extras: PortionMeasure[] = [],
): Pick<MealItem, 'quantity' | 'unit' | 'grams' | 'grams_per_unit' | 'measures'> {
  const grams =
    household.gramsPerUnit != null ? household.quantity * household.gramsPerUnit : null
  const measures = buildMeasureSet([
    {
      unit: household.unit,
      gramsPerUnit: household.gramsPerUnit,
      label: household.label,
    },
    ...extras,
    ...(household.gramsPerUnit != null && household.unit !== 'serving'
      ? [{ unit: 'serving' as const, gramsPerUnit: grams, label: 'serving' }]
      : []),
  ])
  return {
    quantity: household.quantity,
    unit: household.unit,
    grams: grams == null ? null : roundGrams(grams),
    grams_per_unit: household.gramsPerUnit == null ? null : roundGrams(household.gramsPerUnit),
    measures,
  }
}

export function setItemQuantity(item: MealItem, quantity: number): MealItem {
  const current = ensurePortion(item)
  const previous = current.quantity && current.quantity > 0 ? current.quantity : 1
  const factor = quantity / previous
  const grams =
    current.grams_per_unit != null
      ? quantity * current.grams_per_unit
      : current.grams == null
        ? null
        : current.grams * factor
  return {
    ...current,
    quantity,
    grams: grams == null ? null : roundGrams(grams),
    ...nutritionForGrams(current, grams, factor),
  }
}

export function setItemMeasure(item: MealItem, measure: PortionMeasure): MealItem {
  const current = ensurePortion(item)
  if (measure.unit === current.unit && measure.gramsPerUnit === current.grams_per_unit) return current
  const grams = current.grams
  let quantity = current.quantity ?? 1
  let nextGrams = grams
  if (measure.gramsPerUnit != null && grams != null) {
    quantity = grams / measure.gramsPerUnit
    nextGrams = grams
  } else if (measure.gramsPerUnit != null) {
    nextGrams = quantity * measure.gramsPerUnit
  }
  const factor =
    grams != null && grams > 0 && nextGrams != null ? nextGrams / grams : 1
  return {
    ...current,
    unit: measure.unit,
    grams_per_unit: measure.gramsPerUnit,
    quantity,
    grams: nextGrams == null ? null : roundGrams(nextGrams),
    measures: availableMeasures({ ...current, measures: [...(current.measures ?? []), measure] }),
    ...nutritionForGrams(current, nextGrams, factor),
  }
}

export function setItemGrams(item: MealItem, grams: number | null): MealItem {
  const current = ensurePortion(item)
  if (grams == null) {
    return { ...current, grams: null }
  }
  const previous = current.grams
  const factor = previous != null && previous > 0 ? grams / previous : 1
  const quantity =
    current.grams_per_unit != null && current.grams_per_unit > 0
      ? grams / current.grams_per_unit
      : current.unit === 'g'
        ? grams
        : current.quantity
  return {
    ...current,
    grams: roundGrams(grams),
    quantity,
    ...nutritionForGrams(current, grams, factor),
  }
}

export function findMeasure(item: MealItem, key: string): PortionMeasure | undefined {
  return availableMeasures(item).find((measure) => measureKey(measure) === key)
}
