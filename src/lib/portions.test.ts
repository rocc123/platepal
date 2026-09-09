import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  barcodeLookupCodes,
  caloriesPer100g,
  chooseOffServing,
  findUsdaBarcodeFood,
  gramsFromServingText,
  hitFromOffProduct,
  hitFromUsdaSearchFood,
  hitSourceLabel,
  itemFromHit,
  lookupConfidence,
  mergeUsdaPortions,
  reconcileOffPer100g,
  sameGtin,
} from './foods.ts'
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
    assert.equal(hit.servingNote, undefined)
    assert.equal(lookupConfidence(hit), 0.8)
  })

  it('treats a bare serving_size number as grams instead of 100g', () => {
    const hit = hitFromOffProduct({
      product_name: 'Nutella',
      serving_size: '33',
      product_quantity: 1000,
      nutriments: { proteins_100g: 6.3, 'energy-kcal_100g': 539, fibre_100g: 0 },
    })
    assert.equal(hit.grams, 33)
    assert.equal(hit.quantity, 1)
    assert.equal(itemFromHit(hit).calories, 178)
    assert.ok(hit.measures.some((row) => row.label === 'package' && row.gramsPerUnit === 1000))
  })

  it('does not log a whole jar when serving_quantity is the package', () => {
    const hit = hitFromOffProduct({
      product_name: 'Peanut butter',
      serving_quantity: 453,
      product_quantity: 453,
      categories_tags: ['en:spreads', 'en:nut-butters'],
      nutriments: { proteins_100g: 25, 'energy-kcal_100g': 588 },
    })
    assert.equal(hit.grams, 15)
    assert.equal(hit.unit, 'tbsp')
    assert.match(String(hit.servingNote), /whole 453g package/)
    assert.match(String(hit.servingNote), /1 tbsp/)
    assert.equal(lookupConfidence(hit), 0.5)
  })

  it('prefers the label scoop when the package is also listed', () => {
    const chosen = chooseOffServing({
      serving_size: '2 tbsp (32g)',
      serving_quantity: 453,
      product_quantity: 453,
      nutriments: { proteins_100g: 25, proteins_serving: 8, 'energy-kcal_100g': 588 },
    })
    assert.equal(chosen.grams, 32)
    assert.equal(chosen.note, null)
  })

  it('infers serving grams from per-serving nutrients', () => {
    const hit = hitFromOffProduct({
      product_name: 'Coca-Cola',
      serving_size: '1 portion',
      product_quantity: 330,
      nutriments: {
        'energy-kcal_100g': 42,
        'energy-kcal_serving': 139,
        proteins_100g: 0,
      },
    })
    assert.ok(Math.abs(hit.grams - 331) < 2)
    assert.equal(itemFromHit(hit).calories, 139)
  })

  it('keeps a single-serve can that matches the package', () => {
    const hit = hitFromOffProduct({
      product_name: 'Cola',
      serving_size: '1 can (12 fl oz)',
      serving_quantity: 355,
      product_quantity: 355,
      nutriments: { 'energy-kcal_100g': 42, 'energy-kcal_serving': 149 },
    })
    assert.ok(hit.grams > 330 && hit.grams < 370)
  })

  it('starts energy-dense spreads at a tablespoon when serving is missing', () => {
    const hit = hitFromOffProduct({
      product_name: 'Nutella',
      product_quantity: 400,
      categories_tags: ['en:breakfasts', 'en:spreads', 'en:sweet-spreads'],
      nutriments: { proteins_100g: 6.3, 'energy-kcal_100g': 539 },
    })
    assert.equal(hit.grams, 15)
    assert.equal(hit.unit, 'tbsp')
    assert.match(String(hit.servingNote), /1 tbsp \(15g\)/)
    assert.equal(itemFromHit(hit).calories, 81)
  })

  it('warns when Open Food Facts has no serving at all', () => {
    const hit = hitFromOffProduct({
      product_name: 'Yogurt',
      product_quantity: 500,
      nutriments: { proteins_100g: 4, 'energy-kcal_100g': 80 },
    })
    assert.equal(hit.grams, 100)
    assert.match(String(hit.servingNote), /no serving size/)
    assert.equal(itemFromHit(hit).calories, 80)
  })

  it('reads fibre and energy in kJ', () => {
    assert.equal(Math.round(caloriesPer100g({ 'energy-kj_100g': 1674 })), 400)
    const hit = hitFromOffProduct({
      product_name: 'Oats',
      serving_size: '40g',
      nutriments: { 'energy-kj_100g': 1570, proteins_100g: 13, fibre_100g: 10 },
    })
    const item = itemFromHit(hit)
    assert.equal(hit.grams, 40)
    assert.equal(item.fiber_g, 4)
    assert.ok(item.calories > 140 && item.calories < 160)
  })

  it('treats implausible kcal as kilojoules', () => {
    assert.equal(Math.round(caloriesPer100g({ 'energy-kcal_100g': 1674 })), 400)
  })

  it('parses serving text people actually print', () => {
    assert.equal(gramsFromServingText('2 cookies (28 g)'), 28)
    assert.equal(gramsFromServingText('33'), 33)
    assert.equal(gramsFromServingText('39g'), 39)
    assert.ok(Math.abs((gramsFromServingText('1 can (12 fl oz)') ?? 0) - 354.9) < 0.2)
  })

  it('tries UPC, EAN, and GTIN-14 forms of the same barcode', () => {
    assert.deepEqual(barcodeLookupCodes('016000275287'), [
      '016000275287',
      '16000275287',
      '0016000275287',
      '00016000275287',
    ])
    assert.deepEqual(barcodeLookupCodes('16000275287'), [
      '16000275287',
      '016000275287',
      '0016000275287',
      '00016000275287',
    ])
  })

  it('matches the USDA row whose GTIN is the scanned barcode in any zero-padded form', () => {
    assert.equal(sameGtin('00016000275287', '016000275287'), true)
    assert.equal(sameGtin('644225727832', '0644225727832'), true)
    assert.equal(sameGtin('644225727832', '644225727833'), false)
    assert.equal(sameGtin('', ''), false)
    const foods = [
      { gtinUpc: '00016000275287', description: 'Cheerios Cereal' },
      { gtinUpc: '644225727832', description: 'TRIPLE CHOCOLATE PROTEIN ENERGY BAR, TRIPLE CHOCOLATE' },
    ]
    assert.equal(findUsdaBarcodeFood(foods, '644225727832')?.description, foods[1].description)
    assert.equal(findUsdaBarcodeFood(foods, '999999999999'), null)
  })

  it('reads a USDA branded label as the bar it is', () => {
    const hit = hitFromUsdaSearchFood({
      fdcId: 2665580,
      description: 'TRIPLE CHOCOLATE PROTEIN ENERGY BAR, TRIPLE CHOCOLATE',
      brandName: 'POWER CRUNCH',
      dataType: 'Branded',
      gtinUpc: '644225727832',
      servingSize: 40,
      servingSizeUnit: 'GRM',
      householdServingFullText: '1 Cookie',
      foodNutrients: [
        { nutrientId: 1008, value: 550 },
        { nutrientId: 1003, value: 32.5 },
        { nutrientId: 1004, value: 32.5 },
        { nutrientId: 1005, value: 27.5 },
        { nutrientId: 1079, value: 2.5 },
      ],
    })
    assert.equal(hit.name, 'Triple chocolate protein energy bar')
    assert.equal(hit.grams, 40)
    assert.equal(hit.unit, 'piece')
    const item = itemFromHit(hit)
    assert.equal(item.calories, 220)
    assert.equal(item.protein_g, 13)
    assert.equal(item.fiber_g, 1)
    assert.equal(hitSourceLabel(hit), 'USDA FoodData Central')
    assert.equal(lookupConfidence(hit), 0.8)
  })

  it('rescales Open Food Facts macros that were typed per bar instead of per 100g', () => {
    const hit = hitFromOffProduct({
      product_name: 'Protein Bar',
      brands: 'Power crunch',
      serving_quantity: 40,
      serving_size: '1 Bar (40 g)',
      product_quantity: 39.689332375,
      nutriments: {
        'energy-kcal_100g': 550,
        'energy-kcal_serving': 220,
        proteins_100g: 13,
        proteins_serving: 5.2,
        carbohydrates_100g: 11,
        fat_100g: 13,
        fiber_100g: 1,
      },
    })
    assert.equal(hit.grams, 40)
    const item = itemFromHit(hit)
    assert.equal(item.calories, 220)
    assert.equal(item.protein_g, 13)
    assert.equal(item.carbs_g, 11)
    assert.equal(item.fat_g, 13)
    assert.equal(item.fiber_g, 1)
    assert.match(String(hit.servingNote), /per-serving protein/)
    assert.equal(lookupConfidence(hit), 0.5)
    assert.equal(hitSourceLabel(hit), 'Open Food Facts')
  })

  it('leaves Open Food Facts macros alone when they already add up', () => {
    const clean = reconcileOffPer100g(
      { calories: 550, protein_g: 32.5, fiber_g: 2.5, carbs_g: 27.5, fat_g: 32.5 },
      40,
    )
    assert.equal(clean.note, null)
    assert.equal(clean.per_100g.protein_g, 32.5)

    const lowCarbBar = reconcileOffPer100g(
      { calories: 333, protein_g: 35, fiber_g: 23, carbs_g: 35, fat_g: 13 },
      60,
    )
    assert.equal(lowCarbBar.note, null)

    const beer = reconcileOffPer100g(
      { calories: 43, protein_g: 0.5, fiber_g: 0, carbs_g: 3.6, fat_g: 0 },
      355,
    )
    assert.equal(beer.note, null)
    assert.equal(beer.per_100g.carbs_g, 3.6)

    const wrongButNotByTheServing = reconcileOffPer100g(
      { calories: 550, protein_g: 13, fiber_g: 1, carbs_g: 11, fat_g: 13 },
      60,
    )
    assert.equal(wrongButNotByTheServing.note, null)
  })
})
