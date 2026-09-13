import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  cloneMealItem,
  filterPreviousFoods,
  foodSearchKey,
  previousFoodAssumption,
  previousFoodDetail,
  uniquePreviousFoods,
} from './previousFoods.ts'
import type { MealItem } from './types.ts'

function item(name: string, protein = 7): MealItem {
  return {
    id: `id-${name}`,
    sort_order: 3,
    name,
    grams: 28,
    quantity: 1,
    unit: 'oz',
    grams_per_unit: 28,
    calories: 110,
    protein_g: protein,
    fiber_g: 0,
    carbs_g: 1,
    fat_g: 9,
  }
}

describe('foodSearchKey', () => {
  it('ignores case and extra spaces', () => {
    assert.equal(foodSearchKey('  Cheddar  cheese '), 'cheddar cheese')
  })
})

describe('cloneMealItem', () => {
  it('drops the old row id so a reuse is a new food', () => {
    const cloned = cloneMealItem(item('Cheese'))
    assert.equal(cloned.name, 'Cheese')
    assert.equal(cloned.id, undefined)
    assert.equal(cloned.sort_order, undefined)
    assert.equal(cloned.protein_g, 7)
  })
})

describe('uniquePreviousFoods', () => {
  it('keeps the newest numbers for a repeated name', () => {
    const foods = uniquePreviousFoods([
      { item: item('Cheese', 6), eaten_at: '2026-09-10T12:00:00.000Z' },
      { item: item('cheese', 8), eaten_at: '2026-09-12T12:00:00.000Z' },
      { item: item('Apple'), eaten_at: '2026-09-11T12:00:00.000Z' },
    ])
    assert.deepEqual(
      foods.map((food) => [food.item.name, food.item.protein_g, food.last_eaten_at]),
      [
        ['cheese', 8, '2026-09-12T12:00:00.000Z'],
        ['Apple', 7, '2026-09-11T12:00:00.000Z'],
      ],
    )
  })

  it('skips blank names', () => {
    assert.deepEqual(uniquePreviousFoods([{ item: item('   '), eaten_at: '2026-09-12T12:00:00.000Z' }]), [])
  })
})

describe('filterPreviousFoods', () => {
  it('matches a fragment of the name', () => {
    const foods = uniquePreviousFoods([
      { item: item('Cheddar cheese'), eaten_at: '2026-09-12T12:00:00.000Z' },
      { item: item('Apple'), eaten_at: '2026-09-11T12:00:00.000Z' },
    ])
    assert.deepEqual(
      filterPreviousFoods(foods, 'che').map((food) => food.item.name),
      ['Cheddar cheese'],
    )
  })

  it('returns every food when the search is empty', () => {
    const foods = uniquePreviousFoods([{ item: item('Oats'), eaten_at: '2026-09-12T12:00:00.000Z' }])
    assert.equal(filterPreviousFoods(foods, '  ').length, 1)
  })
})

describe('previousFoodDetail', () => {
  it('shows the last portion plus protein and fiber', () => {
    assert.equal(previousFoodDetail(item('Cheese')), '1 oz · 28g · 7g protein · 0g fiber')
  })
})

describe('previousFoodAssumption', () => {
  it('names the reused food', () => {
    assert.match(previousFoodAssumption('Cheese'), /Cheese/)
  })
})
