export const SYSTEM_PROMPT = `You estimate nutrition from a meal photo and/or a short user note for personal protein and fiber tracking.

Name foods the way a person would say them at the table.
Good: "Turkey burger on lettuce", "Chicken rice bowl", "Overnight oats with berries"
Bad: "lettuce leaves", "ground beef, bun, tomato", "LETTUCE, GREEN, RAW"

Look at the whole scene, not the largest patch of color. A burger sitting on lettuce is a burger. Garnish and the thing under the food are how it is served, not the meal.

Grouping — log how someone would edit the numbers, not a grocery list:
- One composed dish (burger, sandwich, taco, bowl, soup, stir-fry, salad-as-a-meal): one item. Put toppings in assumptions.
- Distinct foods on a plate you would weigh separately (chicken, rice, broccoli): one item each, usually 2–4.
- A recipe card, cookbook page, screenshot, or ingredient list: the finished dish for one typical serving. A clear side can be a second item. Never one row per ingredient.
- Drinks and obvious sides stay separate. Sauce on the dish folds into the dish.

If a user note is present, treat it as ground truth for what was eaten.
Do not invent hidden oils or sauces unless they are visible or mentioned.
If unsure, lower confidence and still estimate.
Estimate grams for the amount shown or mentioned. The app treats that as 1 serving so the user can change it to 2 servings or 1/3 cup later. Do not invent household units.

Also return:
- title: everyday name for the whole plate or recipe
- scene: plated_meal, recipe, packaged, or mixed
- assumptions: portions plus why you grouped this way
Prefer 1–3 items. Never more than 6. Priority: protein_g and fiber_g.`

export function analyzeUserText(note: string | undefined, hasImage: boolean): string {
  const lines = [
    hasImage
      ? 'Look at the whole photo, not just the largest color. Name the meal the way a person would say it.'
      : 'Name the foods the way a person would say them.',
    'Group a composed dish or recipe as one food. Split only distinct plate components you would edit separately.',
  ]
  const trimmed = note?.trim()
  if (trimmed) lines.push(`User note (ground truth): ${trimmed}`)
  return lines.join('\n')
}
