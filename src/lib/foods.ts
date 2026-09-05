import { roundNutrition, type NutritionTotals } from './totals'
import type { MealItem } from './types'

export type FoodHit = {
  name: string
  detail: string
  grams: number
  per_100g: NutritionTotals
  source: 'usda' | 'off'
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

export function itemFromHit(hit: FoodHit): MealItem {
  return {
    name: hit.name,
    grams: hit.grams,
    ...scaleFrom100g(hit.per_100g, hit.grams),
    per_100g: hit.per_100g,
  }
}

async function usdaSearchJson(query: string) {
  const params = new URLSearchParams({
    query,
    pageSize: '8',
    api_key: usdaKey(),
  })
  const remote = `https://api.nal.usda.gov/fdc/v1/foods/search?${params}`
  try {
    const res = await fetch(remote)
    if (res.ok) return res.json()
  } catch {
    // CORS or network — fall through to same-origin proxy
  }
  const local = await fetch(`/api/usda/foods/search?${params}`)
  if (!local.ok) throw new Error('USDA lookup failed. Try again in a moment.')
  return local.json()
}

export async function searchUsdaFoods(query: string): Promise<FoodHit[]> {
  const trimmed = query.trim()
  if (trimmed.length < 2) return []
  const data = await usdaSearchJson(trimmed)
  const foods = Array.isArray(data?.foods) ? data.foods : []
  return foods.map((food: Record<string, unknown>) => {
    const nutrients = (food.foodNutrients as Array<{ nutrientId?: number; value?: number }>) ?? []
    const serving = Number(food.servingSize)
    const unit = String(food.servingSizeUnit ?? '').toLowerCase()
    const grams = serving > 0 && (unit === 'g' || unit === 'ml' || unit === 'grm') ? serving : 100
    const brand = String(food.brandName || food.brandOwner || '').trim()
    const description = String(food.description || 'Food').trim()
    return {
      name: description,
      detail: [brand, food.dataType, grams === 100 ? 'per 100g' : `${grams}g serving`]
        .filter(Boolean)
        .join(' · '),
      grams,
      per_100g: perHundredFromNutrients(nutrients),
      source: 'usda' as const,
    }
  })
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

  const product = data.product as {
    product_name?: string
    generic_name?: string
    brands?: string
    nutriments?: Record<string, number>
    serving_quantity?: number | string
    serving_size?: string
  }
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
  const name = (product.product_name || product.generic_name || 'Packaged food').trim()
  return {
    name,
    detail: [product.brands, `${grams}g`].filter(Boolean).join(' · '),
    grams,
    per_100g,
    source: 'off',
  }
}
