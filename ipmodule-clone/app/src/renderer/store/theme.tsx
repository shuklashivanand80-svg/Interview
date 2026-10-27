import React, { createContext, useContext, useEffect, useState } from 'react'

type ThemeValue = 'dark' | 'light' | 'system'
type ResolvedTheme = 'dark' | 'light'

interface ThemeCtx {
  preference: ThemeValue
  resolved: ResolvedTheme
  setTheme: (t: ThemeValue) => void
}

const Ctx = createContext<ThemeCtx>({ preference: 'dark', resolved: 'dark', setTheme: () => {} })
const ipc = () => (window as any).electron?.ipcRenderer ?? null

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreference] = useState<ThemeValue>('dark')
  const [sysDark, setSysDark] = useState(window.matchMedia('(prefers-color-scheme: dark)').matches)

  useEffect(() => {
    ipc()?.invoke('theme:get').then((t: ThemeValue) => t && setPreference(t)).catch(() => {})
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e: MediaQueryListEvent) => setSysDark(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const resolved: ResolvedTheme = preference === 'system' ? (sysDark ? 'dark' : 'light') : preference

  useEffect(() => {
    const root = document.documentElement
    if (resolved === 'light') root.setAttribute('data-theme', 'light')
    else root.removeAttribute('data-theme')
  }, [resolved])

  const setTheme = (t: ThemeValue) => {
    setPreference(t)
    ipc()?.invoke('theme:set', t).catch(() => {})
    localStorage.setItem('interviewpilot.theme', t)
  }

  return <Ctx.Provider value={{ preference, resolved, setTheme }}>{children}</Ctx.Provider>
}

export const useTheme = () => useContext(Ctx)
