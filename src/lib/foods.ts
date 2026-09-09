import { humanizeFoodName } from './foodNames.ts'
import {
  buildMeasureSet,
  defaultPortionFromHousehold,
  formatGramsAmount,
  formatQuantity,
  measuresFromSearchMeasures,
  measuresFromUsdaPortions,
  OZ_IN_GRAMS,
  parseHouseholdPhrase,
  pluralUnit,
  portionFromHousehold,
  type HouseholdPortion,
  type SearchMeasureLike,
  type UsdaPortionLike,
} from './portions.ts'
import { roundNutrition, type NutritionTotals } from './totals.ts'
import type { MealItem, PortionMeasure } from './types.ts'

export type FoodHit = {
  name: string
  detail: string
  grams: number
  quantity: number
  unit: MealItem['unit']
  grams_per_unit: number | null
  measures: PortionMeasure[]
  per_100g: NutritionTotals
  source: 'usda' | 'off'
  fdcId?: number
  servingNote?: string
}

function usdaKey() {
  return import.meta.env.VITE_USDA_API_KEY?.trim() || 'DEMO_KEY'
}

function nutrientValue(
  nutrients: Array<{ nutrientId?: number; nutrientName?: string; value?: number; unitName?: string }>,
  id: number,
) {
  const row = nutrients.find((n) => n.nutrientId === id)
  return Number(row?.value ?? 0)
}

function perHundredFromNutrients(
  nutrients: Array<{ nutrientId?: number; nutrientName?: string; value?: number; unitName?: string }>,
): NutritionTotals {
  let calories = nutrientValue(nutrients, 1008)
  if (!calories) {
    const kj = nutrientValue(nutrients, 1062)
    if (kj) calories = kj / 4.184
  }
  return roundNutrition({
    calories,
    protein_g: nutrientValue(nutrients, 1003),
    fiber_g: nutrientValue(nutrients, 1079),
    carbs_g: nutrientValue(nutrients, 1005),
    fat_g: nutrientValue(nutrients, 1004),
  })
}

export function scaleFrom100g(per100: NutritionTotals, grams: number): NutritionTotals {
  const factor = grams / 100
  return roundNutrition({
    calories: per100.calories * factor,
    protein_g: per100.protein_g * factor,
    fiber_g: per100.fiber_g * factor,
    carbs_g: per100.carbs_g * factor,
    fat_g: per100.fat_g * factor,
  })
}

function servingGramsFromUnit(serving: number, unit: string): number | null {
  if (!(serving > 0)) return null
  const normalized = unit.toLowerCase()
  if (normalized === 'g' || normalized === 'ml' || normalized === 'grm' || normalized === 'gram') return serving
  return null
}

export function hitFromMeasures(input: {
  name: string
  detailParts: Array<string | number | undefined | null>
  gramsFallback: number
  measures: PortionMeasure[]
  household?: string | null
  per_100g: NutritionTotals
  source: 'usda' | 'off'
  fdcId?: number
}): FoodHit {
  const extras = buildMeasureSet([
    ...input.measures,
    { unit: 'serving', gramsPerUnit: input.gramsFallback, label: 'serving' },
  ])
  const household = defaultPortionFromHousehold(input.household, input.gramsFallback)
  const portion = household
    ? portionFromHousehold(household, extras)
    : portionFromHousehold(
        {
          quantity: 1,
          unit: 'serving',
          gramsPerUnit: input.gramsFallback,
          label: 'serving',
        },
        extras,
      )
  const grams = portion.grams ?? input.gramsFallback
  const qty = portion.quantity ?? 1
  const unit = portion.unit ?? 'serving'
  const unitText = unit ? `${formatQuantity(qty)} ${pluralUnit(unit, qty)}` : '1 serving'
  const detail = [
    ...input.detailParts,
    input.household?.trim() || (grams ? `${unitText} · ${formatGramsAmount(grams)}g` : unitText),
  ]
    .map((part) => (part == null ? '' : String(part).trim()))
    .filter(Boolean)
    .join(' · ')
  return {
    name: input.name,
    detail,
    grams,
    quantity: qty,
    unit,
    grams_per_unit: portion.grams_per_unit ?? null,
    measures: portion.measures ?? extras,
    per_100g: input.per_100g,
    source: input.source,
    fdcId: input.fdcId,
  }
}

export function itemFromHit(hit: FoodHit): MealItem {
  return {
    name: hit.name,
    grams: hit.grams,
    quantity: hit.quantity,
    unit: hit.unit,
    grams_per_unit: hit.grams_per_unit,
    measures: hit.measures,
    ...scaleFrom100g(hit.per_100g, hit.grams),
    per_100g: hit.per_100g,
  }
}

export function portionAssumption(source: string, hit: FoodHit): string {
  const qty = formatQuantity(hit.quantity)
  const unit = hit.unit ? pluralUnit(hit.unit, hit.quantity) : 'serving'
  const grams = hit.grams ? ` (${formatGramsAmount(hit.grams)}g)` : ''
  const base = `${source}, ${qty} ${unit}${grams}. Edit the amount if your portion is different.`
  return hit.servingNote ? `${hit.servingNote} ${base}` : base
}

export function lookupConfidence(hit: FoodHit): number {
  const n = hit.per_100g
  if (!n.calories && !n.protein_g && !n.carbs_g && !n.fat_g) return 0.25
  if (hit.servingNote) return 0.5
  return 0.8
}

export function hitSourceLabel(hit: FoodHit): string {
  return hit.source === 'usda' ? 'USDA FoodData Central' : 'Open Food Facts'
}

export function hitFromUsdaSearchFood(food: Record<string, unknown>): FoodHit {
  const nutrients = (food.foodNutrients as Array<{ nutrientId?: number; value?: number }>) ?? []
  const serving = Number(food.servingSize)
  const servingUnit = String(food.servingSizeUnit ?? '').toLowerCase()
  const grams = servingGramsFromUnit(serving, servingUnit) ?? 100
  const household = String(food.householdServingFullText ?? '').trim() || null
  const brand = String(food.brandName || food.brandOwner || '').trim()
  const portions = measuresFromUsdaPortions(food.foodPortions as UsdaPortionLike[] | undefined)
  const searchMeasures = measuresFromSearchMeasures(food.foodMeasures as SearchMeasureLike[] | undefined)
  return hitFromMeasures({
    name: humanizeFoodName(String(food.description || 'Food')),
    detailParts: [brand, food.dataType as string | undefined],
    gramsFallback: grams,
    measures: [...portions, ...searchMeasures],
    household,
    per_100g: perHundredFromNutrients(nutrients),
    source: 'usda',
    fdcId: Number(food.fdcId) || undefined,
  })
}

export function mergeUsdaPortions(hit: FoodHit, portions: UsdaPortionLike[] | null | undefined): FoodHit {
  const extras = measuresFromUsdaPortions(portions)
  if (!extras.length) return hit
  const fallbackServing =
    hit.unit === 'serving' &&
    hit.quantity === 1 &&
    Math.abs((hit.grams_per_unit ?? 0) - 100) < 0.05
  const preferred =
    extras.find((row) => row.unit === 'cup' && row.gramsPerUnit) ??
    extras.find((row) => row.unit === 'piece' && row.gramsPerUnit) ??
    extras.find((row) => row.unit === 'tbsp' && row.gramsPerUnit)
  const household: HouseholdPortion =
    fallbackServing && preferred?.gramsPerUnit
      ? { quantity: 1, unit: preferred.unit, gramsPerUnit: preferred.gramsPerUnit, label: preferred.label }
      : {
          quantity: hit.quantity,
          unit: hit.unit ?? 'serving',
          gramsPerUnit: hit.grams_per_unit,
          label: hit.unit === 'serving' ? 'serving' : String(hit.unit),
        }
  const portion = portionFromHousehold(household, [...hit.measures, ...extras])
  const grams = portion.grams ?? hit.grams
  return {
    ...hit,
    grams,
    quantity: portion.quantity ?? hit.quantity,
    unit: portion.unit ?? hit.unit,
    grams_per_unit: portion.grams_per_unit ?? hit.grams_per_unit,
    measures: portion.measures ?? hit.measures,
    detail:
      fallbackServing && preferred
        ? `${hit.detail} · 1 ${preferred.label}`
        : hit.detail,
  }
}

const FL_OZ_IN_ML = 29.5735295625

type OffProduct = {
  product_name?: string
  generic_name?: string
  brands?: string
  nutriments?: Record<string, number | string | undefined>
  serving_quantity?: number | string
  serving_size?: string
  product_quantity?: number | string
  quantity?: string
  categories?: string
  categories_tags?: string[]
}

function positiveGrams(value: unknown): number | null {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : null
}

function closeGrams(a: number, b: number, ratio = 0.2): boolean {
  const scale = Math.max(a, b)
  return scale > 0 && Math.abs(a - b) / scale <= ratio
}

export function gramsFromServingText(text: string | null | undefined): number | null {
  const cleaned = String(text ?? '').replace(/\s+/g, ' ').trim()
  if (!cleaned) return null

  const parenFlOz = cleaned.match(/\((\d+(?:\.\d+)?)\s*fl\.?\s*oz\b/i)
  if (parenFlOz) return Number(parenFlOz[1]) * FL_OZ_IN_ML
  const parenOz = cleaned.match(/\((\d+(?:\.\d+)?)\s*oz\b/i)
  if (parenOz) return Number(parenOz[1]) * OZ_IN_GRAMS
  const parenG = cleaned.match(/\((\d+(?:\.\d+)?)\s*(g|gr|grams?|ml)\b/i)
  if (parenG) return Number(parenG[1])

  const flOz = cleaned.match(/(?:^|\s)(\d+(?:\.\d+)?)\s*fl\.?\s*oz\b/i)
  if (flOz) return Number(flOz[1]) * FL_OZ_IN_ML
  const oz = cleaned.match(/(?:^|\s)(\d+(?:\.\d+)?)\s*oz\b/i)
  if (oz) return Number(oz[1]) * OZ_IN_GRAMS
  const unit = cleaned.match(/(?:^|\s)(\d+(?:\.\d+)?)\s*(g|gr|grams?|ml)\b/i)
  if (unit) return Number(unit[1])

  if (/^\d+(?:\.\d+)?$/.test(cleaned)) {
    const n = Number(cleaned)
    if (n >= 1 && n <= 500) return n
  }
  return null
}

function nutrimentNumber(
  n: Record<string, number | string | undefined>,
  ...keys: string[]
): number {
  for (const key of keys) {
    const value = Number(n[key])
    if (Number.isFinite(value) && value > 0) return value
  }
  return 0
}

export function caloriesPer100g(n: Record<string, number | string | undefined>): number {
  let kcal = nutrimentNumber(n, 'energy-kcal_100g', 'energy_kcal_100g')
  const kj = nutrimentNumber(n, 'energy-kj_100g', 'energy_kj_100g', 'energy-kj', 'energy_100g')
  if (!kcal && kj) kcal = kj / 4.184
  if (kcal > 950) kcal = kcal / 4.184
  return kcal
}

export function inferredServingGrams(
  n: Record<string, number | string | undefined>,
): number | null {
  const pairs: Array<[string, string]> = [
    ['energy-kcal_serving', 'energy-kcal_100g'],
    ['proteins_serving', 'proteins_100g'],
    ['carbohydrates_serving', 'carbohydrates_100g'],
    ['fat_serving', 'fat_100g'],
    ['fiber_serving', 'fiber_100g'],
  ]
  const estimates: number[] = []
  for (const [servingKey, per100Key] of pairs) {
    const serving = Number(n[servingKey])
    const per100 = Number(n[per100Key])
    if (serving > 0 && per100 > 0) {
      const grams = (serving / per100) * 100
      if (grams >= 2 && grams <= 800) estimates.push(grams)
    }
  }
  if (!estimates.length) return null
  estimates.sort((a, b) => a - b)
  return Math.round(estimates[Math.floor((estimates.length - 1) / 2)] * 10) / 10
}

function packageGrams(product: OffProduct): number | null {
  return positiveGrams(product.product_quantity) ?? gramsFromServingText(product.quantity)
}

function isWholePackageGuess(
  grams: number,
  pack: number | null,
  servingSize: string,
  inferred: number | null,
): boolean {
  if (!pack || !closeGrams(grams, pack, 0.12)) return false
  if (inferred && inferred >= 5 && inferred < pack * 0.5) return true
  const textGrams = gramsFromServingText(servingSize)
  if (textGrams && textGrams < pack * 0.5) return true
  if (!servingSize.trim() && pack > 300) return true
  if (/^(1(\s+servings?)?)?$/i.test(servingSize.trim()) && pack > 300) return true
  return false
}

function offCategoryText(product: OffProduct): string {
  return [...(product.categories_tags ?? []), String(product.categories ?? '')].join(' ').toLowerCase()
}

function typicalDenseServing(product: OffProduct, kcalPer100: number): {
  grams: number
  household: string
  note: string
} | null {
  if (kcalPer100 < 450) return null
  const cats = offCategoryText(product)
  if (/olive-oil|vegetable-oil|en:oils|seed-oil/.test(cats)) {
    return {
      grams: 14,
      household: '1 tbsp',
      note: 'Open Food Facts has no serving size. Started you at 1 tbsp (14g) for this oil.',
    }
  }
  if (/spread|nut-butter|hazelnut|peanut-butter|chocolate|cocoa/.test(cats)) {
    return {
      grams: 15,
      household: '1 tbsp',
      note: 'Open Food Facts has no serving size. Started you at 1 tbsp (15g) for this spread.',
    }
  }
  if (/(chips|crisp|en:chips)/.test(cats)) {
    return {
      grams: 28,
      household: '1 serving (28g)',
      note: 'Open Food Facts has no serving size. Started you at a 28g handful.',
    }
  }
  return null
}

function householdIfItMatches(servingSize: string, grams: number): string | null {
  if (!servingSize) return null
  const parsed = parseHouseholdPhrase(servingSize, grams)
  const parsedGrams =
    parsed?.gramsPerUnit != null ? parsed.quantity * parsed.gramsPerUnit : null
  if (parsed && parsedGrams && closeGrams(parsedGrams, grams, 0.3)) return servingSize
  return null
}

export function chooseOffServing(product: OffProduct): {
  grams: number
  household: string | null
  note: string | null
} {
  const n = product.nutriments ?? {}
  const servingSize = String(product.serving_size ?? '').trim()
  const fromText = gramsFromServingText(servingSize)
  const inferred = inferredServingGrams(n)
  const listed = positiveGrams(product.serving_quantity)
  const pack = packageGrams(product)

  const usable = (grams: number | null) =>
    Boolean(grams && !isWholePackageGuess(grams, pack, servingSize, inferred))

  if (fromText && usable(fromText)) {
    return {
      grams: Math.round(fromText * 10) / 10,
      household: householdIfItMatches(servingSize, fromText),
      note: null,
    }
  }
  if (inferred && usable(inferred)) {
    return {
      grams: inferred,
      household: householdIfItMatches(servingSize, inferred),
      note: null,
    }
  }
  if (listed && usable(listed)) {
    return {
      grams: Math.round(listed * 10) / 10,
      household: householdIfItMatches(servingSize, listed),
      note: null,
    }
  }

  if (listed && isWholePackageGuess(listed, pack, servingSize, inferred) && pack) {
    const dense = typicalDenseServing(product, caloriesPer100g(n))
    if (dense) {
      return {
        grams: dense.grams,
        household: dense.household,
        note: `Open Food Facts listed the whole ${Math.round(pack)}g package as one serving. ${dense.note.replace('Open Food Facts has no serving size. ', '')}`,
      }
    }
    return {
      grams: 100,
      household: null,
      note: `Open Food Facts listed the whole ${Math.round(pack)}g package as one serving. Started you at 100g.`,
    }
  }

  const dense = typicalDenseServing(product, caloriesPer100g(n))
  if (dense) {
    return { grams: dense.grams, household: dense.household, note: dense.note }
  }

  return {
    grams: 100,
    household: null,
    note: 'Open Food Facts has no serving size, so this is 100g. A label serving is often a smaller scoop — edit the amount.',
  }
}

function macroCalories(n: NutritionTotals): number {
  return n.protein_g * 4 + n.carbs_g * 4 + n.fat_g * 9
}

/**
 * Open Food Facts contributors sometimes copy the per-serving protein, carbs, and fat
 * off a US label straight into the per-100g fields while the calories are right.
 * When the macros only add up to the listed calories after scaling by the serving,
 * scale them.
 */
export function reconcileOffPer100g(
  per100: NutritionTotals,
  servingGrams: number | null,
): { per_100g: NutritionTotals; note: string | null } {
  const kcal = per100.calories
  const fromMacros = macroCalories(per100)
  if (!kcal || !fromMacros || !servingGrams || servingGrams < 5 || servingGrams > 95) {
    return { per_100g: per100, note: null }
  }
  if (fromMacros / kcal >= 0.7) return { per_100g: per100, note: null }
  const factor = 100 / servingGrams
  const scaled = fromMacros * factor
  if (Math.abs(scaled - kcal) / kcal > 0.15) return { per_100g: per100, note: null }
  return {
    per_100g: roundNutrition({
      calories: kcal,
      protein_g: per100.protein_g * factor,
      fiber_g: per100.fiber_g * factor,
      carbs_g: per100.carbs_g * factor,
      fat_g: per100.fat_g * factor,
    }),
    note: `Open Food Facts listed per-serving protein, carbs, and fat as per-100g values. Scaled them to match the ${Math.round(kcal)} kcal per 100g — check the label.`,
  }
}

export function hitFromOffProduct(product: OffProduct): FoodHit {
  const n = product.nutriments ?? {}
  const listed = roundNutrition({
    calories: caloriesPer100g(n),
    protein_g: Number(n.proteins_100g ?? 0),
    fiber_g: Number(n.fiber_100g ?? n.fibre_100g ?? 0),
    carbs_g: Number(n.carbohydrates_100g ?? 0),
    fat_g: Number(n.fat_100g ?? 0),
  })
  const chosen = chooseOffServing(product)
  const reconciled = reconcileOffPer100g(listed, chosen.grams)
  const per_100g = reconciled.per_100g
  const pack = packageGrams(product)
  const extras: PortionMeasure[] = []
  if (pack && Math.abs(pack - chosen.grams) > 8) {
    extras.push({ unit: 'serving', gramsPerUnit: pack, label: 'package' })
  }
  const emptyNutrition =
    !per_100g.calories && !per_100g.protein_g && !per_100g.carbs_g && !per_100g.fat_g
  const servingNote = [
    chosen.note,
    reconciled.note,
    emptyNutrition ? 'Nutrition facts are missing — add them from the label.' : '',
  ]
    .filter(Boolean)
    .join(' ')
  const hit = hitFromMeasures({
    name: (product.product_name || product.generic_name || 'Packaged food').trim(),
    detailParts: [product.brands],
    gramsFallback: chosen.grams,
    measures: extras,
    household: chosen.household,
    per_100g,
    source: 'off',
  })
  return servingNote ? { ...hit, servingNote } : hit
}

async function usdaJson(path: string, params: URLSearchParams) {
  const remote = `https://api.nal.usda.gov/fdc/v1/${path}?${params}`
  try {
    const res = await fetch(remote)
    if (res.ok) return res.json()
  } catch {
    // CORS or network — fall through to same-origin proxy
  }
  const local = await fetch(`/api/usda/${path}?${params}`)
  if (!local.ok) throw new Error('USDA lookup failed. Try again in a moment.')
  return local.json()
}

async function usdaSearchJson(query: string) {
  const params = new URLSearchParams({
    query,
    pageSize: '8',
    api_key: usdaKey(),
  })
  return usdaJson('foods/search', params)
}

export async function searchUsdaFoods(query: string): Promise<FoodHit[]> {
  const trimmed = query.trim()
  if (trimmed.length < 2) return []
  const data = await usdaSearchJson(trimmed)
  const foods = Array.isArray(data?.foods) ? data.foods : []
  return foods.map((food: Record<string, unknown>) => hitFromUsdaSearchFood(food))
}

export async function enrichUsdaHit(hit: FoodHit): Promise<FoodHit> {
  if (hit.source !== 'usda' || !hit.fdcId) return hit
  try {
    const params = new URLSearchParams({ api_key: usdaKey() })
    const data = await usdaJson(`food/${hit.fdcId}`, params)
    return mergeUsdaPortions(hit, data?.foodPortions as UsdaPortionLike[] | undefined)
  } catch {
    return hit
  }
}

export function barcodeLookupCodes(barcode: string): string[] {
  const digits = barcode.replace(/\D/g, '')
  const codes: string[] = []
  const add = (value: string) => {
    if (value && !codes.includes(value)) codes.push(value)
  }
  add(digits)
  add(digits.replace(/^0+/, ''))
  if (digits.length === 11) {
    add(digits.padStart(12, '0'))
    add(digits.padStart(13, '0'))
  }
  if (digits.length === 12) add(`0${digits}`)
  if (digits.length === 13 && digits.startsWith('0')) add(digits.slice(1))
  if (digits.length >= 11 && digits.length < 14) add(digits.padStart(14, '0'))
  return codes
}

export function sameGtin(a: string, b: string): boolean {
  const strip = (value: string) => value.replace(/\D/g, '').replace(/^0+/, '')
  const left = strip(a)
  return left.length > 0 && left === strip(b)
}

/**
 * USDA stores the same product as a 12-digit UPC or a 14-digit GTIN depending on who
 * supplied it, and its search only matches the exact token. Ask for every form at once.
 */
export function findUsdaBarcodeFood(
  foods: Array<Record<string, unknown>>,
  barcode: string,
): Record<string, unknown> | null {
  return foods.find((food) => sameGtin(String(food.gtinUpc ?? ''), barcode)) ?? null
}

async function lookupUsdaBarcode(codes: string[]): Promise<FoodHit | null> {
  const params = new URLSearchParams({
    query: codes.join(' '),
    dataType: 'Branded',
    pageSize: '10',
    api_key: usdaKey(),
  })
  const data = await usdaJson('foods/search', params)
  const foods = Array.isArray(data?.foods) ? data.foods : []
  const food = findUsdaBarcodeFood(foods, codes[0])
  return food ? hitFromUsdaSearchFood(food) : null
}

async function fetchOffProduct(code: string): Promise<{ status?: number; product?: OffProduct }> {
  const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json`, {
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) throw new Error('Could not reach Open Food Facts.')
  return res.json()
}

async function lookupOffBarcode(codes: string[]): Promise<FoodHit> {
  let sawMissing = false
  let networkError: Error | null = null
  for (const code of codes) {
    try {
      const data = await fetchOffProduct(code)
      if (data.status === 1 && data.product) return hitFromOffProduct(data.product)
      sawMissing = true
    } catch (err) {
      networkError = err instanceof Error ? err : new Error('Could not reach Open Food Facts.')
    }
  }
  if (networkError && !sawMissing) throw networkError
  throw new Error('No food found for that barcode.')
}

/**
 * The USDA branded database carries the manufacturer's own label, so it wins when the
 * barcode is there. Open Food Facts covers everything else.
 */
export async function lookupBarcode(barcode: string): Promise<FoodHit> {
  const codes = barcodeLookupCodes(barcode)
  if (!codes[0] || codes[0].length < 8) throw new Error('Enter a barcode with at least 8 digits.')

  const [usda, off] = await Promise.allSettled([lookupUsdaBarcode(codes), lookupOffBarcode(codes)])
  if (usda.status === 'fulfilled' && usda.value) return usda.value
  if (off.status === 'fulfilled') return off.value
  throw off.reason instanceof Error ? off.reason : new Error('No food found for that barcode.')
}
