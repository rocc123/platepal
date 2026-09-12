import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  clearOtpEmail,
  completeEmailAuthFromUrl,
  onAuthChange,
  readOtpEmail,
  signInWithMagicLink,
  usingLocalData,
  verifyEmailCode,
} from '../lib/supabase'

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const codeInput = useRef<HTMLInputElement>(null)
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

  useEffect(() => {
    if (!sent || usingLocalData) return
    const timer = window.setTimeout(() => codeInput.current?.focus(), 1200)
    return () => window.clearTimeout(timer)
  }, [sent])

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
    setCode('')
  }

  async function onEmail(event: FormEvent) {
    event.preventDefault()
    if (sent) {
      await onVerify()
      return
    }
    await sendEmail()
  }

  async function onVerify() {
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

  function resetCodeStep() {
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

        <form className="card page" onSubmit={onEmail}>
          <label className="field">
            <span>Email</span>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value)
                if (sent) resetCodeStep()
              }}
              placeholder="you@example.com"
              required
            />
          </label>

          {!usingLocalData && sent ? (
            <>
              <p className="status">
                A 6-digit code is on its way to <strong>{email}</strong>. That email is the code —
                nothing to confirm or tap. Type the number here.
              </p>
              <label className="field">
                <span>Code</span>
                <input
                  ref={codeInput}
                  className="otp-input"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  name="one-time-code"
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 8))}
                  placeholder="123456"
                  required
                />
              </label>
            </>
          ) : !usingLocalData ? (
            <p className="hint">
              We email a number you type in this app. Home-screen installs cannot use an email link.
            </p>
          ) : null}

          {sent && !usingLocalData ? (
            <button className="btn" type="submit" disabled={busy || code.length < 6}>
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          ) : (
            <button className="btn" type="submit" disabled={busy}>
              {usingLocalData ? 'Continue' : busy ? 'Sending…' : 'Email me a code'}
            </button>
          )}

          {sent && !usingLocalData ? (
            <button className="btn-secondary" type="button" disabled={busy} onClick={() => void sendEmail()}>
              Resend code
            </button>
          ) : null}

          {error ? <p className="error">{error}</p> : null}
        </form>
      </div>
    </div>
  )
}
