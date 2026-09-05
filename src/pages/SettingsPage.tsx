import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUser } from '../components/AuthGate'
import { ensureProfile, saveProfile, signOut } from '../lib/supabase'
import type { Profile } from '../lib/types'

export function SettingsPage() {
  const user = useUser()
  const navigate = useNavigate()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [protein, setProtein] = useState('150')
  const [fiber, setFiber] = useState('30')
  const [calories, setCalories] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    let active = true
    ensureProfile(user)
      .then((row) => {
        if (!active) return
        setProfile(row)
        setDisplayName(row.display_name ?? '')
        setProtein(String(row.protein_goal_g))
        setFiber(String(row.fiber_goal_g))
        setCalories(row.calorie_goal == null ? '' : String(row.calorie_goal))
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : 'Could not load settings.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [user])

  async function onSave(event: FormEvent) {
    event.preventDefault()
    if (!profile) return
    const proteinGoal = Number(protein)
    const fiberGoal = Number(fiber)
    const calorieGoal = calories.trim() === '' ? null : Number(calories)
    if (!Number.isFinite(proteinGoal) || proteinGoal <= 0) {
      setError('Protein goal must be a number greater than 0.')
      return
    }
    if (!Number.isFinite(fiberGoal) || fiberGoal <= 0) {
      setError('Fiber goal must be a number greater than 0.')
      return
    }
    if (calorieGoal != null && (!Number.isFinite(calorieGoal) || calorieGoal <= 0)) {
      setError('Calorie goal must be empty or a number greater than 0.')
      return
    }
    setSaving(true)
    setError(null)
    setSaved(false)
    const next: Profile = {
      ...profile,
      display_name: displayName.trim() || null,
      protein_goal_g: proteinGoal,
      fiber_goal_g: fiberGoal,
      calorie_goal: calorieGoal,
    }
    const result = await saveProfile(next)
    setSaving(false)
    if (result.error) {
      setError(result.error)
      return
    }
    setProfile(next)
    setSaved(true)
  }

  async function onSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="page">
      <h1>Settings</h1>
      {loading ? <p className="status">Loading…</p> : null}
      {profile ? (
        <form className="card page" onSubmit={onSave}>
          <label className="field">
            <span>Display name</span>
            <input type="text" value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
          </label>
          <label className="field">
            <span>Protein goal (g)</span>
            <input
              type="number"
              inputMode="decimal"
              value={protein}
              onChange={(event) => setProtein(event.target.value)}
            />
          </label>
          <label className="field">
            <span>Fiber goal (g)</span>
            <input
              type="number"
              inputMode="decimal"
              value={fiber}
              onChange={(event) => setFiber(event.target.value)}
            />
          </label>
          <label className="field">
            <span>Calorie goal (optional)</span>
            <input
              type="number"
              inputMode="decimal"
              value={calories}
              onChange={(event) => setCalories(event.target.value)}
              placeholder="Leave blank to hide the calorie bar"
            />
          </label>
          {error ? <p className="error">{error}</p> : null}
          {saved ? <p className="status">Goals saved.</p> : null}
          <button className="btn" type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save goals'}
          </button>
        </form>
      ) : null}
      <button type="button" className="btn-secondary" onClick={onSignOut}>
        Sign out
      </button>
    </div>
  )
}
