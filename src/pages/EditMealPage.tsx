import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { MealEditor } from '../components/MealEditor'
import { useUser } from '../components/AuthGate'
import { dateTimeFromInputs, fromUtc, inferPeriodFromWhen, localDateInput, localTimeInput, zoneStamp } from '../lib/dates'
import { DEFAULT_MEAL_DURATION_MINUTES, parseDurationMinutes } from '../lib/fasting'
import { getLookups } from '../lib/lookups'
import { createSavedMeal, deleteMeal, fetchMealWithItems, loadLookups, updateMeal } from '../lib/supabase'
import { sumItems } from '../lib/totals'
import type { Meal, MealItem } from '../lib/types'

export function EditMealPage() {
  const { id } = useParams()
  const user = useUser()
  const navigate = useNavigate()
  const [meal, setMeal] = useState<Meal | null>(null)
  const [note, setNote] = useState('')
  const [items, setItems] = useState<MealItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [lookups, setLookupsState] = useState(getLookups)
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [durationMinutes, setDurationMinutes] = useState(DEFAULT_MEAL_DURATION_MINUTES)
  const [periodId, setPeriodId] = useState(0)
  const [periodTouched, setPeriodTouched] = useState(false)

  useEffect(() => {
    if (!id) return
    let active = true
    fetchMealWithItems(id, user.id)
      .then((row) => {
        if (!active) return
        if (!row) {
          setError('Meal not found.')
          return
        }
        setMeal(row.meal)
        setNote(row.meal.note ?? '')
        setItems(row.items)
        const when = fromUtc(row.meal.eaten_at, row.meal.tz_name)
        setDate(localDateInput(when))
        setTime(localTimeInput(when))
        setDurationMinutes(parseDurationMinutes(row.meal.duration_minutes))
        setPeriodId(row.meal.meal_period_id)
      })
      .catch((err: unknown) => {
        if (!active) return
        setError(err instanceof Error ? err.message : 'Could not load meal.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [id, user.id])

  useEffect(() => {
    loadLookups().then(setLookupsState)
  }, [])

  async function onSave() {
    if (!meal) return
    const named = items.filter((item) => item.name.trim())
    if (!named.length) {
      setError('Add at least one food.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const totals = sumItems(named)
      const stamp = zoneStamp(dateTimeFromInputs(date, time))
      await updateMeal(meal.id, user.id, {
        note: note.trim() || named[0].name,
        source_id: meal.source_id,
        meal_period_id: periodId,
        duration_minutes: parseDurationMinutes(durationMinutes),
        confidence: meal.confidence,
        items: named,
        ...stamp,
        ...totals,
      })
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save meal.')
      setSaving(false)
    }
  }

  async function onDelete() {
    if (!meal) return
    setSaving(true)
    setError(null)
    try {
      await deleteMeal(meal.id, user.id)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete meal.')
      setSaving(false)
    }
  }

  async function onSaveTemplate() {
    const named = items.filter((item) => item.name.trim())
    if (!named.length) {
      setError('Add at least one food.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const totals = sumItems(named)
      await createSavedMeal(user.id, {
        name: note.trim() || named[0].name,
        note: note.trim() || null,
        items: named,
        ...totals,
      })
      setStatus('Saved as template.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save template.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <p className="status">Loading…</p>
  }

  if (!meal) {
    return (
      <div className="page">
        <p className="error">{error ?? 'Meal not found.'}</p>
        <button type="button" className="btn-secondary" onClick={() => navigate('/')}>
          Back
        </button>
      </div>
    )
  }

  return (
    <div className="page">
      <h1>Edit meal</h1>
      {status ? <p className="status">{status}</p> : null}
      <MealEditor
        note={note}
        items={items}
        date={date}
        time={time}
        durationMinutes={durationMinutes}
        periodId={periodId}
        lookups={lookups}
        confidence={meal.confidence}
        assumptions=""
        saveAsTemplate={false}
        showTemplateCheckbox={false}
        saving={saving}
        error={error}
        onNoteChange={setNote}
        onItemsChange={setItems}
        onDateChange={(next) => {
          setDate(next)
          if (!periodTouched) {
            try {
              setPeriodId(inferPeriodFromWhen(dateTimeFromInputs(next, time)))
            } catch {
              /* keep */
            }
          }
        }}
        onTimeChange={(next) => {
          setTime(next)
          if (!periodTouched) {
            try {
              setPeriodId(inferPeriodFromWhen(dateTimeFromInputs(date, next)))
            } catch {
              /* keep */
            }
          }
        }}
        onDurationChange={setDurationMinutes}
        onPeriodChange={(next) => {
          setPeriodId(next)
          setPeriodTouched(true)
        }}
        onSaveAsTemplateChange={() => undefined}
        onSave={onSave}
        onCancel={() => navigate('/')}
        onDelete={onDelete}
        onSaveTemplate={onSaveTemplate}
      />
    </div>
  )
}
