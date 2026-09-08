export type MealSourceRow = {
  id: number
  code: string
  label: string
  sort_order: number
}

export type MealPeriodRow = {
  id: number
  code: string
  label: string
  sort_order: number
  start_hour: number | null
  end_hour: number | null
}

export type MealItem = {
  id?: string
  name: string
  grams: number | null
  calories: number
  protein_g: number
  fiber_g: number
  carbs_g: number
  fat_g: number
  sort_order?: number
  per_100g?: {
    calories: number
    protein_g: number
    fiber_g: number
    carbs_g: number
    fat_g: number
  }
}

export type Meal = {
  id: string
  user_id: string
  eaten_at: string
  duration_minutes: number
  note: string | null
  source_id: number
  meal_period_id: number
  tz_name: string
  tz_offset_minutes: number
  calories: number
  protein_g: number
  fiber_g: number
  carbs_g: number
  fat_g: number
  confidence: number | null
}

export type Profile = {
  id: string
  display_name: string | null
  protein_goal_g: number
  fiber_goal_g: number
  calorie_goal: number | null
}

export type AnalyzeScene = 'plated_meal' | 'recipe' | 'packaged' | 'mixed'

export type AnalyzeResult = {
  items: MealItem[]
  totals: {
    calories: number
    protein_g: number
    fiber_g: number
    carbs_g: number
    fat_g: number
  }
  confidence: number
  assumptions: string
  title?: string
  scene?: AnalyzeScene
}

export type SavedMeal = {
  id: string
  user_id: string
  name: string
  note: string | null
  calories: number
  protein_g: number
  fiber_g: number
  carbs_g: number
  fat_g: number
  items: MealItem[]
  created_at: string
}

export type SessionUser = {
  id: string
  email: string | null
}

export type AnalyzeRequest = {
  note?: string
  imageBase64?: string
  mimeType?: string
}
