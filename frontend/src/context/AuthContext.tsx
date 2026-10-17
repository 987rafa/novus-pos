// oxlint-disable react/only-export-components -- provider + hook viven juntos por diseño
import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { AUTH_KEY, api } from '../lib/api'
import type { TokenOut, User } from '../lib/types'

interface AuthState {
  token: string
  user: User
}

interface AuthContextValue {
  user: User | null
  login: (email: string, password: string) => Promise<User>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

function readStoredAuth(): AuthState | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY)
    return raw ? (JSON.parse(raw) as AuthState) : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState | null>(readStoredAuth)

  const login = useCallback(async (email: string, password: string) => {
    const data = await api.post<TokenOut>('/auth/login', { email, password })
    localStorage.setItem(AUTH_KEY, JSON.stringify({ token: data.access_token, user: data.user }))
    setAuth({ token: data.access_token, user: data.user })
    return data.user
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(AUTH_KEY)
    setAuth(null)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ user: auth?.user ?? null, login, logout }),
    [auth, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
