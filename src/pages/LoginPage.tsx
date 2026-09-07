import { useEffect, useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  clearOtpEmail,
  completeEmailAuthFromUrl,
  onAuthChange,
  readOtpEmail,
  signInWithGoogle,
  signInWithMagicLink,
  usingLocalData,
  verifyEmailCode,
} from '../lib/supabase'

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [userReady, setUserReady] = useState<boolean | null>(null)

  useEffect(() => {
    let active = true
    const pending = readOtpEmail()
    if (pending) {
      setEmail(pending)
      setSent(true)
    }
    const fromGate = (location.state as { authError?: string } | null)?.authError
    if (fromGate) setError(fromGate)

    void completeEmailAuthFromUrl().then((result) => {
      if (!active) return
      if (result.user) {
        clearOtpEmail()
        navigate('/', { replace: true })
        return
      }
      if (result.error) setError(result.error)
      setUserReady(false)
    })

    const unsubscribe = onAuthChange((user) => {
      if (!active || !user) return
      clearOtpEmail()
      navigate('/', { replace: true })
    })
    return () => {
      active = false
      unsubscribe()
    }
  }, [navigate, location.state])

  if (userReady === null) {
    return (
      <div className="login">
        <p className="status">Loading…</p>
      </div>
    )
  }

  async function sendEmail() {
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

  async function onEmail(event: FormEvent) {
    event.preventDefault()
    await sendEmail()
  }

  async function onCode(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    const result = await verifyEmailCode(email, code)
    setBusy(false)
    if (result.error) {
      setError(result.error)
      return
    }
    navigate('/', { replace: true })
  }

  async function onGoogle() {
    setBusy(true)
    setError(null)
    const result = await signInWithGoogle()
    setBusy(false)
    if (result.error) setError(result.error)
  }

  function useDifferentEmail() {
    clearOtpEmail()
    setSent(false)
    setCode('')
    setError(null)
  }

  return (
    <div className="login">
      <div className="login-card">
        <div>
          <svg className="login-mark" viewBox="0 0 64 64" aria-hidden="true">
            <circle cx="32" cy="36" r="18" fill="#f7f9fb" stroke="#0b7a74" strokeWidth="3" />
            <circle cx="32" cy="36" r="6" fill="#d5ecea" />
            <path d="M18 16h28" stroke="#3b4f8a" strokeWidth="3" strokeLinecap="round" />
          </svg>
          <h1>Plate Pal</h1>
          <p className="lede">Protein and fiber, meal by meal.</p>
        </div>

        {usingLocalData ? (
          <p className="banner">
            Running locally without Supabase. Use any email to sign in on this device. Data stays in
            the browser.
          </p>
        ) : null}

        {sent && !usingLocalData ? (
          <form className="card page" onSubmit={onCode}>
            <p className="status">
              We emailed a sign-in code to <strong>{email}</strong>. Enter it here. If you added
              Plate Pal to your home screen, skip the email link — it opens in the browser and
              cannot sign this app in.
            </p>
            <label className="field">
              <span>Code</span>
              <input
                className="otp-input"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 8))}
                placeholder="123456"
                required
              />
            </label>
            <button className="btn" type="submit" disabled={busy || code.length < 6}>
              Sign in
            </button>
            <button className="btn-secondary" type="button" disabled={busy} onClick={() => void sendEmail()}>
              Resend code
            </button>
            <button className="btn-secondary" type="button" disabled={busy} onClick={useDifferentEmail}>
              Use a different email
            </button>
            {error ? <p className="error">{error}</p> : null}
          </form>
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
              {usingLocalData ? 'Continue' : 'Email me a code'}
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
