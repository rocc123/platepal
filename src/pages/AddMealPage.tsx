import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { BarcodePicker } from '../components/BarcodePicker'
import { FoodSearch } from '../components/FoodSearch'
import { MealEditor } from '../components/MealEditor'
import { PhotoPicker } from '../components/PhotoPicker'
import { useUser } from '../components/AuthGate'
import { analyzeMeal, resizeImageToJpeg } from '../lib/analyze'
import { eatenAtForDay, parseLocalDayKey } from '../lib/dates'
import { createMeal, createSavedMeal } from '../lib/supabase'
import { sumItems } from '../lib/totals'
import type { MealItem, MealSource } from '../lib/types'

function blankItem(): MealItem {
  return {
    name: '',
    grams: null,
    calories: 0,
    protein_g: 0,
    fiber_g: 0,
    carbs_g: 0,
    fat_g: 0,
  }
}

export function AddMealPage() {
  const user = useUser()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const day = parseLocalDayKey(searchParams.get('d')) ?? new Date()
  const dayKey = searchParams.get('d')
  function goBack(replace = false) {
    navigate(dayKey ? `/?d=${dayKey}` : '/', { replace })
  }
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [items, setItems] = useState<MealItem[] | null>(null)
  const [confidence, setConfidence] = useState<number | null>(null)
  const [assumptions, setAssumptions] = useState('')
  const [source, setSource] = useState<MealSource>('manual')
  const [saveAsTemplate, setSaveAsTemplate] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  function pickFile(next: File) {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setFile(next)
    setPreviewUrl(URL.createObjectURL(next))
  }

  function clearFile() {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setFile(null)
    setPreviewUrl(null)
  }

  async function onAnalyze() {
    setAnalyzing(true)
    setError(null)
    try {
      let imageBase64: string | undefined
      if (file) {
        const resized = await resizeImageToJpeg(file)
        imageBase64 = resized.base64
      }
      const result = await analyzeMeal({
        note: note.trim() || undefined,
        imageBase64,
        mimeType: imageBase64 ? 'image/jpeg' : undefined,
      })
      setItems(result.items.length ? result.items : [blankItem()])
      setConfidence(result.confidence)
      setAssumptions(result.assumptions)
      setSource(file ? 'photo' : 'text')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analyze failed.')
    } finally {
      setAnalyzing(false)
    }
  }

  function onManual() {
    setItems([note.trim() ? { ...blankItem(), name: note.trim() } : blankItem()])
    setConfidence(null)
    setAssumptions('')
    setSource('manual')
    setError(null)
  }

  async function onSave() {
    if (!items) return
    const named = items.filter((item) => item.name.trim())
    if (!named.length) {
      setError('Add at least one food.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const totals = sumItems(named)
      await createMeal(user.id, {
        note: note.trim() || named[0].name,
        source,
        eaten_at: eatenAtForDay(day),
        confidence,
        items: named,
        ...totals,
      })
      if (saveAsTemplate) {
        await createSavedMeal(user.id, {
          name: note.trim() || named[0].name,
          note: note.trim() || null,
          items: named,
          ...totals,
        })
      }
      goBack(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save meal.')
      setSaving(false)
    }
  }

  if (!items) {
    return (
      <div className="page">
        <div className="top">
          <h1>Add meal</h1>
        </div>
        <PhotoPicker previewUrl={previewUrl} onPick={pickFile} onClear={clearFile} />
        <FoodSearch
          onPick={(item, hit) => {
            setItems([item])
            setNote((current) => current.trim() || item.name)
            setConfidence(0.7)
            setAssumptions(`USDA FoodData Central, per ${hit.grams}g. Edit if your portion is different.`)
            setSource('manual')
            setError(null)
          }}
        />
        <BarcodePicker
          onPick={(item, assumptions) => {
            setItems([item])
            setNote((current) => current.trim() || item.name)
            setConfidence(0.8)
            setAssumptions(assumptions)
            setSource('manual')
            setError(null)
          }}
        />
        <label className="field">
          <span>Note</span>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="200g chicken + broccoli"
          />
        </label>
        {error ? <p className="error">{error}</p> : null}
        <div className="row-actions">
          <button type="button" className="btn" disabled={analyzing} onClick={onAnalyze}>
            {analyzing ? 'Analyzing…' : 'Analyze'}
          </button>
          <button type="button" className="btn-secondary" disabled={analyzing} onClick={onManual}>
            Enter by hand
          </button>
          <button type="button" className="btn-secondary" onClick={() => goBack()}>
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <h1>Edit estimate</h1>
      <MealEditor
        note={note}
        items={items}
        confidence={confidence}
        assumptions={assumptions}
        saveAsTemplate={saveAsTemplate}
        showTemplateCheckbox
        saving={saving}
        error={error}
        onNoteChange={setNote}
        onItemsChange={setItems}
        onSaveAsTemplateChange={setSaveAsTemplate}
        onSave={onSave}
        onCancel={goBack}
      />
    </div>
  )
}
