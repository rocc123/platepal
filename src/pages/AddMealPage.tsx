import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { BarcodePicker } from '../components/BarcodePicker'
import { FoodSearch } from '../components/FoodSearch'
import { MealEditor } from '../components/MealEditor'
import { PhotoPicker } from '../components/PhotoPicker'
import { useUser } from '../components/AuthGate'
import { analyzeMeal, resizeImageToJpeg } from '../lib/analyze'
import {
  dateTimeFromInputs,
  defaultWhenForDay,
  inferPeriodFromWhen,
  localDateInput,
  localTimeInput,
  parseLocalDayKey,
  zoneStamp,
} from '../lib/dates'
import { DEFAULT_MEAL_DURATION_MINUTES, parseDurationMinutes } from '../lib/fasting'
import { getLookups, sourceIdByCode } from '../lib/lookups'
import { createMeal, createSavedMeal, loadLookups } from '../lib/supabase'
import { sumItems } from '../lib/totals'
import type { MealItem } from '../lib/types'

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
  const initialWhen = defaultWhenForDay(day)
  const [lookups, setLookupsState] = useState(getLookups)
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [items, setItems] = useState<MealItem[] | null>(null)
  const [date, setDate] = useState(() => localDateInput(initialWhen))
  const [time, setTime] = useState(() => localTimeInput(initialWhen))
  const [durationMinutes, setDurationMinutes] = useState(DEFAULT_MEAL_DURATION_MINUTES)
  const [periodId, setPeriodId] = useState(() => inferPeriodFromWhen(initialWhen))
  const [periodTouched, setPeriodTouched] = useState(false)
  const [confidence, setConfidence] = useState<number | null>(null)
  const [assumptions, setAssumptions] = useState('')
  const [sourceId, setSourceId] = useState(() => sourceIdByCode('manual'))
  const [saveAsTemplate, setSaveAsTemplate] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadLookups().then(setLookupsState)
  }, [])

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

  function syncPeriod(nextDate: string, nextTime: string) {
    if (periodTouched) return
    try {
      setPeriodId(inferPeriodFromWhen(dateTimeFromInputs(nextDate, nextTime)))
    } catch {
      // keep current period until the inputs are valid
    }
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
      setSourceId(sourceIdByCode(file ? 'photo' : 'text'))
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
    setSourceId(sourceIdByCode('manual'))
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
      const stamp = zoneStamp(dateTimeFromInputs(date, time))
      const totals = sumItems(named)
      await createMeal(user.id, {
        note: note.trim() || named[0].name,
        source_id: sourceId,
        meal_period_id: periodId,
        duration_minutes: parseDurationMinutes(durationMinutes),
        confidence,
        items: named,
        ...stamp,
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
            setSourceId(sourceIdByCode('manual'))
            setError(null)
          }}
        />
        <BarcodePicker
          onPick={(item, nextAssumptions) => {
            setItems([item])
            setNote((current) => current.trim() || item.name)
            setConfidence(0.8)
            setAssumptions(nextAssumptions)
            setSourceId(sourceIdByCode('manual'))
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
        date={date}
        time={time}
        durationMinutes={durationMinutes}
        periodId={periodId}
        lookups={lookups}
        confidence={confidence}
        assumptions={assumptions}
        saveAsTemplate={saveAsTemplate}
        showTemplateCheckbox
        saving={saving}
        error={error}
        onNoteChange={setNote}
        onItemsChange={setItems}
        onDateChange={(next) => {
          setDate(next)
          syncPeriod(next, time)
        }}
        onTimeChange={(next) => {
          setTime(next)
          syncPeriod(date, next)
        }}
        onDurationChange={setDurationMinutes}
        onPeriodChange={(next) => {
          setPeriodId(next)
          setPeriodTouched(true)
        }}
        onSaveAsTemplateChange={setSaveAsTemplate}
        onSave={onSave}
        onCancel={goBack}
      />
    </div>
  )
}
