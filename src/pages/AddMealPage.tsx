import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { BarcodePicker } from '../components/BarcodePicker'
import { FoodSearch } from '../components/FoodSearch'
import { MealEditor } from '../components/MealEditor'
import { PhotoPicker } from '../components/PhotoPicker'
import { SavedMealPicker } from '../components/SavedMealPicker'
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
import { getLookups, periodById, sourceIdByCode } from '../lib/lookups'
import { defaultSavedMealName, itemsFromSavedMeal } from '../lib/savedMeals'
import { createMeal, createSavedMeal, fetchSavedMeals, loadLookups } from '../lib/supabase'
import { sumItems } from '../lib/totals'
import type { MealItem, SavedMeal } from '../lib/types'

type Step = 'capture' | 'review'
type Helper = 'photo' | 'search' | 'barcode' | null

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
  const [step, setStep] = useState<Step>('capture')
  const [helper, setHelper] = useState<Helper>(null)
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
  const [saveAsSavedMeal, setSaveAsSavedMeal] = useState(false)
  const [savedMealName, setSavedMealName] = useState('')
  const [savedMealNameTouched, setSavedMealNameTouched] = useState(false)
  const [savedMeals, setSavedMeals] = useState<SavedMeal[]>([])
  const [savedMealsLoading, setSavedMealsLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canAnalyze = Boolean(note.trim() || file)
  const namedCount = items?.filter((item) => item.name.trim()).length ?? 0
  const suggestedSavedName = defaultSavedMealName(
    items ?? [],
    note,
    periodById(periodId, lookups)?.label,
  )
  const resolvedSavedName = savedMealNameTouched ? savedMealName : suggestedSavedName

  useEffect(() => {
    loadLookups().then(setLookupsState)
  }, [])

  useEffect(() => {
    let active = true
    fetchSavedMeals(user.id)
      .then((rows) => {
        if (!active) return
        setSavedMeals(rows)
      })
      .catch(() => {
        if (active) setSavedMeals([])
      })
      .finally(() => {
        if (active) setSavedMealsLoading(false)
      })
    return () => {
      active = false
    }
  }, [user.id])

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  function toggleHelper(next: Helper) {
    setHelper((current) => (current === next ? null : next))
  }

  function pickFile(next: File) {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setFile(next)
    setPreviewUrl(URL.createObjectURL(next))
    setHelper('photo')
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

  function openReview(nextItems: MealItem[]) {
    setItems(nextItems)
    setStep('review')
    setError(null)
  }

  function applySavedMeal(saved: SavedMeal) {
    setNote((current) => current.trim() || saved.note || saved.name)
    setConfidence(null)
    setAssumptions(`From saved meal “${saved.name}”. Edit anything before you log it.`)
    setSourceId(sourceIdByCode('saved'))
    setSaveAsSavedMeal(false)
    openReview(itemsFromSavedMeal(saved))
  }

  async function onAnalyze() {
    if (!canAnalyze) return
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
      setConfidence(result.confidence)
      setAssumptions(result.assumptions)
      setSourceId(sourceIdByCode(file ? 'photo' : 'text'))
      openReview(result.items.length ? result.items : [blankItem()])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analyze failed.')
    } finally {
      setAnalyzing(false)
    }
  }

  function onManual() {
    setConfidence(null)
    setAssumptions('')
    setSourceId(sourceIdByCode('manual'))
    openReview([note.trim() ? { ...blankItem(), name: note.trim() } : blankItem()])
  }

  async function onSave() {
    if (!items) return
    const named = items.filter((item) => item.name.trim())
    if (!named.length) {
      setError('Add at least one food name.')
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
      if (saveAsSavedMeal) {
        await createSavedMeal(user.id, {
          name: resolvedSavedName.trim() || suggestedSavedName,
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

  if (step === 'review' && items) {
    return (
      <div className="page add-meal">
        <div className="review-top">
          <button type="button" className="text-back" onClick={() => setStep('capture')}>
            ← Back to plate
          </button>
        </div>
        <header className="review-head">
          <p className="composer-kicker">Step 2 of 2</p>
          <h1>Check the numbers</h1>
          <p className="lede">
            A food name is enough to save. Protein and fiber are what we track. Grams, calories, and
            the rest are optional.
          </p>
        </header>
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
          saveAsSavedMeal={saveAsSavedMeal}
          showSavedMealCheckbox
          savedMealName={resolvedSavedName}
          compactWhen
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
          onSaveAsSavedMealChange={setSaveAsSavedMeal}
          onSavedMealNameChange={(next) => {
            setSavedMealNameTouched(true)
            setSavedMealName(next)
          }}
          onSave={onSave}
          onCancel={goBack}
        />
      </div>
    )
  }

  return (
    <div className="page add-meal">
      <div className="review-top">
        <button type="button" className="text-back" onClick={() => goBack()}>
          Cancel
        </button>
      </div>

      <section className="composer">
        <p className="composer-kicker">Step 1 of 2</p>
        <h1>What was on the plate?</h1>
        <p className="lede">
          Repeat a saved meal, or start with a note or photo. Look up and barcode are extras.
        </p>

        {items ? (
          <button type="button" className="continue-banner" onClick={() => setStep('review')}>
            <span>
              <strong>Your estimate is still here</strong>
              <span className="continue-meta">
                {namedCount > 0
                  ? `${namedCount} food${namedCount === 1 ? '' : 's'} ready to review`
                  : 'Nothing was cleared — pick up where you left off'}
              </span>
            </span>
            <span className="continue-go">Review →</span>
          </button>
        ) : null}

        <div className="saved-shelf">
          <div className="saved-shelf-head">
            <p className="composer-kicker">Saved meals</p>
            <p className="helper-copy">
              {savedMealsLoading
                ? 'Looking up what you kept…'
                : savedMeals.length
                  ? 'Tap one to reuse it. You can still edit the numbers.'
                  : 'Keep a meal on the next screen and name it — Oat Breakfast, Friday chicken, whatever you’ll look up later.'}
            </p>
          </div>
          {savedMealsLoading || savedMeals.length ? (
            <SavedMealPicker meals={savedMeals} loading={savedMealsLoading} onPick={applySavedMeal} />
          ) : null}
        </div>

        <label className="field plate-note">
          <span>
            Describe it <em>optional if you use a photo or lookup</em>
          </span>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="200g chicken, rice, and a pile of broccoli"
          />
        </label>

        <div className="method-row" role="group" aria-label="Optional helpers">
          <button
            type="button"
            className={helper === 'photo' || file ? 'method-tile on' : 'method-tile'}
            aria-pressed={helper === 'photo'}
            onClick={() => toggleHelper('photo')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
              <path d="M4 8.5h3l1.4-2h7.2l1.4 2H20a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 20 19.5H4A1.5 1.5 0 0 1 2.5 18v-8A1.5 1.5 0 0 1 4 8.5Z" />
              <circle cx="12" cy="13.2" r="2.6" />
            </svg>
            <strong>Photo</strong>
            <span>{file ? 'Added' : 'Optional'}</span>
          </button>
          <button
            type="button"
            className={helper === 'search' ? 'method-tile on' : 'method-tile'}
            aria-pressed={helper === 'search'}
            onClick={() => toggleHelper('search')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
              <circle cx="11" cy="11" r="6" />
              <path d="M16 16l4.5 4.5" strokeLinecap="round" />
            </svg>
            <strong>Look up</strong>
            <span>Optional</span>
          </button>
          <button
            type="button"
            className={helper === 'barcode' ? 'method-tile on' : 'method-tile'}
            aria-pressed={helper === 'barcode'}
            onClick={() => toggleHelper('barcode')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
              <path d="M5 6v12M8 6v12M10 6v12M13 6v12M15.5 6v12M19 6v12" strokeLinecap="round" />
            </svg>
            <strong>Barcode</strong>
            <span>Optional</span>
          </button>
        </div>

        {helper === 'photo' ? (
          <div className="helper-panel">
            <p className="helper-copy">A photo is enough on its own. Analyze will read the plate.</p>
            <PhotoPicker previewUrl={previewUrl} onPick={pickFile} onClear={clearFile} />
          </div>
        ) : null}

        {helper === 'search' ? (
          <div className="helper-panel">
            <p className="helper-copy">Pick a USDA food to skip analyze and jump straight to the numbers.</p>
            <FoodSearch
              label="Search USDA"
              onPick={(item, hit) => {
                setNote((current) => current.trim() || item.name)
                setConfidence(0.7)
                setAssumptions(`USDA FoodData Central, per ${hit.grams}g. Edit if your portion is different.`)
                setSourceId(sourceIdByCode('manual'))
                openReview([item])
              }}
            />
          </div>
        ) : null}

        {helper === 'barcode' ? (
          <div className="helper-panel">
            <p className="helper-copy">
              Scan with the camera, take a barcode photo, or type the number. That also skips analyze.
            </p>
            <BarcodePicker
              onPick={(item, nextAssumptions) => {
                setNote((current) => current.trim() || item.name)
                setConfidence(0.8)
                setAssumptions(nextAssumptions)
                setSourceId(sourceIdByCode('manual'))
                openReview([item])
              }}
            />
          </div>
        ) : null}

        {error ? <p className="error">{error}</p> : null}

        <div className="capture-actions">
          <button
            type="button"
            className="btn"
            disabled={analyzing || !canAnalyze}
            onClick={() => void onAnalyze()}
          >
            {analyzing ? 'Reading the plate…' : 'Analyze this plate'}
          </button>
          {!canAnalyze ? (
            <p className="hint">Add a note or photo first — or skip analyze and type the numbers.</p>
          ) : (
            <p className="hint">We estimate protein and fiber. You can edit every number on the next screen.</p>
          )}
          <button type="button" className="text-action" disabled={analyzing} onClick={onManual}>
            Skip — I&apos;ll type protein and fiber
          </button>
        </div>
      </section>
    </div>
  )
}
