import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { appendMealItems, blankMealItem, namedMealItems } from './mealItems.ts'
import type { MealItem } from './types.ts'

function item(name: string): MealItem {
  return {
    name,
    grams: 100,
    calories: 120,
    protein_g: 10,
    fiber_g: 2,
    carbs_g: 5,
    fat_g: 3,
  }
}

describe('appendMealItems', () => {
  it('uses the incoming foods when nothing is on the plate yet', () => {
    const next = [item('Yogurt')]
    assert.deepEqual(appendMealItems(null, next), next)
    assert.deepEqual(appendMealItems([], next), next)
    assert.deepEqual(appendMealItems([blankMealItem()], next), next)
  })

  it('keeps named foods and adds the next ones', () => {
    const first = item('Chicken')
    const second = item('Broccoli')
    assert.deepEqual(appendMealItems([first, blankMealItem()], [second]), [first, second])
  })

  it('can add more than one food from a photo estimate', () => {
    const first = item('Rice')
    const extra = [item('Salmon'), item('Salad')]
    assert.deepEqual(appendMealItems([first], extra), [first, ...extra])
  })
})

describe('namedMealItems', () => {
  it('drops blank rows', () => {
    assert.deepEqual(namedMealItems([item('Oats'), blankMealItem()]), [item('Oats')])
  })
})
