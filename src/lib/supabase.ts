import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { startOfLocalDay, startOfNextLocalDay } from './dates'
import type { Meal, MealItem, MealSource, Profile, SavedMeal, SessionUser } from './types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() ?? ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? ''

export const usingLocalData = !supabaseUrl || !supabaseAnonKey

const AUTH_KEY = 'plate-pal-auth'
const DB_KEY = 'plate-pal-db'

type LocalDb = {
  profiles: Profile[]
  meals: Meal[]
  meal_items: Array<MealItem & { id: string; meal_id: string }>
  saved_meals: SavedMeal[]
}

let client: SupabaseClient | null = null
const authListeners = new Set<(user: SessionUser | null) => void>()

if (!usingLocalData) {
  client = createClient(supabaseUrl, supabaseAnonKey)
}

export function getSupabase(): SupabaseClient {
  if (!client) {
    throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.')
  }
  return client
}

function emptyDb(): LocalDb {
  return { profiles: [], meals: [], meal_items: [], saved_meals: [] }
}

function readDb(): LocalDb {
  try {
    const raw = localStorage.getItem(DB_KEY)
    if (!raw) return emptyDb()
    return { ...emptyDb(), ...JSON.parse(raw) }
  } catch {
    return emptyDb()
  }
}

function writeDb(db: LocalDb) {
  localStorage.setItem(DB_KEY, JSON.stringify(db))
}

function readLocalUser(): SessionUser | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY)
    return raw ? (JSON.parse(raw) as SessionUser) : null
  } catch {
    return null
  }
}

function writeLocalUser(user: SessionUser | null) {
  if (user) localStorage.setItem(AUTH_KEY, JSON.stringify(user))
  else localStorage.removeItem(AUTH_KEY)
  for (const listener of authListeners) listener(user)
}

async function idFromEmail(email: string): Promise<string> {
  const data = new TextEncoder().encode(email.toLowerCase())
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', data)).slice(0, 16)
  hash[6] = (hash[6] & 0x0f) | 0x40
  hash[8] = (hash[8] & 0x3f) | 0x80
  const hex = [...hash].map((b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function toUser(id: string, email: string | null): SessionUser {
  return { id, email }
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  if (usingLocalData) return readLocalUser()
  const { data } = await getSupabase().auth.getUser()
  if (!data.user) return null
  return toUser(data.user.id, data.user.email ?? null)
}

export function onAuthChange(callback: (user: SessionUser | null) => void): () => void {
  if (usingLocalData) {
    authListeners.add(callback)
    return () => {
      authListeners.delete(callback)
    }
  }
  const { data } = getSupabase().auth.onAuthStateChange((_event, session) => {
    callback(session?.user ? toUser(session.user.id, session.user.email ?? null) : null)
  })
  return () => data.subscription.unsubscribe()
}

export async function signInWithMagicLink(email: string): Promise<{ error?: string; local?: boolean }> {
  const trimmed = email.trim().toLowerCase()
  if (!trimmed || !trimmed.includes('@')) return { error: 'Enter a valid email address.' }

  if (usingLocalData) {
    const id = await idFromEmail(trimmed)
    const user = toUser(id, trimmed)
    writeLocalUser(user)
    const db = readDb()
    if (!db.profiles.some((p) => p.id === id)) {
      db.profiles.push({
        id,
        display_name: trimmed.split('@')[0] ?? trimmed,
        protein_goal_g: 150,
        fiber_goal_g: 30,
        calorie_goal: null,
      })
      writeDb(db)
    }
    return { local: true }
  }

  const { error } = await getSupabase().auth.signInWithOtp({
    email: trimmed,
    options: { emailRedirectTo: window.location.origin },
  })
  if (error) return { error: error.message }
  return {}
}

export async function signInWithGoogle(): Promise<{ error?: string }> {
  if (usingLocalData) {
    return { error: 'Google sign-in needs Supabase. Add keys in .env, or use email in local mode.' }
  }
  const { error } = await getSupabase().auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  })
  if (error) return { error: error.message }
  return {}
}

export async function signOut(): Promise<void> {
  if (usingLocalData) {
    writeLocalUser(null)
    return
  }
  await getSupabase().auth.signOut()
}

function defaultProfile(user: SessionUser): Profile {
  const fromEmail = user.email ? user.email.split('@')[0] : 'You'
  return {
    id: user.id,
    display_name: fromEmail ?? 'You',
    protein_goal_g: 150,
    fiber_goal_g: 30,
    calorie_goal: null,
  }
}

export async function fetchProfile(userId: string): Promise<Profile | null> {
  if (usingLocalData) {
    return readDb().profiles.find((p) => p.id === userId) ?? null
  }
  const { data, error } = await getSupabase().from('profiles').select('*').eq('id', userId).maybeSingle()
  if (error) throw new Error(error.message)
  return data as Profile | null
}

export async function ensureProfile(user: SessionUser): Promise<Profile> {
  const existing = await fetchProfile(user.id)
  if (existing) return existing
  const profile = defaultProfile(user)
  if (usingLocalData) {
    const db = readDb()
    db.profiles.push(profile)
    writeDb(db)
    return profile
  }
  const { data, error } = await getSupabase().from('profiles').insert(profile).select('*').single()
  if (error) {
    const retry = await fetchProfile(user.id)
    if (retry) return retry
    throw new Error(error.message)
  }
  return data as Profile
}

export async function saveProfile(profile: Profile): Promise<{ error?: string }> {
  const row = {
    display_name: profile.display_name,
    protein_goal_g: profile.protein_goal_g,
    fiber_goal_g: profile.fiber_goal_g,
    calorie_goal: profile.calorie_goal,
    updated_at: new Date().toISOString(),
  }
  if (usingLocalData) {
    const db = readDb()
    const index = db.profiles.findIndex((p) => p.id === profile.id)
    if (index === -1) db.profiles.push(profile)
    else db.profiles[index] = { ...db.profiles[index], ...profile }
    writeDb(db)
    return {}
  }
  const { error } = await getSupabase().from('profiles').update(row).eq('id', profile.id)
  if (error) return { error: error.message }
  return {}
}

export async function fetchMealsForDay(userId: string, day: Date): Promise<Meal[]> {
  const start = startOfLocalDay(day).toISOString()
  const end = startOfNextLocalDay(day).toISOString()
  if (usingLocalData) {
    return readDb()
      .meals.filter((m) => m.user_id === userId && m.eaten_at >= start && m.eaten_at < end)
      .sort((a, b) => b.eaten_at.localeCompare(a.eaten_at))
  }
  const { data, error } = await getSupabase()
    .from('meals')
    .select('*')
    .eq('user_id', userId)
    .gte('eaten_at', start)
    .lt('eaten_at', end)
    .order('eaten_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as Meal[]
}

export async function fetchMealWithItems(
  mealId: string,
  userId: string,
): Promise<{ meal: Meal; items: MealItem[] } | null> {
  if (usingLocalData) {
    const db = readDb()
    const meal = db.meals.find((m) => m.id === mealId && m.user_id === userId)
    if (!meal) return null
    const items = db.meal_items
      .filter((item) => item.meal_id === mealId)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    return { meal, items }
  }
  const { data: meal, error } = await getSupabase().from('meals').select('*').eq('id', mealId).eq('user_id', userId).maybeSingle()
  if (error) throw new Error(error.message)
  if (!meal) return null
  const { data: items, error: itemError } = await getSupabase()
    .from('meal_items')
    .select('*')
    .eq('meal_id', mealId)
    .order('sort_order', { ascending: true })
  if (itemError) throw new Error(itemError.message)
  return { meal: meal as Meal, items: (items ?? []) as MealItem[] }
}

type MealWrite = {
  note: string | null
  source: MealSource
  eaten_at: string
  calories: number
  protein_g: number
  fiber_g: number
  carbs_g: number
  fat_g: number
  confidence: number | null
  items: MealItem[]
}

function itemRows(mealId: string, items: MealItem[]) {
  return items.map((item, index) => ({
    meal_id: mealId,
    name: item.name.trim(),
    grams: item.grams,
    calories: item.calories,
    protein_g: item.protein_g,
    fiber_g: item.fiber_g,
    carbs_g: item.carbs_g,
    fat_g: item.fat_g,
    sort_order: index,
  }))
}

export async function createMeal(userId: string, input: MealWrite): Promise<{ id: string }> {
  if (usingLocalData) {
    const id = crypto.randomUUID()
    const db = readDb()
    db.meals.push({
      id,
      user_id: userId,
      eaten_at: input.eaten_at,
      note: input.note,
      source: input.source,
      calories: input.calories,
      protein_g: input.protein_g,
      fiber_g: input.fiber_g,
      carbs_g: input.carbs_g,
      fat_g: input.fat_g,
      confidence: input.confidence,
    })
    for (const row of itemRows(id, input.items)) {
      db.meal_items.push({ ...row, id: crypto.randomUUID() })
    }
    writeDb(db)
    return { id }
  }

  const { data, error } = await getSupabase()
    .from('meals')
    .insert({
      user_id: userId,
      eaten_at: input.eaten_at,
      note: input.note,
      source: input.source,
      calories: input.calories,
      protein_g: input.protein_g,
      fiber_g: input.fiber_g,
      carbs_g: input.carbs_g,
      fat_g: input.fat_g,
      confidence: input.confidence,
    })
    .select('id')
    .single()
  if (error || !data) throw new Error(error?.message ?? 'Could not save meal.')
  const rows = itemRows(data.id, input.items)
  if (rows.length) {
    const { error: itemError } = await getSupabase().from('meal_items').insert(rows)
    if (itemError) throw new Error(itemError.message)
  }
  return { id: data.id as string }
}

export async function updateMeal(mealId: string, userId: string, input: MealWrite): Promise<void> {
  if (usingLocalData) {
    const db = readDb()
    const index = db.meals.findIndex((m) => m.id === mealId && m.user_id === userId)
    if (index === -1) throw new Error('Meal not found.')
    db.meals[index] = {
      ...db.meals[index],
      note: input.note,
      source: input.source,
      eaten_at: input.eaten_at,
      calories: input.calories,
      protein_g: input.protein_g,
      fiber_g: input.fiber_g,
      carbs_g: input.carbs_g,
      fat_g: input.fat_g,
      confidence: input.confidence,
    }
    db.meal_items = db.meal_items.filter((item) => item.meal_id !== mealId)
    for (const row of itemRows(mealId, input.items)) {
      db.meal_items.push({ ...row, id: crypto.randomUUID() })
    }
    writeDb(db)
    return
  }

  const { error } = await getSupabase()
    .from('meals')
    .update({
      note: input.note,
      source: input.source,
      eaten_at: input.eaten_at,
      calories: input.calories,
      protein_g: input.protein_g,
      fiber_g: input.fiber_g,
      carbs_g: input.carbs_g,
      fat_g: input.fat_g,
      confidence: input.confidence,
    })
    .eq('id', mealId)
    .eq('user_id', userId)
  if (error) throw new Error(error.message)
  const { error: deleteError } = await getSupabase().from('meal_items').delete().eq('meal_id', mealId)
  if (deleteError) throw new Error(deleteError.message)
  const rows = itemRows(mealId, input.items)
  if (rows.length) {
    const { error: itemError } = await getSupabase().from('meal_items').insert(rows)
    if (itemError) throw new Error(itemError.message)
  }
}

export async function deleteMeal(mealId: string, userId: string): Promise<void> {
  if (usingLocalData) {
    const db = readDb()
    db.meals = db.meals.filter((m) => !(m.id === mealId && m.user_id === userId))
    db.meal_items = db.meal_items.filter((item) => item.meal_id !== mealId)
    writeDb(db)
    return
  }
  const { error } = await getSupabase().from('meals').delete().eq('id', mealId).eq('user_id', userId)
  if (error) throw new Error(error.message)
}

export async function fetchSavedMeals(userId: string): Promise<SavedMeal[]> {
  if (usingLocalData) {
    return readDb()
      .saved_meals.filter((m) => m.user_id === userId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
  }
  const { data, error } = await getSupabase()
    .from('saved_meals')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as SavedMeal[]
}

export async function createSavedMeal(
  userId: string,
  input: {
    name: string
    note: string | null
    calories: number
    protein_g: number
    fiber_g: number
    carbs_g: number
    fat_g: number
    items: MealItem[]
  },
): Promise<void> {
  const row = {
    user_id: userId,
    name: input.name.trim(),
    note: input.note,
    calories: input.calories,
    protein_g: input.protein_g,
    fiber_g: input.fiber_g,
    carbs_g: input.carbs_g,
    fat_g: input.fat_g,
    items: input.items,
  }
  if (usingLocalData) {
    const db = readDb()
    db.saved_meals.push({
      ...row,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
    })
    writeDb(db)
    return
  }
  const { error } = await getSupabase().from('saved_meals').insert(row)
  if (error) throw new Error(error.message)
}

export async function renameSavedMeal(id: string, userId: string, name: string): Promise<void> {
  if (usingLocalData) {
    const db = readDb()
    const found = db.saved_meals.find((m) => m.id === id && m.user_id === userId)
    if (!found) throw new Error('Saved meal not found.')
    found.name = name.trim()
    writeDb(db)
    return
  }
  const { error } = await getSupabase().from('saved_meals').update({ name: name.trim() }).eq('id', id).eq('user_id', userId)
  if (error) throw new Error(error.message)
}

export async function deleteSavedMeal(id: string, userId: string): Promise<void> {
  if (usingLocalData) {
    const db = readDb()
    db.saved_meals = db.saved_meals.filter((m) => !(m.id === id && m.user_id === userId))
    writeDb(db)
    return
  }
  const { error } = await getSupabase().from('saved_meals').delete().eq('id', id).eq('user_id', userId)
  if (error) throw new Error(error.message)
}
