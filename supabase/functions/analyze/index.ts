import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SYSTEM_PROMPT = `You estimate nutrition from a meal photo and/or a short user note for personal protein and fiber tracking.

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

Also return:
- title: everyday name for the whole plate or recipe
- scene: plated_meal, recipe, packaged, or mixed
- assumptions: portions plus why you grouped this way
Prefer 1–3 items. Never more than 6. Priority: protein_g and fiber_g.`

const ANALYZE_SCENES = ['plated_meal', 'recipe', 'packaged', 'mixed'] as const

function analyzeUserText(note: string | undefined, hasImage: boolean): string {
  const lines = [
    hasImage
      ? 'Look at the whole photo, not just the largest color. Name the meal the way a person would say it.'
      : 'Name the foods the way a person would say them.',
    'Group a composed dish or recipe as one food. Split only distinct plate components you would edit separately.',
  ]
  if (note) lines.push(`User note (ground truth): ${note}`)
  return lines.join('\n')
}

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type AnalyzeRequest = {
  note?: string
  imageBase64?: string
  mimeType?: string
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

function firstNonEmpty(...values: Array<string | undefined | null>): string | undefined {
  for (const value of values) {
    const trimmed = value?.trim()
    if (trimmed) return trimmed
  }
  return undefined
}

/** Marketplace and newer CLI inject publishable keys instead of SUPABASE_ANON_KEY. */
function getAnonOrPublishableKey() {
  const direct = firstNonEmpty(
    Deno.env.get('SUPABASE_ANON_KEY'),
    Deno.env.get('SUPABASE_PUBLISHABLE_KEY'),
  )
  if (direct) return direct

  const raw = Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')
  if (!raw) return undefined
  try {
    const parsed = JSON.parse(raw) as Record<string, string>
    return firstNonEmpty(parsed.default, ...Object.values(parsed))
  } catch {
    return undefined
  }
}

function stripFences(text: string) {
  return text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
}

function roundNutrition(value: number, calories = false) {
  if (!Number.isFinite(value)) return 0
  return calories ? Math.round(value) : Math.round(value * 10) / 10
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

type GeminiCallError = Error & { status?: number }

const DEFAULT_MODELS = ['gemini-3.1-flash-lite', 'gemini-3.5-flash-lite']
const PREMIUM_FLASH = /gemini-3\.(6|7|8)-flash$/i

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    items: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING' },
          grams: { type: 'NUMBER' },
          calories: { type: 'NUMBER' },
          protein_g: { type: 'NUMBER' },
          fiber_g: { type: 'NUMBER' },
          carbs_g: { type: 'NUMBER' },
          fat_g: { type: 'NUMBER' },
        },
        required: ['name', 'protein_g', 'fiber_g'],
      },
    },
    confidence: { type: 'NUMBER' },
    assumptions: { type: 'STRING' },
    title: { type: 'STRING' },
    scene: { type: 'STRING', enum: [...ANALYZE_SCENES] },
  },
  required: ['items', 'confidence', 'title', 'scene'],
}

function configuredModels() {
  const requested = Deno.env.get('GEMINI_MODEL')?.trim()
  const fallback = Deno.env.get('GEMINI_FALLBACK_MODEL')?.trim()
  const primary = requested && !PREMIUM_FLASH.test(requested) ? requested : DEFAULT_MODELS[0]
  if (requested && PREMIUM_FLASH.test(requested)) {
    console.error(`analyze skipping ${requested}; using ${primary} so paid credits last longer`)
  }
  return [...new Set([primary, fallback, ...DEFAULT_MODELS].filter(Boolean))]
}

function isCapacityError(message: string, status?: number) {
  if (status === 429 || status === 503) return true
  return /high demand|try again later|resource.?exhausted|unavailable|overloaded|quota/i.test(message)
}

function friendlyAnalyzeError(message: string, status?: number) {
  if (isCapacityError(message, status)) {
    return 'Gemini is busy right now. Try Analyze again in a moment, or enter the numbers yourself.'
  }
  return message
}

function geminiErrorMessage(payload: unknown, status: number) {
  const message =
    payload &&
    typeof payload === 'object' &&
    'error' in payload &&
    payload.error &&
    typeof payload.error === 'object' &&
    'message' in payload.error
      ? String((payload.error as { message?: unknown }).message ?? '')
      : ''
  return message || `Gemini request failed (${status})`
}

function extractGeminiText(payload: unknown) {
  const row = payload as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean }> } }>
  }
  return (row.candidates?.[0]?.content?.parts ?? [])
    .filter((part) => !part.thought)
    .map((part) => part.text ?? '')
    .join('')
}

async function callGemini(geminiKey: string, model: string, parts: Array<Record<string, unknown>>) {
  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
  const geminiRes = await fetch(geminiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': geminiKey,
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: 'user', parts }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA,
        thinkingConfig: { thinkingLevel: 'MINIMAL' },
        mediaResolution: 'MEDIA_RESOLUTION_MEDIUM',
        maxOutputTokens: 1024,
      },
    }),
  })

  let geminiJson: unknown
  try {
    geminiJson = await geminiRes.json()
  } catch {
    const error: GeminiCallError = new Error(`Gemini returned non-JSON (${geminiRes.status})`)
    error.status = geminiRes.status
    throw error
  }

  if (!geminiRes.ok) {
    const error: GeminiCallError = new Error(geminiErrorMessage(geminiJson, geminiRes.status))
    error.status = geminiRes.status
    throw error
  }

  const usage = (geminiJson as { usageMetadata?: Record<string, unknown> }).usageMetadata
  if (usage) console.error(`analyze gemini ${model} usage`, usage)

  const text = stripFences(extractGeminiText(geminiJson))
  if (!text) throw new Error('Gemini returned an empty response')

  return JSON.parse(text) as {
    items?: Array<Record<string, unknown>>
    confidence?: number
    assumptions?: string
    title?: string
    scene?: string
  }
}

async function generateNutrition(geminiKey: string, parts: Array<Record<string, unknown>>) {
  let lastError = 'Could not reach Gemini'
  let lastStatus: number | undefined

  for (const model of configuredModels()) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        return await callGemini(geminiKey, model, parts)
      } catch (error) {
        lastStatus = error instanceof Error ? (error as GeminiCallError).status : undefined
        lastError = error instanceof Error ? error.message : 'Could not reach Gemini'
        if (lastError === 'Unexpected end of JSON input' || lastError.startsWith('JSON')) {
          lastError = 'Gemini returned invalid JSON'
        }
        console.error(`analyze gemini ${model} attempt ${attempt}:`, lastError)
        // 429 / quota / high demand: do not burn another request on the same model.
        if (isCapacityError(lastError, lastStatus)) break
        if (attempt < 2 && /empty response|invalid JSON|non-JSON/i.test(lastError)) {
          await sleep(600)
          continue
        }
        break
      }
    }
  }

  throw new Error(friendlyAnalyzeError(lastError, lastStatus))
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 400)

  try {
    return await handleAnalyze(req)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Analyze failed'
    console.error('analyze failed:', message)
    return json({ error: message }, 500)
  }
})

async function handleAnalyze(req: Request) {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'Missing authorization' }, 401)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseAnon = getAnonOrPublishableKey()
  if (!supabaseUrl || !supabaseAnon) return json({ error: 'Server is missing Supabase config' }, 500)

  const supabase = createClient(supabaseUrl, supabaseAnon, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData.user) return json({ error: 'Invalid session' }, 401)

  const { data: profile } = await supabase.from('profiles').select('id').eq('id', userData.user.id).maybeSingle()
  if (!profile) {
    const displayName = userData.user.email?.split('@')[0] || 'You'
    const { error: insertError } = await supabase.from('profiles').insert({
      id: userData.user.id,
      display_name: displayName,
    })
    if (insertError) {
      const retry = await supabase.from('profiles').select('id').eq('id', userData.user.id).maybeSingle()
      if (!retry.data) return json({ error: 'Profile required' }, 401)
    }
  }

  let body: AnalyzeRequest
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }

  const note = body.note?.trim()
  const imageBase64 = body.imageBase64?.trim()
  if (!note && !imageBase64) return json({ error: 'Add a photo or a short note first.' }, 400)

  const geminiKey = Deno.env.get('GEMINI_API_KEY')
  if (!geminiKey) return json({ error: 'GEMINI_API_KEY is not set' }, 500)

  const parts: Array<Record<string, unknown>> = [
    { text: analyzeUserText(note, Boolean(imageBase64)) },
  ]
  if (imageBase64) {
    parts.push({
      inline_data: {
        mime_type: body.mimeType === 'image/webp' ? 'image/webp' : 'image/jpeg',
        data: imageBase64,
      },
      mediaResolution: { level: 'MEDIA_RESOLUTION_MEDIUM' },
    })
  }

  const parsed = await generateNutrition(geminiKey, parts)
  const scene = ANALYZE_SCENES.includes(parsed.scene as (typeof ANALYZE_SCENES)[number])
    ? parsed.scene
    : undefined
  const title = String(parsed.title ?? '').trim()

  let items = (parsed.items ?? []).map((item) => ({
    name: String(item.name ?? ''),
    grams: item.grams == null || item.grams === '' ? null : Number(item.grams),
    calories: roundNutrition(Number(item.calories ?? 0), true),
    protein_g: roundNutrition(Number(item.protein_g ?? 0)),
    fiber_g: roundNutrition(Number(item.fiber_g ?? 0)),
    carbs_g: roundNutrition(Number(item.carbs_g ?? 0)),
    fat_g: roundNutrition(Number(item.fat_g ?? 0)),
  })).filter((item) => item.name.trim())

  if ((scene === 'recipe' || scene === 'packaged') && items.length > 2) {
    items = [sumNamedItems(items, title || items[0]?.name || 'Meal')]
  } else if (items.length > 6) {
    items = [...items.slice(0, 5), sumNamedItems(items.slice(5), 'Other foods')]
  }

  const totals = items.reduce(
    (acc, item) => {
      acc.calories += item.calories
      acc.protein_g += item.protein_g
      acc.fiber_g += item.fiber_g
      acc.carbs_g += item.carbs_g
      acc.fat_g += item.fat_g
      return acc
    },
    { calories: 0, protein_g: 0, fiber_g: 0, carbs_g: 0, fat_g: 0 },
  )

  const assumptions = String(parsed.assumptions ?? '')
  const grouping =
    scene === 'recipe'
      ? 'Read as a recipe, so this is the finished dish — not a row per ingredient.'
      : ''

  return json({
    items,
    totals: {
      calories: roundNutrition(totals.calories, true),
      protein_g: roundNutrition(totals.protein_g),
      fiber_g: roundNutrition(totals.fiber_g),
      carbs_g: roundNutrition(totals.carbs_g),
      fat_g: roundNutrition(totals.fat_g),
    },
    confidence: Math.min(1, Math.max(0, Number(parsed.confidence ?? 0))),
    assumptions: [grouping, assumptions].filter(Boolean).join(' '),
    title: title || (items.length === 1 ? items[0].name : ''),
    scene: scene ?? 'mixed',
  })
}

function sumNamedItems(
  items: Array<{
    name: string
    grams: number | null
    calories: number
    protein_g: number
    fiber_g: number
    carbs_g: number
    fat_g: number
  }>,
  name: string,
) {
  const merged = items.reduce(
    (acc, item) => {
      acc.grams =
        item.grams == null ? acc.grams : acc.grams == null ? item.grams : acc.grams + item.grams
      acc.calories += item.calories
      acc.protein_g += item.protein_g
      acc.fiber_g += item.fiber_g
      acc.carbs_g += item.carbs_g
      acc.fat_g += item.fat_g
      return acc
    },
    {
      name,
      grams: null as number | null,
      calories: 0,
      protein_g: 0,
      fiber_g: 0,
      carbs_g: 0,
      fat_g: 0,
    },
  )
  return {
    ...merged,
    calories: roundNutrition(merged.calories, true),
    protein_g: roundNutrition(merged.protein_g),
    fiber_g: roundNutrition(merged.fiber_g),
    carbs_g: roundNutrition(merged.carbs_g),
    fat_g: roundNutrition(merged.fat_g),
  }
}
