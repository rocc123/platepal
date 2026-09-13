import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  defaultSavedMealName,
  displayMealName,
  looksLikeDishTitle,
  mealNameFromItems,
  shortFoodLabel,
} from './mealNames.ts'
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

describe('shortFoodLabel', () => {
  it('keeps a spoken dish name', () => {
    assert.equal(shortFoodLabel('Turkey burger on lettuce'), 'Turkey burger on lettuce')
  })

  it('drops a leading weight so a note is not the title', () => {
    assert.equal(shortFoodLabel('200g chicken, rice, and a pile of broccoli'), 'Chicken')
  })
})

describe('mealNameFromItems', () => {
  it('prefers the analyze title over a grocery-list note', () => {
    assert.equal(
      mealNameFromItems([item('Chicken'), item('Rice'), item('Broccoli')], {
        title: 'Chicken rice bowl',
        note: '200g chicken, rice, and a pile of broccoli',
      }),
      'Chicken rice bowl',
    )
  })

  it('joins a few plated foods when there is no title', () => {
    assert.equal(
      mealNameFromItems([item('Chicken breast'), item('Rice'), item('Broccoli')]),
      'Chicken breast + Rice + Broccoli',
    )
  })

  it('summarizes a longer plate', () => {
    assert.equal(
      mealNameFromItems([item('Oats'), item('Berries'), item('Yogurt'), item('Honey')]),
      'Oats + Berries + 2 more',
    )
  })

  it('does not use a long note as the name when foods exist', () => {
    assert.equal(
      mealNameFromItems([item('Leftover chili')], {
        note: 'had this after the gym, extra cheese',
      }),
      'Leftover chili',
    )
  })

  it('falls back to the period when nothing was named', () => {
    assert.equal(mealNameFromItems([], { fallback: 'Lunch' }), 'Lunch')
  })
})

describe('displayMealName', () => {
  it('uses the stored name', () => {
    assert.equal(displayMealName({ name: 'Chicken rice bowl', note: 'no bun' }), 'Chicken rice bowl')
  })

  it('does not put a long leftover note on the card', () => {
    assert.equal(
      displayMealName({ name: '', note: '200g chicken, rice, and a pile of broccoli' }, 'Dinner'),
      'Dinner',
    )
  })

  it('can use a short note when an old meal has no name', () => {
    assert.equal(displayMealName({ name: '', note: 'leftover chili' }, 'Lunch'), 'Leftover chili')
  })
})

describe('looksLikeDishTitle', () => {
  it('accepts a short spoken name', () => {
    assert.equal(looksLikeDishTitle('leftover chili'), true)
    assert.equal(looksLikeDishTitle('200g chicken, rice, and broccoli'), false)
  })
})

describe('defaultSavedMealName', () => {
  it('adds the period to a single food', () => {
    assert.equal(defaultSavedMealName([item('Oats')], '', 'Breakfast'), 'Oats Breakfast')
  })
})
