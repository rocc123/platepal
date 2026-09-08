import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { itemFromHit, mergeUsdaPortions, hitFromOffProduct, hitFromUsdaSearchFood } from './foods.ts'
import {
  asAnalyzedServing,
  ensurePortion,
  formatPortion,
  formatQuantity,
  parseHouseholdPhrase,
  parseQuantity,
  setItemGrams,
  setItemMeasure,
  setItemQuantity,
} from './portions.ts'
import type { MealItem } from './types.ts'

function oats(): MealItem {
  return {
    name: 'Oats',
    grams: 40,
    quantity: 1,
    unit: 'serving',
    grams_per_unit: 40,
    calories: 150,
    protein_g: 5,
    fiber_g: 4,
    carbs_g: 27,
    fat_g: 3,
    per_100g: {
      calories: 375,
      protein_g: 12.5,
      fiber_g: 10,
      carbs_g: 67.5,
      fat_g: 7.5,
    },
    measures: [
      { unit: 'serving', gramsPerUnit: 40, label: 'this serving' },
      { unit: 'cup', gramsPerUnit: 80, label: 'cup' },
    ],
  }
}

describe('quantity parsing', () => {
  it('reads fractions people actually type', () => {
    assert.equal(parseQuantity('1/3'), 1 / 3)
    assert.equal(parseQuantity('1 1/2'), 1.5)
    assert.equal(parseQuantity('0.5'), 0.5)
    assert.equal(parseQuantity(''), null)
    assert.equal(formatQuantity(1 / 3), '1/3')
    assert.equal(formatQuantity(1.5), '1 1/2')
  })
})

describe('household phrases', () => {
  it('turns 1/3 cup and 2 cookies into a weight', () => {
    const cup = parseHouseholdPhrase('1/3 cup (80g)', 80)
    assert.ok(cup)
    assert.equal(cup.unit, 'cup')
    assert.equal(cup.quantity, 1 / 3)
    assert.equal(cup.gramsPerUnit, 240)

    const cookies = parseHouseholdPhrase('2 cookies (28 g)', 28)
    assert.ok(cookies)
    assert.equal(cookies.unit, 'piece')
    assert.equal(cookies.quantity, 2)
    assert.equal(cookies.gramsPerUnit, 14)
  })
})

describe('scaling a portion', () => {
  it('treats an estimate as 1 serving so 2 of these doubles the food', () => {
    const one = asAnalyzedServing({
      name: 'Eggs',
      grams: 100,
      calories: 140,
      protein_g: 12,
      fiber_g: 0,
      carbs_g: 1,
      fat_g: 10,
    })
    assert.equal(one.unit, 'serving')
    assert.equal(one.quantity, 1)
    const two = setItemQuantity(one, 2)
    assert.equal(two.quantity, 2)
    assert.equal(two.grams, 200)
    assert.equal(two.protein_g, 24)
    assert.match(formatPortion(two), /2 servings/)
    assert.equal(formatPortion(setItemQuantity(one, 1 / 3)), '1/3 serving · 33.3g')
  })

  it('keeps grams when switching from a serving to a cup', () => {
    const cup = setItemMeasure(oats(), { unit: 'cup', gramsPerUnit: 80, label: 'cup' })
    assert.equal(cup.unit, 'cup')
    assert.equal(cup.grams, 40)
    assert.equal(cup.quantity, 0.5)
    const third = setItemQuantity(cup, 1 / 3)
    assert.equal(third.grams, 26.7)
    assert.equal(third.protein_g, 3.3)
  })

  it('editing grams updates the quantity of the current unit', () => {
    const next = setItemGrams(oats(), 80)
    assert.equal(next.quantity, 2)
    assert.equal(next.protein_g, 10)
    assert.equal(next.unit, 'serving')
  })

  it('doubles typed macros even when grams are unknown', () => {
    const two = setItemQuantity(
      ensurePortion({
        name: 'Eggs',
        grams: null,
        quantity: 1,
        unit: 'serving',
        calories: 140,
        protein_g: 12,
        fiber_g: 0,
        carbs_g: 1,
        fat_g: 10,
      }),
      2,
    )
    assert.equal(two.protein_g, 24)
    assert.equal(two.grams, null)
  })

  it('hydrates a legacy grams-only row as grams, not a fake serving', () => {
    const legacy = ensurePortion({
      name: 'Chicken',
      grams: 120,
      calories: 200,
      protein_g: 26,
      fiber_g: 0,
      carbs_g: 0,
      fat_g: 8,
    })
    assert.equal(legacy.unit, 'g')
    assert.equal(legacy.quantity, 120)
    assert.equal(legacy.grams_per_unit, 1)
  })
})

describe('USDA and barcode hits', () => {
  it('uses a household cup from the search row', () => {
    const hit = hitFromUsdaSearchFood({
      description: 'OATS',
      servingSize: 40,
      servingSizeUnit: 'g',
      householdServingFullText: '1/2 cup',
      foodNutrients: [
        { nutrientId: 1003, value: 13 },
        { nutrientId: 1008, value: 380 },
      ],
    })
    assert.equal(hit.unit, 'cup')
    assert.equal(hit.quantity, 0.5)
    assert.equal(hit.grams, 40)
    assert.equal(hit.grams_per_unit, 80)
    const item = itemFromHit(hit)
    assert.equal(item.unit, 'cup')
    assert.ok(item.measures?.some((row) => row.unit === 'tbsp'))
  })

  it('upgrades a 100g fallback to a USDA cup when details arrive', () => {
    const hit = hitFromUsdaSearchFood({
      description: 'Spinach',
      foodNutrients: [{ nutrientId: 1003, value: 2.9 }],
    })
    assert.equal(hit.unit, 'serving')
    assert.equal(hit.grams, 100)
    const next = mergeUsdaPortions(hit, [{ amount: 1, gramWeight: 30, portionDescription: '1 cup' }])
    assert.equal(next.unit, 'cup')
    assert.equal(next.grams, 30)
    assert.equal(next.quantity, 1)
  })

  it('reads 2 cookies from an Open Food Facts serving size', () => {
    const hit = hitFromOffProduct({
      product_name: 'Cookies',
      serving_quantity: 28,
      serving_size: '2 cookies (28 g)',
      nutriments: { proteins_100g: 6, 'energy-kcal_100g': 480 },
    })
    assert.equal(hit.unit, 'piece')
    assert.equal(hit.quantity, 2)
    assert.equal(hit.grams, 28)
    assert.equal(hit.grams_per_unit, 14)
  })
})
