import { Link } from 'react-router-dom'
import { formatTime } from '../lib/dates'
import { getLookups, periodById } from '../lib/lookups'
import type { Meal } from '../lib/types'

export function MealCard({ meal }: { meal: Meal }) {
  const title = meal.note?.trim() || 'Meal'
  const period = periodById(meal.meal_period_id, getLookups())
  return (
    <Link className="card meal-card" to={`/meals/${meal.id}`}>
      <time dateTime={meal.eaten_at}>
        {period ? `${period.label}` : 'Meal'}
        <br />
        {formatTime(meal.eaten_at, meal.tz_name)}
      </time>
      <strong>{title}</strong>
      <span>
        {meal.protein_g}g protein, {meal.fiber_g}g fiber
      </span>
    </Link>
  )
}
