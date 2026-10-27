import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'

const ipc = () => (window as any).electron?.ipcRenderer ?? null

// ─── AI Model Catalog (from original app bundle analysis) ─────────────────────
export const AI_MODELS = [
  // Pro / Featured (matches original screenshot)
  { id: 'openai/gpt-oss-120b',         name: 'GPT-OSS 120B',         provider: 'openai',     tier: 'pro' },
  // Free / Demo tier
  { id: 'openai/gpt-4o-mini',          name: 'GPT-4o Mini',          provider: 'openai',     tier: 'free' },
  { id: 'google/gemini-flash-1.5',     name: 'Gemini 1.5 Flash',     provider: 'google',     tier: 'free' },
  { id: 'deepseek/deepseek-chat',      name: 'DeepSeek Chat',        provider: 'deepseek',   tier: 'free' },
  { id: 'meta/llama-3-8b-instruct',   name: 'Llama 3 8B',           provider: 'meta',       tier: 'free' },
  // Pro tier
  { id: 'openai/gpt-4o',              name: 'GPT-4o',               provider: 'openai',     tier: 'pro' },
  { id: 'anthropic/claude-3-5-sonnet', name: 'Claude 3.5 Sonnet',   provider: 'anthropic',  tier: 'pro' },
  { id: 'google/gemini-pro-1.5',      name: 'Gemini 1.5 Pro',       provider: 'google',     tier: 'pro' },
  { id: 'deepseek/deepseek-r1',       name: 'DeepSeek R1',          provider: 'deepseek',   tier: 'pro' },
  { id: 'mistral/mixtral-8x7b',       name: 'Mixtral 8x7B',         provider: 'mistral',    tier: 'pro' },
  // Premium tier
  { id: 'openai/o1-mini',             name: 'OpenAI o1 Mini',       provider: 'openai',     tier: 'premium' },
  { id: 'anthropic/claude-3-opus',    name: 'Claude 3 Opus',        provider: 'anthropic',  tier: 'premium' },
  { id: 'xai/grok-3',                name: 'Grok 3',               provider: 'xai',        tier: 'premium' },
] as const

export type ModelId = typeof AI_MODELS[number]['id']

export interface AppSettings {
  ai: {
    model: string
    defaultResponseMode: 'concise' | 'explain' | 'story'
    apiKey: string
    temperature?: number
    autoAnswer?: boolean
  }
  stt: {
    provider: 'browser' | 'deepgram' | 'mock'
    apiKey: string
    language: string
  }
  overlay: {
    theme: 'dark' | 'light' | 'system'
    opacity: number
    alwaysOnTop: boolean
  }
}

const DEFAULT_SETTINGS: AppSettings = {
  ai: { model: 'openai/gpt-oss-120b', defaultResponseMode: 'explain', apiKey: '', temperature: 0.7 },
  stt: { provider: 'browser', apiKey: '', language: 'en-US' },
  overlay: { theme: 'dark', opacity: 1, alwaysOnTop: true },
}

interface SettingsContextValue {
  settings: AppSettings
  isLoaded: boolean
  updateAI: (patch: Partial<AppSettings['ai']>) => void
  updateSTT: (patch: Partial<AppSettings['stt']>) => void
  updateOverlay: (patch: Partial<AppSettings['overlay']>) => void
  resetSettings: () => void
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

function deepMerge(base: any, override: any): any {
  const result = { ...base }
  for (const key in override) {
    const v = override[key]
    if (v !== null && v !== undefined && typeof v === 'object' && !Array.isArray(v) && key in result && typeof result[key] === 'object') {
      result[key] = deepMerge(result[key], v)
    } else if (v !== undefined) {
      result[key] = v
    }
  }
  return result
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const r = ipc()
        let loaded: any = null
        if (r) {
          loaded = await r.invoke('settings:load').catch(() => null)
        } else {
          const s = localStorage.getItem('ip_settings')
          if (s) loaded = JSON.parse(s)
        }
        if (loaded) setSettings(deepMerge(DEFAULT_SETTINGS, loaded))
      } catch {}
      setIsLoaded(true)
    }
    load()
  }, [])

  const persist = useCallback((next: AppSettings) => {
    const r = ipc()
    if (r) r.invoke('settings:update', next).catch(() => {})
    else localStorage.setItem('ip_settings', JSON.stringify(next))
  }, [])

  const updateAI = useCallback((patch: Partial<AppSettings['ai']>) => {
    setSettings(s => { const n = { ...s, ai: { ...s.ai, ...patch } }; persist(n); return n })
  }, [persist])

  const updateSTT = useCallback((patch: Partial<AppSettings['stt']>) => {
    setSettings(s => { const n = { ...s, stt: { ...s.stt, ...patch } }; persist(n); return n })
  }, [persist])

  const updateOverlay = useCallback((patch: Partial<AppSettings['overlay']>) => {
    setSettings(s => { const n = { ...s, overlay: { ...s.overlay, ...patch } }; persist(n); return n })
  }, [persist])

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS)
    persist(DEFAULT_SETTINGS)
  }, [persist])

  return (
    <SettingsContext.Provider value={{ settings, isLoaded, updateAI, updateSTT, updateOverlay, resetSettings }}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider')
  return ctx
}
