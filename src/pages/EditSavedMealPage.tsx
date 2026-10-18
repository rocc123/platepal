import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { MealEditor } from '../components/MealEditor'
import { useUser } from '../components/AuthGate'
import { getLookups } from '../lib/lookups'
import { itemsFromSavedMeal } from '../lib/savedMeals'
import { deleteSavedMeal, fetchSavedMeal, updateSavedMeal } from '../lib/supabase'
import { sumItems } from '../lib/totals'
import type { MealItem, SavedMeal } from '../lib/types'

export function EditSavedMealPage() {
  const { id } = useParams()
  const user = useUser()
  const navigate = useNavigate()
  const [saved, setSaved] = useState<SavedMeal | null>(null)
  const [name, setName] = useState('')
  const [note, setNote] = useState('')
  const [items, setItems] = useState<MealItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let active = true
    fetchSavedMeal(id, user.id)
      .then((row) => {
        if (!active) return
        if (!row) {
          setError('Saved meal not found.')
          return
        }
        setSaved(row)
        setName(row.name)
        setNote(row.note ?? '')
        setItems(itemsFromSavedMeal(row))
      })
      .catch((err: unknown) => {
        if (!active) return
        setError(err instanceof Error ? err.message : 'Could not load saved meal.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [id, user.id])

  async function onSave() {
    if (!saved) return
    if (!name.trim()) {
      setError('Give the saved meal a name.')
      return
    }
    const named = items.filter((item) => item.name.trim())
    if (!named.length) {
      setError('Add at least one food.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await updateSavedMeal(saved.id, user.id, {
        name,
        note: note.trim() || null,
        items: named,
        ...sumItems(named),
      })
      navigate('/saved', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save changes.')
      setSaving(false)
    }
  }

  async function onDelete() {
    if (!saved) return
    setSaving(true)
    setError(null)
    try {
      await deleteSavedMeal(saved.id, user.id)
      navigate('/saved', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete saved meal.')
      setSaving(false)
    }
  }

  if (loading) {
    return <p className="status">Loading…</p>
  }

  if (!saved) {
    return (
      <div className="page">
        <p className="error">{error ?? 'Saved meal not found.'}</p>
        <button type="button" className="btn-secondary" onClick={() => navigate('/saved')}>
          Back
        </button>
      </div>
    )
  }

  return (
    <div className="page">
      <h1>Edit saved meal</h1>
      <MealEditor
        name={name}
        note={note}
        items={items}
        date=""
        time=""
        durationMinutes={0}
        periodId={0}
        lookups={getLookups()}
        confidence={null}
        assumptions="Changes apply the next time you log this meal. Meals you already logged stay as they are."
        saveAsSavedMeal={false}
        showSavedMealCheckbox={false}
        savedMealName=""
        showWhen={false}
        saveLabel="Save changes"
        deleteLabel="Delete saved meal"
        deletePrompt="Delete this saved meal?"
        saving={saving}
        error={error}
        onNameChange={setName}
        onNoteChange={setNote}
        onItemsChange={setItems}
        onDateChange={() => undefined}
        onTimeChange={() => undefined}
        onDurationChange={() => undefined}
        onPeriodChange={() => undefined}
        onSaveAsSavedMealChange={() => undefined}
        onSavedMealNameChange={() => undefined}
        onSave={onSave}
        onCancel={() => navigate('/saved')}
        onDelete={onDelete}
      />
    </div>
  )
}
