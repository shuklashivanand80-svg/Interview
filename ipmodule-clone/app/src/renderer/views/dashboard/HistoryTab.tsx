import React, { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface Session {
  id: string
  title: string
  type: 'technical' | 'behavioral' | 'meeting' | 'custom'
  responseMode: string
  model: string
  language: string
  messageCount: number
  createdAt: string
  endedAt?: string
  duration?: number
}

const ipc = () => (window as any).electron?.ipcRenderer ?? null

function getLocalHistory(): Session[] {
  try { return JSON.parse(localStorage.getItem('ip_session_history') || '[]') } catch { return [] }
}

export default function HistoryTab() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selected, setSelected] = useState<Session | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const loadHistory = useCallback(async () => {
    setIsLoading(true)
    try {
      const r = ipc()
      let data: Session[]
      if (r) {
        data = (await r.invoke('history:getAll').catch(() => [])) as Session[]
        // Merge with localStorage fallback
        const local = getLocalHistory()
        const merged = [...data]
        for (const s of local) {
          if (!merged.find(m => m.id === s.id)) merged.push(s)
        }
        data = merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      } else {
        data = getLocalHistory()
      }
      setSessions(data)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { loadHistory() }, [loadHistory])

  const deleteSession = async (id: string) => {
    const r = ipc()
    if (r) await r.invoke('history:delete', id).catch(() => {})
    // Remove from localStorage too
    const local = getLocalHistory().filter(s => s.id !== id)
    localStorage.setItem('ip_session_history', JSON.stringify(local))
    setSessions(prev => prev.filter(s => s.id !== id))
    if (selected?.id === id) setSelected(null)
    setConfirmDeleteId(null)
  }

  const clearAll = async () => {
    const r = ipc()
    if (r) await r.invoke('history:clear').catch(() => {})
    localStorage.removeItem('ip_session_history')
    setSessions([])
    setSelected(null)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
          <span className="text-xs text-white-50">Loading history…</span>
        </div>
      </div>
    )
  }

  if (sessions.length === 0) {
    return (
      <div className="flex items-center justify-center h-full px-6">
        <div className="text-center">
          <div className="text-4xl mb-3">📋</div>
          <p className="text-sm font-medium text-white-70">No sessions yet</p>
          <p className="text-xs text-white-40 mt-1">Start your first session to see history here</p>
          <p className="text-xs text-white-30 mt-1">Sessions are saved locally on your device</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full">
      {/* Session list */}
      <div className="w-1/2 border-r border-line-subtle overflow-y-auto p-3 space-y-1.5">
        <div className="flex items-center justify-between mb-2 px-1">
          <h2 className="text-xs font-semibold text-white-50 uppercase tracking-wider">
            {sessions.length} session{sessions.length !== 1 ? 's' : ''}
          </h2>
          <button onClick={clearAll}
            className="text-[10px] text-white-30 hover:text-red-400 transition-colors">
            Clear all
          </button>
        </div>

        {sessions.map((s, i) => (
          <motion.div key={s.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
            <button
              onClick={() => setSelected(s)}
              className={`w-full text-left rounded-xl border p-3 transition-all ${
                selected?.id === s.id ? 'border-violet-500/50 bg-violet-500/8' : 'border-line bg-surface-raised hover:border-line-strong hover:bg-surface-hover'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-white-90 truncate">{s.title}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${typeColor(s.type)}`}>{s.type}</span>
                    <span className="text-[10px] text-white-30">{formatDate(s.createdAt)}</span>
                  </div>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); setConfirmDeleteId(s.id) }}
                  className="w-5 h-5 rounded flex items-center justify-center text-white-20 hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                </button>
              </div>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-[10px] text-white-30">{s.messageCount || 0} exchanges</span>
                {s.duration && <span className="text-[10px] text-white-30">{formatDuration(s.duration)}</span>}
              </div>
            </button>

            {/* Confirm delete */}
            <AnimatePresence>
              {confirmDeleteId === s.id && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                  className="flex items-center gap-2 px-3 py-1.5 bg-red-500/8 border border-red-500/20 rounded-lg mt-1">
                  <span className="text-xs text-red-400 flex-1">Delete this session?</span>
                  <button onClick={() => deleteSession(s.id)} className="text-xs text-red-400 hover:text-red-300 font-medium">Delete</button>
                  <button onClick={() => setConfirmDeleteId(null)} className="text-xs text-white-40 hover:text-white-60">Cancel</button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>

      {/* Session detail */}
      <div className="flex-1 overflow-y-auto p-4">
        {selected ? (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-white-90">{selected.title}</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Type', value: selected.type },
                { label: 'Model', value: selected.model?.split('/').pop() || 'N/A' },
                { label: 'Mode', value: selected.responseMode || 'N/A' },
                { label: 'Language', value: selected.language || 'English' },
                { label: 'Exchanges', value: String(selected.messageCount || 0) },
                { label: 'Date', value: formatDate(selected.createdAt) },
                ...(selected.duration ? [{ label: 'Duration', value: formatDuration(selected.duration) }] : []),
              ].map(({ label, value }) => (
                <div key={label} className="bg-surface-raised rounded-lg p-2.5 border border-line">
                  <p className="text-[10px] text-white-40 uppercase tracking-wider">{label}</p>
                  <p className="text-xs font-medium text-white-80 mt-0.5 capitalize">{value}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-center">
            <div>
              <div className="text-3xl mb-2">←</div>
              <p className="text-xs text-white-40">Select a session to view details</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function typeColor(type: string) {
  switch (type) {
    case 'technical':  return 'bg-blue-500/15 text-blue-400'
    case 'behavioral': return 'bg-amber-500/15 text-amber-400'
    case 'meeting':    return 'bg-emerald-500/15 text-emerald-400'
    default:           return 'bg-zinc-600/30 text-white-50'
  }
}

function formatDate(iso: string) {
  if (!iso) return 'N/A'
  try {
    const d = new Date(iso)
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    if (diff < 60000) return 'Just now'
    if (diff < 3600000) return `${Math.round(diff / 60000)}m ago`
    if (diff < 86400000) return `${Math.round(diff / 3600000)}h ago`
    return d.toLocaleDateString()
  } catch { return 'N/A' }
}

function formatDuration(ms: number) {
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const rem = s % 60
  return `${m}m ${rem}s`
}
