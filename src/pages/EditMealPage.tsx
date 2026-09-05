import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { MealEditor } from '../components/MealEditor'
import { useUser } from '../components/AuthGate'
import { createSavedMeal, deleteMeal, fetchMealWithItems, updateMeal } from '../lib/supabase'
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
      await updateMeal(meal.id, user.id, {
        note: note.trim() || named[0].name,
        source: meal.source,
        eaten_at: meal.eaten_at,
        confidence: meal.confidence,
        items: named,
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
        confidence={meal.confidence}
        assumptions=""
        saveAsTemplate={false}
        showTemplateCheckbox={false}
        saving={saving}
        error={error}
        onNoteChange={setNote}
        onItemsChange={setItems}
        onSaveAsTemplateChange={() => undefined}
        onSave={onSave}
        onCancel={() => navigate('/')}
        onDelete={onDelete}
        onSaveTemplate={onSaveTemplate}
      />
    </div>
  )
}
