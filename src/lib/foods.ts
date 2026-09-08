import { humanizeFoodName } from './foodNames.ts'
import {
  buildMeasureSet,
  defaultPortionFromHousehold,
  formatGramsAmount,
  formatQuantity,
  measuresFromSearchMeasures,
  measuresFromUsdaPortions,
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
  return `${source}, ${qty} ${unit}${grams}. Edit the amount if your portion is different.`
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

export function hitFromOffProduct(product: {
  product_name?: string
  generic_name?: string
  brands?: string
  nutriments?: Record<string, number>
  serving_quantity?: number | string
  serving_size?: string
}): FoodHit {
  const n = product.nutriments ?? {}
  const per_100g = roundNutrition({
    calories: Number(n['energy-kcal_100g'] ?? n.energy_kcal_100g ?? 0),
    protein_g: Number(n.proteins_100g ?? 0),
    fiber_g: Number(n.fiber_100g ?? 0),
    carbs_g: Number(n.carbohydrates_100g ?? 0),
    fat_g: Number(n.fat_100g ?? 0),
  })
  const serving = Number(product.serving_quantity)
  const grams = Number.isFinite(serving) && serving > 0 ? serving : 100
  const household = String(product.serving_size ?? '').trim() || null
  const parsed = household ? parseHouseholdPhrase(household, grams) : null
  const measures: PortionMeasure[] = parsed
    ? [{ unit: parsed.unit, gramsPerUnit: parsed.gramsPerUnit, label: parsed.label }]
    : []
  return hitFromMeasures({
    name: (product.product_name || product.generic_name || 'Packaged food').trim(),
    detailParts: [product.brands],
    gramsFallback: grams,
    measures,
    household,
    per_100g,
    source: 'off',
  })
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

export async function lookupBarcode(barcode: string): Promise<FoodHit> {
  const code = barcode.replace(/\D/g, '')
  if (code.length < 8) throw new Error('Enter a barcode with at least 8 digits.')

  const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json`, {
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) throw new Error('Could not reach Open Food Facts.')
  const data = await res.json()
  if (data.status !== 1 || !data.product) throw new Error('No food found for that barcode.')
  return hitFromOffProduct(data.product)
}
