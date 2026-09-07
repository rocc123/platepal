import { getSupabase, usingLocalData } from './supabase'
import type { AnalyzeRequest, AnalyzeResult, MealItem } from './types'

const SYSTEM_PROMPT =
  'Estimate visible or described foods for personal tracking. Priority: protein_g and fiber_g. Treat a user note as ground truth. Do not invent hidden oils or sauces. If unsure, lower confidence and still estimate.'

export { SYSTEM_PROMPT }

function blankItem(name: string): MealItem {
  return {
    name,
    grams: null,
    calories: 0,
    protein_g: 0,
    fiber_g: 0,
    carbs_g: 0,
    fat_g: 0,
  }
}

function localEstimate(request: AnalyzeRequest): AnalyzeResult {
  const note = request.note?.trim()
  const item = blankItem(note || (request.imageBase64 ? 'Meal from photo' : 'Meal'))
  return {
    items: [item],
    totals: { calories: 0, protein_g: 0, fiber_g: 0, carbs_g: 0, fat_g: 0 },
    confidence: 0,
    assumptions:
      'Analyze is not configured on this device. Fill in protein and fiber, then save.',
  }
}

export async function resizeImageToJpeg(file: File): Promise<{ base64: string; mimeType: 'image/jpeg' }> {
  if (!file.type.startsWith('image/')) {
    throw new Error('That file is not an image.')
  }

  const bitmap = await createImageBitmap(file)
  const longEdge = Math.max(bitmap.width, bitmap.height)
  const scale = longEdge > 384 ? 384 / longEdge : 1
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not read that image.')
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (next) => (next ? resolve(next) : reject(new Error('Could not encode the photo.'))),
      'image/jpeg',
      0.55,
    )
  })

  const buffer = await blob.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return { base64: btoa(binary), mimeType: 'image/jpeg' }
}

function asAnalyzeResult(data: unknown): AnalyzeResult {
  if (!data || typeof data !== 'object') throw new Error('Analyze returned an empty response.')
  const row = data as Partial<AnalyzeResult> & { error?: string }
  if (row.error) throw new Error(row.error)
  if (!Array.isArray(row.items) || !row.totals) throw new Error('Analyze returned an unexpected shape.')
  return {
    items: row.items.map((item) => ({
      name: String(item.name ?? ''),
      grams: item.grams == null ? null : Number(item.grams),
      calories: Number(item.calories ?? 0),
      protein_g: Number(item.protein_g ?? 0),
      fiber_g: Number(item.fiber_g ?? 0),
      carbs_g: Number(item.carbs_g ?? 0),
      fat_g: Number(item.fat_g ?? 0),
    })),
    totals: {
      calories: Number(row.totals.calories ?? 0),
      protein_g: Number(row.totals.protein_g ?? 0),
      fiber_g: Number(row.totals.fiber_g ?? 0),
      carbs_g: Number(row.totals.carbs_g ?? 0),
      fat_g: Number(row.totals.fat_g ?? 0),
    },
    confidence: Number(row.confidence ?? 0),
    assumptions: String(row.assumptions ?? ''),
  }
}

function errorFromBody(data: unknown): string | null {
  if (data && typeof data === 'object' && typeof (data as { error?: unknown }).error === 'string') {
    return (data as { error: string }).error
  }
  return null
}

async function functionErrorMessage(error: { message: string; context?: unknown }, data: unknown) {
  const fromData = errorFromBody(data)
  if (fromData) return fromData

  const context = error.context
  if (context && typeof context === 'object' && 'json' in context && typeof (context as Response).json === 'function') {
    try {
      const response = context as Response
      const body = await (typeof response.clone === 'function' ? response.clone() : response).json()
      const fromContext = errorFromBody(body)
      if (fromContext) return fromContext
    } catch {
      // The function body was already consumed or was not JSON.
    }
  }

  return error.message === 'Edge Function returned a non-2xx status code'
    ? 'Analyze failed. Try again in a moment, or enter the numbers yourself.'
    : error.message
}

export async function analyzeMeal(request: AnalyzeRequest): Promise<AnalyzeResult> {
  if (!request.note?.trim() && !request.imageBase64) {
    throw new Error('Add a photo or a short note first.')
  }
  if (usingLocalData) return localEstimate(request)

  const { data, error } = await getSupabase().functions.invoke('analyze', { body: request })
  if (error) throw new Error(await functionErrorMessage(error, data))
  return asAnalyzeResult(data)
}
