import { Link } from 'react-router-dom'
import { formatTime } from '../lib/dates'
import { getLookups, periodById } from '../lib/lookups'
import { displayMealName } from '../lib/mealNames'
import { formatFocusLine, formatOtherLine } from '../lib/totals'
import type { Meal } from '../lib/types'

export function MealCard({ meal }: { meal: Meal }) {
  const period = periodById(meal.meal_period_id, getLookups())
  const title = displayMealName(meal, period?.label)
  return (
    <Link className="card meal-card" to={`/meals/${meal.id}`}>
      <time dateTime={meal.eaten_at}>
        {period ? `${period.label}` : 'Meal'}
        <br />
        {formatTime(meal.eaten_at, meal.tz_name)}
      </time>
      <strong>{title}</strong>
      <span>{formatFocusLine(meal.protein_g, meal.fiber_g)}</span>
      <span>{formatOtherLine(meal.calories, meal.carbs_g, meal.fat_g)}</span>
    </Link>
  )
}
