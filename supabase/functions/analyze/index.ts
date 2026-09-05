import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SYSTEM_PROMPT = `You estimate nutrition from a meal photo and/or a short user note for personal tracking.

Priority: protein_g and fiber_g. Also return calories, carbs_g, fat_g.

Rules:
- Identify each visible or described food.
- Estimate portion in grams.
- If a user note is present, treat it as ground truth for ingredients and portions.
- Do not invent hidden oils, butter, or sauces unless they are visible or mentioned.
- If unsure, lower confidence and still give a best estimate.
- Return JSON only. No markdown.

JSON shape:
{
  "items": [
    {
      "name": "string",
      "grams": number,
      "calories": number,
      "protein_g": number,
      "fiber_g": number,
      "carbs_g": number,
      "fat_g": number
    }
  ],
  "totals": {
    "calories": number,
    "protein_g": number,
    "fiber_g": number,
    "carbs_g": number,
    "fat_g": number
  },
  "confidence": number,
  "assumptions": "short string"
}`

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

function stripFences(text: string) {
  return text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
}

function roundNutrition(value: number, calories = false) {
  if (!Number.isFinite(value)) return 0
  return calories ? Math.round(value) : Math.round(value * 10) / 10
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 400)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'Missing authorization' }, 401)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseAnon = Deno.env.get('SUPABASE_ANON_KEY')
  if (!supabaseUrl || !supabaseAnon) return json({ error: 'Server is missing Supabase config' }, 500)

  const supabase = createClient(supabaseUrl, supabaseAnon, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData.user) return json({ error: 'Invalid session' }, 401)

  const { data: profile } = await supabase.from('profiles').select('id').eq('id', userData.user.id).maybeSingle()
  if (!profile) return json({ error: 'Profile required' }, 401)

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
  const model = Deno.env.get('GEMINI_MODEL') || 'gemini-2.5-flash'
  if (!geminiKey) return json({ error: 'GEMINI_API_KEY is not set' }, 500)

  const parts: Array<Record<string, unknown>> = []
  if (note) parts.push({ text: `User note: ${note}` })
  if (imageBase64) {
    parts.push({
      inline_data: {
        mime_type: body.mimeType === 'image/webp' ? 'image/webp' : 'image/jpeg',
        data: imageBase64,
      },
    })
  }

  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`
  let geminiRes: Response
  try {
    geminiRes = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts }],
        generationConfig: { responseMimeType: 'application/json' },
      }),
    })
  } catch {
    return json({ error: 'Could not reach Gemini' }, 500)
  }

  const geminiJson = await geminiRes.json()
  if (!geminiRes.ok) {
    return json({ error: 'Gemini request failed' }, 500)
  }

  const text = geminiJson?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? ''
  let parsed: {
    items?: Array<Record<string, unknown>>
    totals?: Record<string, unknown>
    confidence?: number
    assumptions?: string
  }
  try {
    parsed = JSON.parse(stripFences(text))
  } catch {
    return json({ error: 'Gemini returned invalid JSON' }, 500)
  }

  const items = (parsed.items ?? []).map((item) => ({
    name: String(item.name ?? ''),
    grams: item.grams == null || item.grams === '' ? null : Number(item.grams),
    calories: roundNutrition(Number(item.calories ?? 0), true),
    protein_g: roundNutrition(Number(item.protein_g ?? 0)),
    fiber_g: roundNutrition(Number(item.fiber_g ?? 0)),
    carbs_g: roundNutrition(Number(item.carbs_g ?? 0)),
    fat_g: roundNutrition(Number(item.fat_g ?? 0)),
  }))

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
    assumptions: String(parsed.assumptions ?? ''),
  })
})
