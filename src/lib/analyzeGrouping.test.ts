import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { mergeMealItems, normalizeAnalyzeResult, parseAnalyzeScene } from './analyzeGrouping.ts'
import { humanizeFoodName } from './foodNames.ts'
import { analyzeUserText } from './analyzePrompt.ts'
import type { AnalyzeResult, MealItem } from './types.ts'

function item(name: string, protein = 1, fiber = 0.5): MealItem {
  return {
    name,
    grams: 50,
    calories: 40,
    protein_g: protein,
    fiber_g: fiber,
    carbs_g: 3,
    fat_g: 2,
  }
}

function result(partial: Partial<AnalyzeResult> & Pick<AnalyzeResult, 'items'>): AnalyzeResult {
  return {
    totals: { calories: 0, protein_g: 0, fiber_g: 0, carbs_g: 0, fat_g: 0 },
    confidence: 0.6,
    assumptions: 'Assumed a home serving.',
    ...partial,
  }
}

describe('analyze grouping', () => {
  it('collapses a recipe shopping list into the finished dish', () => {
    const next = normalizeAnalyzeResult(
      result({
        title: 'Chicken enchiladas',
        scene: 'recipe',
        items: [
          item('chicken'),
          item('tortillas'),
          item('cheese'),
          item('enchilada sauce'),
          item('onion'),
        ],
      }),
    )
    assert.equal(next.items.length, 1)
    assert.equal(next.items[0]?.name, 'Chicken enchiladas')
    assert.equal(next.items[0]?.protein_g, 5)
    assert.match(next.assumptions, /finished dish/)
  })

  it('keeps distinct plated foods separate', () => {
    const next = normalizeAnalyzeResult(
      result({
        title: 'Chicken plate',
        scene: 'plated_meal',
        items: [item('Grilled chicken'), item('Rice'), item('Broccoli')],
      }),
    )
    assert.equal(next.items.length, 3)
    assert.equal(next.items[1]?.name, 'Rice')
    assert.equal(next.assumptions, 'Assumed a home serving.')
  })

  it('names a single plated dish and explains the grouping', () => {
    const next = normalizeAnalyzeResult(
      result({
        title: 'Turkey burger on lettuce',
        scene: 'plated_meal',
        items: [item('Turkey burger on lettuce', 24, 2)],
      }),
    )
    assert.equal(next.items.length, 1)
    assert.equal(next.title, 'Turkey burger on lettuce')
    assert.equal(next.items[0]?.unit, 'serving')
    assert.equal(next.items[0]?.quantity, 1)
    assert.match(next.assumptions, /Named the dish/)
  })

  it('does not collapse when scene is missing', () => {
    const next = normalizeAnalyzeResult(
      result({
        items: [item('chicken'), item('cheese'), item('tortilla'), item('sauce')],
      }),
    )
    assert.equal(next.items.length, 4)
  })

  it('merges two foods and sums the tracked numbers', () => {
    const merged = mergeMealItems([item('Burger', 20, 2), item('Fries', 3, 3)], 'Burger and fries')
    assert.equal(merged.name, 'Burger and fries')
    assert.equal(merged.protein_g, 23)
    assert.equal(merged.fiber_g, 5)
    assert.equal(merged.grams, 100)
  })

  it('parses known scenes only', () => {
    assert.equal(parseAnalyzeScene('recipe'), 'recipe')
    assert.equal(parseAnalyzeScene('shopping_list'), undefined)
  })
})

describe('food names', () => {
  it('softens USDA catalog caps without inventing a new food', () => {
    assert.equal(humanizeFoodName('LETTUCE, GREEN LEAF, RAW'), 'Lettuce, green leaf, raw')
    assert.equal(
      humanizeFoodName('TRIPLE CHOCOLATE PROTEIN ENERGY BAR, TRIPLE CHOCOLATE'),
      'Triple chocolate protein energy bar',
    )
    assert.equal(humanizeFoodName('Turkey burger on lettuce'), 'Turkey burger on lettuce')
  })
})

describe('analyze user text', () => {
  it('asks Gemini to name the whole plate and keep a user note as truth', () => {
    const text = analyzeUserText('no bun', true)
    assert.match(text, /whole photo/)
    assert.match(text, /User note \(ground truth\): no bun/)
    assert.match(text, /composed dish or recipe/)
  })
})
