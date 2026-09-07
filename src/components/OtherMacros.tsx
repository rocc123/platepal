import { formatGrams } from '../lib/totals'

type OtherMacrosProps = {
  calories: number
  carbs: number
  fat: number
  showCalories?: boolean
}

export function OtherMacros({ calories, carbs, fat, showCalories = true }: OtherMacrosProps) {
  return (
    <div className={`other-macros${showCalories ? '' : ' other-macros-two'}`}>
      {showCalories ? (
        <span>
          <strong>{Math.round(calories)}</strong>
          <em>cal</em>
        </span>
      ) : null}
      <span>
        <strong>{formatGrams(carbs)}</strong>
        <em>g carbs</em>
      </span>
      <span>
        <strong>{formatGrams(fat)}</strong>
        <em>g fat</em>
      </span>
    </div>
  )
}
