import { createClient, type EmailOtpType, type SupabaseClient } from '@supabase/supabase-js'
import { fromUtc, startOfLocalDay, startOfNextLocalDay, zoneStamp } from './dates'
import { resolveSupabaseBrowserEnv } from './env'
import { parseDurationMinutes } from './fasting'
import { LOOKUP_SEED, inferPeriodId, setLookups, sourceIdByCode, type Lookups } from './lookups'
import { ensurePortion } from './portions'
import type { Meal, MealItem, MealPeriodRow, MealSourceRow, Profile, SavedMeal, SessionUser } from './types'

const { url: supabaseUrl, anonKey: supabaseAnonKey } = resolveSupabaseBrowserEnv(
  import.meta.env as unknown as Record<string, string | undefined>,
)

export const usingLocalData = !supabaseUrl || !supabaseAnonKey

const AUTH_KEY = 'plate-pal-auth'
const DB_KEY = 'plate-pal-db'
const OTP_EMAIL_KEY = 'plate-pal-otp-email'

const AUTH_CALLBACK_KEYS = ['code', 'token_hash', 'access_token', 'error', 'error_description', 'error_code']
const EMAIL_OTP_TYPES = new Set<EmailOtpType>([
  'email',
  'magiclink',
  'signup',
  'recovery',
  'invite',
  'email_change',
])

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

function coerceSourceId(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && /^\d+$/.test(value)) return Number(value)
  if (typeof value === 'string') {
    try {
      return sourceIdByCode(value)
    } catch {
      return sourceIdByCode('manual')
    }
  }
  return sourceIdByCode('manual')
}

function coercePeriodId(value: unknown, eatenAt: string, tzName?: string | null): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && /^\d+$/.test(value)) return Number(value)
  return inferPeriodId(fromUtc(eatenAt, tzName))
}

export function normalizeMeal(row: Record<string, unknown>): Meal {
  const eaten_at = String(row.eaten_at)
  const tz_name = String(row.tz_name || appZoneFallback())
  const stamp = zoneStamp(fromUtc(eaten_at, tz_name))
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    eaten_at,
    duration_minutes: parseDurationMinutes(row.duration_minutes as string | number | null | undefined),
    note: (row.note as string | null) ?? null,
    source_id: coerceSourceId(row.source_id ?? row.source),
    meal_period_id: coercePeriodId(row.meal_period_id, eaten_at, tz_name),
    tz_name,
    tz_offset_minutes: Number(row.tz_offset_minutes ?? stamp.tz_offset_minutes),
    calories: Number(row.calories ?? 0),
    protein_g: Number(row.protein_g ?? 0),
    fiber_g: Number(row.fiber_g ?? 0),
    carbs_g: Number(row.carbs_g ?? 0),
    fat_g: Number(row.fat_g ?? 0),
    confidence: row.confidence == null ? null : Number(row.confidence),
  }
}

function appZoneFallback() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
}

export async function loadLookups(): Promise<Lookups> {
  if (usingLocalData) {
    setLookups(LOOKUP_SEED)
    return LOOKUP_SEED
  }
  try {
    const supabase = getSupabase()
    const [sources, periods] = await Promise.all([
      supabase.from('meal_sources').select('*').order('sort_order'),
      supabase.from('meal_periods').select('*').order('sort_order'),
    ])
    if (sources.error || periods.error) throw sources.error ?? periods.error
    const next: Lookups = {
      sources: (sources.data as MealSourceRow[] | null) ?? LOOKUP_SEED.sources,
      periods: (periods.data as MealPeriodRow[] | null) ?? LOOKUP_SEED.periods,
    }
    setLookups(next)
    return next
  } catch {
    setLookups(LOOKUP_SEED)
    return LOOKUP_SEED
  }
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
    const parsed = { ...emptyDb(), ...JSON.parse(raw) } as LocalDb
    parsed.meals = (parsed.meals ?? []).map((meal) => normalizeMeal(meal as unknown as Record<string, unknown>))
    return parsed
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
    options: { shouldCreateUser: true },
  })
  if (error) return { error: error.message }
  rememberOtpEmail(trimmed)
  return {}
}

export async function verifyEmailCode(email: string, token: string): Promise<{ error?: string }> {
  const trimmedEmail = email.trim().toLowerCase()
  const trimmedToken = token.replace(/\s+/g, '')
  if (!trimmedEmail || !trimmedEmail.includes('@')) return { error: 'Enter a valid email address.' }
  if (!trimmedToken) return { error: 'Enter the code from your email.' }

  if (usingLocalData) {
    const result = await signInWithMagicLink(trimmedEmail)
    return result.error ? { error: result.error } : {}
  }

  const { error } = await getSupabase().auth.verifyOtp({
    email: trimmedEmail,
    token: trimmedToken,
    type: 'email',
  })
  if (error) return { error: error.message }
  clearOtpEmail()
  return {}
}

export function rememberOtpEmail(email: string) {
  sessionStorage.setItem(OTP_EMAIL_KEY, email)
}

export function readOtpEmail(): string | null {
  try {
    return sessionStorage.getItem(OTP_EMAIL_KEY)
  } catch {
    return null
  }
}

export function clearOtpEmail() {
  sessionStorage.removeItem(OTP_EMAIL_KEY)
}

export function authRedirectTo() {
  return `${window.location.origin}/login`
}

export function hasAuthCallbackParams(href = window.location.href): boolean {
  const url = new URL(href)
  const hash = new URLSearchParams(url.hash.replace(/^#/, ''))
  return AUTH_CALLBACK_KEYS.some((key) => url.searchParams.has(key) || hash.has(key))
}

export async function completeEmailAuthFromUrl(): Promise<{ error?: string; user?: SessionUser | null }> {
  if (usingLocalData) return { user: readLocalUser() }

  const supabase = getSupabase()
  const url = new URL(window.location.href)
  const hash = new URLSearchParams(url.hash.replace(/^#/, ''))
  const tokenHash = url.searchParams.get('token_hash') ?? hash.get('token_hash')
  const rawType = url.searchParams.get('type') ?? hash.get('type')
  const type = rawType && EMAIL_OTP_TYPES.has(rawType as EmailOtpType) ? (rawType as EmailOtpType) : 'email'
  const errorDescription =
    url.searchParams.get('error_description') ??
    url.searchParams.get('error') ??
    hash.get('error_description') ??
    hash.get('error')

  if (tokenHash) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
    clearAuthParamsFromUrl()
    if (error) return { error: friendlyAuthError(error.message), user: null }
    clearOtpEmail()
    return { user: await getCurrentUser() }
  }

  const { data, error } = await supabase.auth.getSession()
  const hadCallback = hasAuthCallbackParams()
  if (hadCallback) clearAuthParamsFromUrl()

  if (errorDescription) {
    return { error: friendlyAuthError(decodeURIComponent(errorDescription.replace(/\+/g, ' '))), user: null }
  }
  if (error) return { error: friendlyAuthError(error.message), user: null }
  if (data.session?.user) {
    clearOtpEmail()
    return { user: toUser(data.session.user.id, data.session.user.email ?? null) }
  }
  if (hadCallback) {
    return {
      error:
        'That email link could not sign this app in. Home screen apps open links in the browser, so enter the code from the email here instead.',
      user: null,
    }
  }
  return { user: await getCurrentUser() }
}

function friendlyAuthError(message: string) {
  const lower = message.toLowerCase()
  if (lower.includes('pkce') || lower.includes('code verifier') || lower.includes('verifier')) {
    return 'That email link opened in a different browser than the app. Enter the code from the email here instead.'
  }
  return message
}

function clearAuthParamsFromUrl() {
  const url = new URL(window.location.href)
  for (const key of AUTH_CALLBACK_KEYS) url.searchParams.delete(key)
  url.searchParams.delete('type')
  url.hash = ''
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}`)
}

export async function signInWithGoogle(): Promise<{ error?: string }> {
  if (usingLocalData) {
    return { error: 'Google sign-in needs Supabase. Add keys in .env, or use email in local mode.' }
  }
  const { error } = await getSupabase().auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: authRedirectTo() },
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

export async function fetchMealsForRange(userId: string, start: Date, end: Date): Promise<Meal[]> {
  const startIso = start.toISOString()
  const endIso = end.toISOString()
  if (usingLocalData) {
    return readDb()
      .meals.filter((m) => m.user_id === userId && m.eaten_at >= startIso && m.eaten_at < endIso)
      .sort((a, b) => a.eaten_at.localeCompare(b.eaten_at))
  }
  const { data, error } = await getSupabase()
    .from('meals')
    .select('*')
    .eq('user_id', userId)
    .gte('eaten_at', startIso)
    .lt('eaten_at', endIso)
    .order('eaten_at', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => normalizeMeal(row as Record<string, unknown>))
}

export async function fetchLatestMeal(userId: string): Promise<Meal | null> {
  if (usingLocalData) {
    return (
      readDb()
        .meals.filter((m) => m.user_id === userId)
        .sort((a, b) => b.eaten_at.localeCompare(a.eaten_at))[0] ?? null
    )
  }
  const { data, error } = await getSupabase()
    .from('meals')
    .select('*')
    .eq('user_id', userId)
    .order('eaten_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? normalizeMeal(data as Record<string, unknown>) : null
}

export async function fetchLatestMealBefore(userId: string, beforeIso: string): Promise<Meal | null> {
  if (usingLocalData) {
    return (
      readDb()
        .meals.filter((m) => m.user_id === userId && m.eaten_at < beforeIso)
        .sort((a, b) => b.eaten_at.localeCompare(a.eaten_at))[0] ?? null
    )
  }
  const { data, error } = await getSupabase()
    .from('meals')
    .select('*')
    .eq('user_id', userId)
    .lt('eaten_at', beforeIso)
    .order('eaten_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? normalizeMeal(data as Record<string, unknown>) : null
}

export async function fetchMealsForDay(userId: string, day: Date): Promise<Meal[]> {
  const meals = await fetchMealsForRange(userId, startOfLocalDay(day), startOfNextLocalDay(day))
  return [...meals].sort((a, b) => b.eaten_at.localeCompare(a.eaten_at))
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
      .map(ensurePortion)
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
  return {
    meal: normalizeMeal(meal as Record<string, unknown>),
    items: ((items ?? []) as MealItem[]).map(ensurePortion),
  }
}

type MealWrite = {
  note: string | null
  source_id: number
  meal_period_id: number
  eaten_at: string
  duration_minutes: number
  tz_name: string
  tz_offset_minutes: number
  calories: number
  protein_g: number
  fiber_g: number
  carbs_g: number
  fat_g: number
  confidence: number | null
  items: MealItem[]
}

function itemRows(mealId: string, items: MealItem[]) {
  return items.map((item, index) => {
    const portion = ensurePortion(item)
    return {
      meal_id: mealId,
      name: portion.name.trim(),
      grams: portion.grams,
      quantity: portion.quantity ?? 1,
      unit: portion.unit ?? 'serving',
      grams_per_unit: portion.grams_per_unit ?? null,
      measures: portion.measures,
      per_100g: portion.per_100g,
      calories: portion.calories,
      protein_g: portion.protein_g,
      fiber_g: portion.fiber_g,
      carbs_g: portion.carbs_g,
      fat_g: portion.fat_g,
      sort_order: index,
    }
  })
}

export async function createMeal(userId: string, input: MealWrite): Promise<{ id: string }> {
  if (usingLocalData) {
    const id = crypto.randomUUID()
    const db = readDb()
    db.meals.push({
      id,
      user_id: userId,
      eaten_at: input.eaten_at,
      duration_minutes: parseDurationMinutes(input.duration_minutes),
      note: input.note,
      source_id: input.source_id,
      meal_period_id: input.meal_period_id,
      tz_name: input.tz_name,
      tz_offset_minutes: input.tz_offset_minutes,
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
      duration_minutes: parseDurationMinutes(input.duration_minutes),
      note: input.note,
      source_id: input.source_id,
      meal_period_id: input.meal_period_id,
      tz_name: input.tz_name,
      tz_offset_minutes: input.tz_offset_minutes,
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
      source_id: input.source_id,
      meal_period_id: input.meal_period_id,
      eaten_at: input.eaten_at,
      duration_minutes: parseDurationMinutes(input.duration_minutes),
      tz_name: input.tz_name,
      tz_offset_minutes: input.tz_offset_minutes,
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
      source_id: input.source_id,
      meal_period_id: input.meal_period_id,
      eaten_at: input.eaten_at,
      duration_minutes: parseDurationMinutes(input.duration_minutes),
      tz_name: input.tz_name,
      tz_offset_minutes: input.tz_offset_minutes,
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
      .map(hydrateSavedMeal)
  }
  const { data, error } = await getSupabase()
    .from('saved_meals')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return ((data ?? []) as SavedMeal[]).map(hydrateSavedMeal)
}

function hydrateSavedMeal(meal: SavedMeal): SavedMeal {
  return { ...meal, items: (meal.items ?? []).map(ensurePortion) }
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
