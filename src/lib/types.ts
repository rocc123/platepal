export type MealSource = 'photo' | 'text' | 'saved' | 'manual'

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
}

export type Meal = {
  id: string
  user_id: string
  eaten_at: string
  note: string | null
  source: MealSource
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
