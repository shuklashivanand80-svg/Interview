/**
 * Auth Store — InterviewPilot Clone
 * ──────────────────────────────────────────────────────────────────────────────
 * LOCAL ACCESS POLICY:
 *   • App starts in LOCAL_FREE mode — Dashboard loads immediately, no login.
 *   • isLoading is always false on mount (no auth spinner blocks the UI).
 *   • Login / Register are OPTIONAL — for cloud AI / sync only.
 *   • No auth guard, no redirect, no session expiry, no plan check.
 *   • Guest user has FULL access to all local features permanently.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'

const API_BASE = 'https://api.interviewpilot.in/api/v1'

// ─── Guest user — permanent local-free account ───────────────────────────────
export const GUEST_USER: User = {
  id: 'guest',
  email: '',
  name: 'Local User',
  plan: 'local-free',
  isGuest: true,
}

export interface User {
  id: string
  email: string
  name: string
  avatar?: string
  plan?: string
  credits?: number
  isGuest?: boolean
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
  expiresAt: number
}

interface AuthState {
  user: User
  tokens: AuthTokens | null
  isAuthenticated: boolean
  isGuest: boolean
  isLoading: false         // Always false — never blocks the UI
  error: string | null
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  continueAsGuest: () => void
  register: (email: string, password: string, name: string) => Promise<void>
  clearError: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)
const ipc = () => (window as any).electron?.ipcRenderer ?? null

// ─── Default state — guest mode, no spinner ──────────────────────────────────
const DEFAULT_STATE: AuthState = {
  user: GUEST_USER,
  tokens: null,
  isAuthenticated: false,
  isGuest: true,
  isLoading: false,
  error: null,
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>(DEFAULT_STATE)
  // Track a separate loading flag only used inside login/register calls
  const [actionLoading, setActionLoading] = useState(false)

  // On mount: silently try to restore saved session. Never blocks render.
  useEffect(() => {
    restoreSavedAuth()
  }, [])

  async function restoreSavedAuth() {
    try {
      const r = ipc()
      let stored: any = null
      if (r) {
        stored = await r.invoke('auth:get-tokens').catch(() => null)
      } else {
        const s = localStorage.getItem('ip_auth')
        if (s) stored = JSON.parse(s)
      }
      if (stored?.tokens && stored.tokens.expiresAt > Date.now() && stored.user) {
        // Valid saved session — restore silently (UI already showing dashboard)
        setState(prev => ({
          ...prev,
          user: stored.user,
          tokens: stored.tokens,
          isAuthenticated: true,
          isGuest: false,
        }))
      }
      // If no saved session or expired: stay as guest — no redirect
    } catch {
      // Always stay as guest on any error
    }
  }

  const continueAsGuest = useCallback(() => {
    setState({ ...DEFAULT_STATE })
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    setActionLoading(true)
    setState(prev => ({ ...prev, error: null }))
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message || `Login failed (${res.status})`)
      }
      const data = await res.json()
      const tokens: AuthTokens = {
        accessToken: data.access_token || data.accessToken,
        refreshToken: data.refresh_token || data.refreshToken,
        expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
      }
      const user: User = data.user || { id: '', email, name: email.split('@')[0], plan: 'free' }
      await saveTokens(tokens, user)
      setState({ user, tokens, isAuthenticated: true, isGuest: false, isLoading: false, error: null })
    } catch (e: any) {
      setState(prev => ({ ...prev, error: e.message || 'Login failed' }))
      throw e
    } finally {
      setActionLoading(false)
    }
  }, [])

  const register = useCallback(async (email: string, password: string, name: string) => {
    setActionLoading(true)
    setState(prev => ({ ...prev, error: null }))
    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message || `Registration failed (${res.status})`)
      }
      const data = await res.json()
      const tokens: AuthTokens = {
        accessToken: data.access_token || data.accessToken,
        refreshToken: data.refresh_token || data.refreshToken,
        expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
      }
      const user: User = data.user || { id: '', email, name, plan: 'free' }
      await saveTokens(tokens, user)
      setState({ user, tokens, isAuthenticated: true, isGuest: false, isLoading: false, error: null })
    } catch (e: any) {
      setState(prev => ({ ...prev, error: e.message || 'Registration failed' }))
      throw e
    } finally {
      setActionLoading(false)
    }
  }, [])

  const logout = useCallback(async () => {
    const r = ipc()
    if (r) await r.invoke('auth:clear-tokens').catch(() => {})
    else localStorage.removeItem('ip_auth')
    // Return to guest — never redirect, stay on dashboard
    setState({ ...DEFAULT_STATE })
  }, [])

  const clearError = useCallback(() =>
    setState(prev => ({ ...prev, error: null })), [])

  return (
    <AuthContext.Provider value={{
      ...state,
      isLoading: actionLoading as unknown as false,
      login,
      logout,
      continueAsGuest,
      register,
      clearError,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

async function saveTokens(tokens: AuthTokens, user: User) {
  const r = ipc()
  const payload = { tokens, user }
  if (r) await r.invoke('auth:store-tokens', tokens, user).catch(() => {})
  else localStorage.setItem('ip_auth', JSON.stringify(payload))
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
