import { useEffect, useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { getCurrentUser, signInWithGoogle, signInWithMagicLink, usingLocalData } from '../lib/supabase'

export function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [userReady, setUserReady] = useState<boolean | null>(null)

  useEffect(() => {
    getCurrentUser().then((user) => {
      setUserReady(Boolean(user))
      if (user) navigate('/', { replace: true })
    })
  }, [navigate])

  if (userReady === null) {
    return (
      <div className="login">
        <p className="status">Loading…</p>
      </div>
    )
  }
  if (userReady) return <Navigate to="/" replace />

  async function onEmail(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    const result = await signInWithMagicLink(email)
    setBusy(false)
    if (result.error) {
      setError(result.error)
      return
    }
    if (result.local) {
      navigate('/', { replace: true })
      return
    }
    setSent(true)
  }

  async function onGoogle() {
    setBusy(true)
    setError(null)
    const result = await signInWithGoogle()
    setBusy(false)
    if (result.error) setError(result.error)
  }

  return (
    <div className="login">
      <div className="login-card">
        <div>
          <h1>Plate Pal</h1>
          <p className="lede">Personal protein + fiber tracker.</p>
        </div>

        {usingLocalData ? (
          <p className="banner">
            Running locally without Supabase. Use any email to sign in on this device. Data stays in
            the browser.
          </p>
        ) : null}

        {sent ? (
          <p className="status">Check your email for a sign-in link.</p>
        ) : (
          <form className="card page" onSubmit={onEmail}>
            <label className="field">
              <span>Email</span>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                required
              />
            </label>
            <button className="btn" type="submit" disabled={busy}>
              {usingLocalData ? 'Continue' : 'Email me a link'}
            </button>
            {!usingLocalData ? (
              <button className="btn-secondary" type="button" disabled={busy} onClick={onGoogle}>
                Continue with Google
              </button>
            ) : null}
            {error ? <p className="error">{error}</p> : null}
          </form>
        )}
      </div>
    </div>
  )
}
