import { Link } from 'react-router-dom'
import { formatTime } from '../lib/dates'
import type { Meal } from '../lib/types'

export function MealCard({ meal }: { meal: Meal }) {
  const title = meal.note?.trim() || 'Meal'
  return (
    <Link className="card meal-card" to={`/meals/${meal.id}`}>
      <time dateTime={meal.eaten_at}>{formatTime(meal.eaten_at)}</time>
      <strong>{title}</strong>
      <span>
        {meal.protein_g}g protein · {meal.fiber_g}g fiber
      </span>
    </Link>
  )
}
