import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { getCurrentUser, loadLookups, onAuthChange } from '../lib/supabase'
import type { SessionUser } from '../lib/types'

const AuthContext = createContext<SessionUser | null>(null)

export function useUser(): SessionUser {
  const user = useContext(AuthContext)
  if (!user) throw new Error('useUser must be used inside AuthGate')
  return user
}

export function AuthGate({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null | undefined>(undefined)

  useEffect(() => {
    let active = true
    void loadLookups()
    getCurrentUser().then((next) => {
      if (active) setUser(next)
    })
    const unsubscribe = onAuthChange((next) => {
      if (active) setUser(next)
    })
    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  if (user === undefined) {
    return (
      <div className="app">
        <p className="status">Loading…</p>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  return <AuthContext.Provider value={user}>{children}</AuthContext.Provider>
}
