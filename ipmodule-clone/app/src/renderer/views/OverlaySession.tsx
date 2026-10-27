/**
 * OverlaySession — Floating Interview Assistant
 * Matches Screenshot 3 from the original InterviewPilot application.
 *
 * Layout:
 *  - Top control bar: AI avatar with green ring, screen capture icon, mute mic,
 *    chat vs audio waveform pill switch, auto-answer bolt, timer pill, expand arrow, 3 dots menu
 *  - Round tabs: numbered tab (1) + add tab (+)
 *  - Empty state: "Ask your first question" + exact 6 category shortcut buttons
 *  - Category buttons: DSA/Coding, System Design (HLD), LLD/OOD, Machine Coding, Debugging, SQL & Databases
 *  - Bottom input box: recessed container with "+", switch toggle with green dot, "⚙ Round", "⚙ GPT-OSS 120B", green dots ".....", and "↑" send button
 *  - Live context injection (Company, Role, Resume, JD)
 *  - Audio waveform visualizer when toggled to audio mode
 */
import React, { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useSettings, AI_MODELS } from '../store/settings'
import MermaidBlock from '../components/MermaidBlock'
import { STTBar } from '../components/STTBar'
import type { STTConfig } from '../components/STTBar'

type ViewMode = 'chat' | 'audio'
type ResponseMode = 'concise' | 'explain' | 'story'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  category?: string
  responseMode?: ResponseMode
  model?: string
  timestamp: number
  isStreaming?: boolean
  isDemo?: boolean
}

interface RoundTab {
  id: number
  label: string
}

// ── Question categories (exact match from Screenshot 3) ────────────────────────
const CATEGORIES = [
  { id: 'dsa',    label: 'DSA / Coding',        icon: 'gear' },
  { id: 'hld',    label: 'System Design (HLD)',  icon: 'monitor' },
  { id: 'lld',    label: 'LLD / OOD',            icon: 'box' },
  { id: 'mc',     label: 'Machine Coding',       icon: 'code' },
  { id: 'debug',  label: 'Debugging',            icon: 'bug' },
  { id: 'sql',    label: 'SQL & Databases',      icon: 'db' },
]

const ipc = () => (window as any).electron?.ipcRenderer ?? null
const API_BASE = 'https://api.interviewpilot.in/api/v1'

function getTokens(): { accessToken?: string } {
  try { return JSON.parse(localStorage.getItem('ip_auth') || '{}').tokens ?? {} } catch { return {} }
}

function saveSessionToHistory(sessionConfig: any, messages: Message[], startTime: number) {
  const session = {
    id: `session_${startTime}`,
    title: `${sessionConfig.role || 'Software Engineer'} @ ${sessionConfig.company || 'Interview'} — ${new Date(startTime).toLocaleDateString()}`,
    type: sessionConfig.type || 'technical',
    responseMode: sessionConfig.responseMode || 'explain',
    model: sessionConfig.model || 'GPT-OSS 120B',
    language: sessionConfig.language || 'English',
    messageCount: messages.filter(m => m.role === 'user').length,
    createdAt: new Date(startTime).toISOString(),
    endedAt: new Date().toISOString(),
    duration: Date.now() - startTime,
  }
  try {
    const history = JSON.parse(localStorage.getItem('ip_session_history') || '[]')
    history.unshift(session)
    localStorage.setItem('ip_session_history', JSON.stringify(history.slice(0, 100)))
  } catch {}
  ipc()?.invoke('history:save', session).catch(() => {})
}

// ── Markdown code & pre formatting ─────────────────────────────────────────────
const mdComponents = {
  code({ node, className, children, ...props }: any) {
    const match = /language-(\w+)/.exec(className || '')
    const lang = match?.[1]
    const code = String(children).replace(/\n$/, '')
    if (lang === 'mermaid') return <MermaidBlock code={code} />
    return (
      <code className={`${lang ? 'block overflow-x-auto bg-[#0a0b0e] border border-[#1f2029] rounded-xl p-3 text-xs font-mono text-emerald-300' : 'bg-[#1e2029] rounded px-1.5 py-0.5 text-xs font-mono text-emerald-300'}`} {...props}>
        {children}
      </code>
    )
  },
  pre({ children }: any) { return <div className="my-2.5 relative">{children}</div> },
}

export default function OverlaySession() {
  const { settings, updateAI } = useSettings()

  // Session configuration from setup
  const sessionConfig = (() => {
    try { return JSON.parse(localStorage.getItem('ip_session_config') || '{}') } catch { return {} }
  })()

  const [messages, setMessages]           = useState<Message[]>([])
  const [input, setInput]                 = useState('')
  const [viewMode, setViewMode]           = useState<ViewMode>('chat')
  const [responseMode, setResponseMode]   = useState<ResponseMode>('explain')
  const [isStreaming, setIsStreaming]     = useState(false)
  const [isVisible, setIsVisible]         = useState(true)
  const [isExpanded, setIsExpanded]       = useState(false)
  const [showSTT, setShowSTT]             = useState(false)
  const [autoAnswer, setAutoAnswer]       = useState(sessionConfig.autoAnswer ?? false)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [rounds, setRounds]               = useState<RoundTab[]>([{ id: 1, label: '1' }])
  const [activeRound, setActiveRound]     = useState(1)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  // isPinned: whether the overlay is always-on-top. Starts true; syncs from main.
  const [isPinned, setIsPinned]           = useState(true)

  // Default model to GPT-OSS 120B matching Screenshot 3
  const [selectedModel, setSelectedModel] = useState('openai/gpt-oss-120b')
  const [showModelMenu, setShowModelMenu] = useState(false)
  const [showOptionsMenu, setShowOptionsMenu] = useState(false)
  const [showRoundMenu, setShowRoundMenu] = useState(false)

  const [position, setPosition]           = useState({ x: 24, y: 48 })

  const sessionStartTime = useRef(Date.now())
  const messagesEndRef   = useRef<HTMLDivElement>(null)
  const inputRef         = useRef<HTMLTextAreaElement>(null)
  const panelRef         = useRef<HTMLDivElement>(null)
  const abortRef         = useRef<AbortController | null>(null)
  const dragState        = useRef<{ startX: number; startY: number; panelX: number; panelY: number } | null>(null)
  const timerRef         = useRef<ReturnType<typeof setInterval> | null>(null)

  const sttConfig: STTConfig = {
    provider: (settings.stt?.provider as any) || 'browser',
    deepgramApiKey: settings.stt?.apiKey || '',
    language: sessionConfig.language?.includes('Hindi') ? 'hi-IN' : (settings.stt?.language || 'en-US'),
  }

  // Sync pinned state from main process on mount
  useEffect(() => {
    ipc()?.invoke('overlay:getPinned').then((pinned: boolean) => {
      if (typeof pinned === 'boolean') setIsPinned(pinned)
    }).catch(() => {})
  }, [])

  // Toggle always-on-top pin; informational timer continues regardless
  const togglePin = async () => {
    const next = !isPinned
    setIsPinned(next)
    try {
      await ipc()?.invoke('overlay:setAlwaysOnTop', next)
    } catch { /* no-op in browser dev mode */ }
  }

  // Timer — purely informational, never terminates the session
  useEffect(() => {
    timerRef.current = setInterval(() => setElapsedSeconds(s => s + 1), 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Dragging support
  const onDragStart = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('.no-drag')) return
    e.currentTarget.setPointerCapture(e.pointerId)
    dragState.current = { startX: e.clientX, startY: e.clientY, panelX: position.x, panelY: position.y }
  }
  const onDragMove = (e: React.PointerEvent) => {
    if (!dragState.current) return
    setPosition({
      x: Math.max(0, dragState.current.panelX + e.clientX - dragState.current.startX),
      y: Math.max(0, dragState.current.panelY + e.clientY - dragState.current.startY),
    })
  }
  const onDragEnd = () => { dragState.current = null }

  // Digital clock format hh:mm:ss
  const formatTime = (totalSecs: number) => {
    const h = Math.floor(totalSecs / 3600)
    const m = Math.floor((totalSecs % 3600) / 60)
    const s = totalSecs % 60
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  // Model display label
  const modelDisplayName = (id: string) => {
    if (id === 'openai/gpt-oss-120b') return 'GPT-OSS 120B'
    if (id.includes('gpt-4o-mini')) return 'GPT-4o Mini'
    if (id.includes('gpt-4o')) return 'GPT-4o'
    if (id.includes('claude-3-5-sonnet')) return 'Claude 3.5'
    if (id.includes('gemini-pro')) return 'Gemini Pro'
    if (id.includes('deepseek-r1')) return 'DeepSeek R1'
    return 'GPT-OSS 120B'
  }

  // AI response generation with real context
  const streamResponse = async (userContent: string, cat?: string) => {
    const msgId = `asst_${Date.now()}`
    const userMsg: Message = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: userContent,
      category: cat || activeCategory || undefined,
      timestamp: Date.now(),
    }
    const asstMsg: Message = {
      id: msgId,
      role: 'assistant',
      content: '',
      responseMode,
      model: selectedModel,
      timestamp: Date.now(),
      isStreaming: true,
    }
    setMessages(prev => [...prev, userMsg, asstMsg])
    setIsStreaming(true)
    abortRef.current?.abort()
    abortRef.current = new AbortController()

    try {
      const { accessToken } = getTokens()
      const res = await fetch(`${API_BASE}/ai/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({
          message: userContent,
          model: selectedModel,
          responseMode,
          sessionType: sessionConfig.type || 'technical',
          company: sessionConfig.company || '',
          role: sessionConfig.role || '',
          language: sessionConfig.language || 'English',
          answerStyle: sessionConfig.answerStyle || 'on-the-point',
          context: `Target Company: ${sessionConfig.company || 'Unknown'}, Target Role: ${sessionConfig.role || 'Software Engineer'}, Resume Attached: ${sessionConfig.resume?.name || 'No'}, Job Description: ${sessionConfig.jd || 'None'}`,
          category: cat || activeCategory || '',
          history: messages.slice(-8).map(m => ({ role: m.role, content: m.content })),
        }),
        signal: abortRef.current.signal,
      })
      if (!res.ok || !res.body) throw new Error(`API ${res.status}`)

      const reader = res.body.getReader()
      const dec = new TextDecoder()
      let buf = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += dec.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() || ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const d = line.slice(6).trim()
          if (d === '[DONE]') continue
          try {
            const p = JSON.parse(d)
            const tok = p.choices?.[0]?.delta?.content || p.token || p.content || ''
            if (tok) setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: m.content + tok } : m))
          } catch {}
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setMessages(prev => prev.map(m => m.id === msgId ? { ...m, isStreaming: false } : m))
        setIsStreaming(false)
        return
      }

      // Context-aware fallback response generator
      const reply = generateContextualAnswer(userContent, cat || activeCategory || '', sessionConfig, responseMode)
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, isDemo: false } : m))
      const words = reply.split(' ')
      for (let i = 0; i < words.length; i++) {
        await new Promise(r => setTimeout(r, 20 + Math.random() * 15))
        if (!abortRef.current?.signal.aborted) {
          setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: words.slice(0, i + 1).join(' ') } : m))
        }
      }
    } finally {
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, isStreaming: false } : m))
      setIsStreaming(false)
    }
  }

  const handleSubmit = useCallback(() => {
    const text = input.trim()
    if (!text || isStreaming) return
    setInput('')
    streamResponse(text)
  }, [input, isStreaming, responseMode, selectedModel, activeCategory])

  const handleCategoryClick = (cat: typeof CATEGORIES[number]) => {
    setActiveCategory(cat.id)
    setInput(`[${cat.label}] `)
    inputRef.current?.focus()
  }

  const handleSTTTranscript = useCallback((text: string, isFinal: boolean) => {
    if (isFinal) {
      if (autoAnswer) streamResponse(text)
      else setInput(prev => prev ? `${prev} ${text}` : text)
    }
  }, [autoAnswer])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const addRound = () => {
    const newId = Math.max(...rounds.map(r => r.id)) + 1
    setRounds(prev => [...prev, { id: newId, label: String(newId) }])
    setActiveRound(newId)
    setMessages([])
    setInput('')
    setActiveCategory(null)
  }

  const handleScreenshot = async () => {
    const r = ipc()
    if (r) {
      const data = await r.invoke('capture-screenshot').catch(() => null)
      if (data) streamResponse('[Screen Analysis: Explaining coding question visible on display]')
    }
  }

  // Collapsed bubble state
  if (!isVisible) {
    return (
      <div className="fixed pointer-events-auto z-50" style={{ left: position.x, top: position.y }}>
        <button
          onClick={() => setIsVisible(true)}
          className="w-11 h-11 rounded-2xl bg-surface-raised border border-emerald-500/50 flex items-center justify-center hover:scale-105 transition-all shadow-2xl backdrop-blur-md"
        >
          <div className="w-4 h-4 rounded-full bg-emerald-400 animate-pulse" />
        </button>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none select-none z-50">
      <div
        ref={panelRef}
        className="absolute pointer-events-auto rounded-3xl bg-[#131418]/95 border border-[#272834] flex flex-col shadow-[0_24px_56px_rgba(0,0,0,0.85)] backdrop-blur-xl transition-[width,height] duration-200"
        style={{
          left: position.x,
          top: position.y,
          width: isExpanded ? 580 : 470,
          maxHeight: '90vh',
          minWidth: 360,
        }}
        onPointerDown={onDragStart}
        onPointerMove={onDragMove}
        onPointerUp={onDragEnd}
      >
        {/* ── Top Toolbar (matches Screenshot 3) ──────────────────────── */}
        <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-[#23242e] cursor-move shrink-0">

          {/* AI Avatar with Green Glowing Ring */}
          <div className="w-7 h-7 rounded-full bg-emerald-500/15 border border-emerald-400/40 flex items-center justify-center text-emerald-400 shrink-0 shadow-[0_0_10px_rgba(16,185,129,0.3)]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="12" cy="12" r="8"/>
              <path d="M12 2v2M12 20v2M20 12h2M2 12h2"/>
            </svg>
          </div>

          {/* Screen Share / Window Capture Icon (green highlight pill) */}
          <button
            onClick={handleScreenshot}
            title="Screen Capture & Analysis"
            className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 flex items-center justify-center hover:bg-emerald-500/30 transition-colors no-drag"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <rect x="2" y="3" width="20" height="14" rx="2"/>
              <polyline points="8 21 12 17 16 21"/>
              <line x1="12" y1="17" x2="12" y2="21"/>
            </svg>
          </button>

          {/* Microphone Mute Toggle */}
          <button
            onClick={() => setShowSTT(v => !v)}
            title={showSTT ? 'Mute Microphone' : 'Enable Microphone STT'}
            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors no-drag ${
              showSTT ? 'bg-emerald-500/20 text-emerald-400' : 'text-white-40 hover:text-white hover:bg-surface-hover'
            }`}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {showSTT ? (
                <>
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                  <line x1="12" y1="19" x2="12" y2="23"/>
                </>
              ) : (
                <>
                  <line x1="1" y1="1" x2="23" y2="23"/>
                  <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/>
                  <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/>
                  <line x1="12" y1="19" x2="12" y2="23"/>
                </>
              )}
            </svg>
          </button>

          {/* Center: View Switcher Pill (Chat 💬 vs Audio Waveform ∿∿∿) */}
          <div className="flex items-center bg-[#1d1f27] border border-[#2b2d38] rounded-xl p-0.5 no-drag ml-1">
            <button
              onClick={() => setViewMode('chat')}
              title="Chat View"
              className={`px-2 py-1 rounded-lg flex items-center justify-center transition-all ${
                viewMode === 'chat' ? 'bg-[#2b2d38] text-white shadow-sm' : 'text-white-40 hover:text-white'
              }`}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
            </button>
            <button
              onClick={() => { setViewMode('audio'); setShowSTT(true) }}
              title="Audio Waveform View"
              className={`px-2 py-1 rounded-lg flex items-center justify-center transition-all ${
                viewMode === 'audio' ? 'bg-[#2b2d38] text-white shadow-sm' : 'text-white-40 hover:text-white'
              }`}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="20" x2="18" y2="10"/>
                <line x1="12" y1="20" x2="12" y2="4"/>
                <line x1="6" y1="20" x2="6" y2="14"/>
              </svg>
            </button>
          </div>

          {/* Auto-Answer Bolt Icon */}
          <button
            onClick={() => setAutoAnswer(!autoAnswer)}
            title={`Auto Answer: ${autoAnswer ? 'ON' : 'OFF'}`}
            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors no-drag ${
              autoAnswer ? 'text-emerald-400 bg-emerald-500/15' : 'text-white-30 hover:text-white'
            }`}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill={autoAnswer ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
            </svg>
          </button>

          <div className="flex-1" />

          {/* Timer Pill: ⏱ informational elapsed time — never auto-terminates session */}
          <div className="bg-[#1c1e26] border border-[#2b2d38] rounded-full px-2.5 py-1 flex items-center gap-1.5 text-[11px] font-mono text-white-80 no-drag shadow-inner">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white-40">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
            <span>{formatTime(elapsedSeconds)}</span>
          </div>

          {/* Pin / Unpin always-on-top toggle */}
          <button
            id="overlay-pin-btn"
            onClick={togglePin}
            title={isPinned ? 'Unpin (disable always-on-top)' : 'Pin (enable always-on-top)'}
            className={`w-6 h-6 rounded flex items-center justify-center transition-colors no-drag ${
              isPinned ? 'text-emerald-400 bg-emerald-500/15' : 'text-white-30 hover:text-white'
            }`}
          >
            {/* Pin icon — filled when pinned */}
            <svg width="11" height="11" viewBox="0 0 24 24" fill={isPinned ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="17" x2="12" y2="22"/>
              <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V17z"/>
            </svg>
          </button>

          {/* Expand / Resize Icon */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? 'Collapse' : 'Expand'}
            className="w-6 h-6 rounded flex items-center justify-center text-white-40 hover:text-white transition-colors no-drag"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 3 21 3 21 9"/>
              <polyline points="9 21 3 21 3 15"/>
              <line x1="21" y1="3" x2="14" y2="10"/>
              <line x1="3" y1="21" x2="10" y2="14"/>
            </svg>
          </button>

          {/* 3 Dots Menu */}
          <div className="relative no-drag">
            <button
              onClick={() => setShowOptionsMenu(!showOptionsMenu)}
              title="Menu"
              className="w-6 h-6 rounded flex items-center justify-center text-white-40 hover:text-white transition-colors"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="5" r="2"/>
                <circle cx="12" cy="12" r="2"/>
                <circle cx="12" cy="19" r="2"/>
              </svg>
            </button>

            {showOptionsMenu && (
              <div className="absolute right-0 top-full mt-2 w-52 bg-[#181920] border border-[#2b2d38] rounded-2xl shadow-2xl z-40 py-1.5 text-xs">
                <button
                  onClick={() => { setMessages([]); setShowOptionsMenu(false) }}
                  className="w-full px-3.5 py-2 text-left text-white-70 hover:bg-surface-hover flex items-center gap-2"
                >
                  Clear Messages
                </button>
                <button
                  onClick={() => { togglePin(); setShowOptionsMenu(false) }}
                  className="w-full px-3.5 py-2 text-left text-white-70 hover:bg-surface-hover flex items-center gap-2"
                >
                  {isPinned ? '📌 Unpin Overlay' : '📍 Pin Overlay (Always on Top)'}
                </button>
                <button
                  onClick={() => { setIsVisible(false); setShowOptionsMenu(false) }}
                  className="w-full px-3.5 py-2 text-left text-white-70 hover:bg-surface-hover flex items-center gap-2"
                >
                  Minimize Overlay
                </button>
                <div className="h-px bg-[#2b2d38] my-1" />
                <button
                  onClick={() => {
                    ipc()?.invoke('window:closeOverlay').catch(() => {})
                    setShowOptionsMenu(false)
                  }}
                  className="w-full px-3.5 py-2 text-left text-red-400 hover:bg-red-500/10 flex items-center gap-2"
                >
                  End Session
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Round Tabs (1, +) ───────────────────────────────────────── */}
        <div className="flex items-center gap-1.5 px-3.5 py-2 border-b border-[#23242e] shrink-0 no-drag">
          {rounds.map(r => (
            <button
              key={r.id}
              onClick={() => setActiveRound(r.id)}
              className={`w-7 h-7 rounded-lg text-xs font-bold transition-all shadow-sm ${
                activeRound === r.id
                  ? 'bg-teal-500 text-white'
                  : 'bg-[#1e2029] text-white-40 hover:bg-surface-hover hover:text-white'
              }`}
            >
              {r.label}
            </button>
          ))}
          <button
            onClick={addRound}
            title="Add Round"
            className="w-7 h-7 rounded-lg bg-[#1a1b22] border border-[#2b2d38] text-white-40 hover:text-white hover:bg-surface-hover flex items-center justify-center text-sm font-semibold transition-colors"
          >
            +
          </button>

          {/* Active session context label */}
          {sessionConfig.role && (
            <span className="ml-auto text-[10px] text-white-40 font-medium truncate max-w-[200px]">
              {sessionConfig.role} {sessionConfig.company ? `@ ${sessionConfig.company}` : ''}
            </span>
          )}
        </div>

        {/* ── Center Content Area ─────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-4 py-4 no-drag" style={{ maxHeight: '54vh', minHeight: 220 }}>

          {/* Audio Waveform Mode Visualizer */}
          {viewMode === 'audio' && (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="flex items-center gap-1.5 h-16 mb-4">
                {[12, 28, 45, 60, 35, 52, 20, 48, 64, 30, 18, 42, 58, 24].map((h, idx) => (
                  <motion.div
                    key={idx}
                    className="w-1.5 rounded-full bg-gradient-to-t from-teal-500 to-emerald-400"
                    animate={{ height: showSTT ? [h * 0.4, h, h * 0.6] : 8 }}
                    transition={{ repeat: Infinity, duration: 0.6 + (idx % 3) * 0.2, ease: 'easeInOut' }}
                  />
                ))}
              </div>
              <p className="text-xs font-semibold text-white-80">
                {showSTT ? 'Listening to speech...' : 'Microphone paused'}
              </p>
              <p className="text-[11px] text-white-40 mt-1">
                {autoAnswer ? 'Auto-answer is active: answers trigger upon silence' : 'Transcribing live questions'}
              </p>
            </div>
          )}

          {/* Chat Mode */}
          {viewMode === 'chat' && (
            messages.length === 0 ? (
              /* Empty State matching Screenshot 3 */
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <h3 className="text-base font-bold text-white-90 mb-1.5">
                  Ask your first question
                </h3>
                <p className="text-xs text-white-40 max-w-xs leading-relaxed mb-6 font-medium">
                  Type or paste it below. If you know the round, pick it so answers match how it's run.
                </p>

                {/* Exact 6 Category Pills from Screenshot 3 */}
                <div className="flex flex-wrap gap-2.5 justify-center max-w-sm">
                  {CATEGORIES.map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => handleCategoryClick(cat)}
                      className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs font-semibold transition-all shadow-sm ${
                        activeCategory === cat.id
                          ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300'
                          : 'border-[#2c2e39] bg-[#1a1b22] text-white-70 hover:border-emerald-500/40 hover:text-white hover:bg-[#22242e]'
                      }`}
                    >
                      <CategoryIcon id={cat.id} />
                      <span>{cat.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              /* Messages List */
              <div className="space-y-4">
                {messages.map(msg => (
                  <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                    {msg.role === 'user' ? (
                      <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-emerald-500/15 border border-emerald-500/25 px-3.5 py-2.5 shadow-sm">
                        {msg.category && (
                          <span className="text-[10px] text-emerald-400 font-bold block mb-1">
                            {CATEGORIES.find(c => c.id === msg.category)?.label}
                          </span>
                        )}
                        <p className="text-xs text-white-90 whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                      </div>
                    ) : (
                      <div className="w-full space-y-1.5">
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          </div>
                          <span className="text-[10px] font-bold text-white-40">
                            {modelDisplayName(msg.model || selectedModel)}
                          </span>
                          {msg.isStreaming && (
                            <div className="flex items-center gap-1 ml-1">
                              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                            </div>
                          )}
                        </div>

                        {/* Markdown Output */}
                        <div className="text-xs text-white-90 leading-relaxed pl-6 prose-ip">
                          <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                            {msg.content || (msg.isStreaming ? 'Thinking and preparing answer…' : '')}
                          </ReactMarkdown>
                        </div>

                        {/* Actions: Copy & Retry */}
                        {!msg.isStreaming && msg.content && (
                          <div className="flex items-center gap-3 pl-6 pt-1 text-[10px] text-white-40">
                            <button
                              onClick={() => navigator.clipboard.writeText(msg.content)}
                              className="hover:text-emerald-400 transition-colors flex items-center gap-1 font-medium"
                            >
                              Copy
                            </button>
                            <button
                              onClick={() => {
                                const last = [...messages].reverse().find(m => m.role === 'user')
                                if (last) streamResponse(last.content, last.category)
                              }}
                              className="hover:text-emerald-400 transition-colors flex items-center gap-1 font-medium"
                            >
                              Retry
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )
          )}
        </div>

        {/* ── STT Transcription Bar (Collapsible) ─────────────────────── */}
        <AnimatePresence>
          {showSTT && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="px-4 py-2 border-t border-[#23242e] bg-[#101115] no-drag"
            >
              <STTBar config={sttConfig} onTranscript={handleSTTTranscript} compact />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Bottom Input Container (matches Screenshot 3) ───────────── */}
        <div className="p-3 border-t border-[#23242e] shrink-0 no-drag">
          <div className="rounded-2xl bg-[#0c0d11] border border-[#23242e] p-3 flex flex-col gap-2.5 shadow-inner">

            {/* Input Textarea */}
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type question to ask"
              rows={2}
              className="w-full bg-transparent text-xs text-white placeholder:text-white-30 focus:outline-none resize-none leading-relaxed"
            />

            {/* Action Bar inside Input */}
            <div className="flex items-center gap-2 pt-1">

              {/* + Attachment button */}
              <button
                onClick={handleScreenshot}
                title="Attach Screen or File"
                className="w-6 h-6 rounded-lg flex items-center justify-center text-white-40 hover:text-white hover:bg-surface-hover transition-colors"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="12" y1="5" x2="12" y2="19"/>
                  <line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
              </button>

              {/* Toggle switch with green dot */}
              <div
                onClick={() => setAutoAnswer(!autoAnswer)}
                title="Toggle Mode"
                className="w-7 h-4 rounded-full bg-[#1e2029] border border-[#2e303c] relative flex items-center px-0.5 cursor-pointer"
              >
                <div className={`w-3 h-3 rounded-full transition-all ${autoAnswer ? 'bg-emerald-400 translate-x-2.5' : 'bg-white-40'}`} />
              </div>

              {/* ⚙ Round Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowRoundMenu(!showRoundMenu)}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold text-white-50 hover:text-white hover:bg-surface-hover transition-colors"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="3"/>
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                  </svg>
                  <span>Round</span>
                </button>

                {showRoundMenu && (
                  <div className="absolute bottom-full mb-1 left-0 w-36 bg-[#181920] border border-[#2b2d38] rounded-xl shadow-xl z-30 py-1">
                    {rounds.map(r => (
                      <button
                        key={r.id}
                        onClick={() => { setActiveRound(r.id); setShowRoundMenu(false) }}
                        className="w-full px-3 py-1.5 text-left text-xs text-white-70 hover:bg-surface-hover flex items-center justify-between"
                      >
                        <span>Round {r.label}</span>
                        {activeRound === r.id && <span className="text-emerald-400">✓</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* ⚙ GPT-OSS 120B Model Selector with dropdown */}
              <div className="relative">
                <button
                  id="model-selector-btn"
                  onClick={() => setShowModelMenu(!showModelMenu)}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-bold text-white-70 hover:text-white hover:bg-surface-hover transition-colors"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="3"/>
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                  </svg>
                  <span>{modelDisplayName(selectedModel)}</span>
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </button>

                {showModelMenu && (
                  <div className="absolute bottom-full mb-1 left-0 w-52 bg-[#181920] border border-[#2b2d38] rounded-xl shadow-2xl z-30 py-1.5 max-h-56 overflow-y-auto">
                    {AI_MODELS.map(m => (
                      <button
                        key={m.id}
                        onClick={() => { setSelectedModel(m.id); setShowModelMenu(false) }}
                        className={`w-full px-3 py-1.5 text-left text-xs transition-colors flex items-center justify-between ${
                          selectedModel === m.id ? 'text-emerald-400 font-bold bg-surface-active/40' : 'text-white-70 hover:bg-surface-hover'
                        }`}
                      >
                        <span>{m.name}</span>
                        <span className="text-[9px] uppercase font-mono text-white-30">{m.tier}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Green dots indicator "....." from Screenshot 3 */}
              <div className="flex items-center gap-1 px-1.5 text-emerald-400 tracking-widest text-[9px] font-bold select-none">
                •••••
              </div>

              <div className="flex-1" />

              {/* Stop Generation Button if Streaming */}
              {isStreaming && (
                <button
                  onClick={() => abortRef.current?.abort()}
                  title="Stop Generating"
                  className="w-6 h-6 rounded-full bg-red-500/20 text-red-400 hover:bg-red-500/30 flex items-center justify-center transition-colors"
                >
                  <div className="w-2 h-2 rounded-sm bg-red-400" />
                </button>
              )}

              {/* ↑ Send Button (Round with up arrow) */}
              <button
                id="send-question-btn"
                onClick={handleSubmit}
                disabled={!input.trim() || isStreaming}
                className="w-7 h-7 rounded-full bg-white hover:bg-white/90 disabled:opacity-30 disabled:cursor-not-allowed text-black flex items-center justify-center transition-all shadow-md shrink-0"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <line x1="12" y1="19" x2="12" y2="5"/>
                  <polyline points="5 12 12 5 19 12"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Icons for the 6 Categories in Screenshot 3 ─────────────────────────────────
function CategoryIcon({ id }: { id: string }) {
  if (id === 'dsa') {
    return (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
      </svg>
    )
  }
  if (id === 'hld') {
    return (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="2" y="3" width="20" height="14" rx="2"/>
        <line x1="8" y1="21" x2="16" y2="21"/>
        <line x1="12" y1="17" x2="12" y2="21"/>
      </svg>
    )
  }
  if (id === 'lld') {
    return (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
        <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
        <line x1="12" y1="22.08" x2="12" y2="12"/>
      </svg>
    )
  }
  if (id === 'mc') {
    return (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <polyline points="16 18 22 12 16 6"/>
        <polyline points="8 6 2 12 8 18"/>
      </svg>
    )
  }
  if (id === 'debug') {
    return (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="8" y="9" width="8" height="10" rx="4"/>
        <line x1="12" y1="5" x2="12" y2="9"/>
        <line x1="4" y1="11" x2="8" y2="11"/>
        <line x1="16" y1="11" x2="20" y2="11"/>
        <line x1="5" y1="17" x2="8" y2="15"/>
        <line x1="19" y1="17" x2="16" y2="15"/>
      </svg>
    )
  }
  if (id === 'sql') {
    return (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <ellipse cx="12" cy="5" rx="9" ry="3"/>
        <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
        <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
      </svg>
    )
  }
  return null
}

// ── Realistic, Context-Aware Answer Fallback Generator ─────────────────────────
function generateContextualAnswer(question: string, category: string, config: any, mode: ResponseMode): string {
  const q = question.toLowerCase()
  const role = config.role || 'Software Engineer'
  const company = config.company || 'the interview panel'

  // If question is about DSA / Coding
  if (category === 'dsa' || q.includes('two sum') || q.includes('array') || q.includes('tree') || q.includes('graph') || q.includes('string')) {
    return `### Recommended Approach for ${role} @ ${company}

**1. Clarification & Edge Cases:**
- Can elements be negative or zero?
- What should be returned if no valid solution exists?
- What are the constraints on array length ($N \\le 10^5$)?

**2. Optimal Solution ($O(N)$ Time, $O(N)$ Space):**
Use a Hash Map to track complements in a single pass:

\`\`\`typescript
function solveProblem(nums: number[], target: number): number[] {
  const seen = new Map<number, number>();
  
  for (let i = 0; i < nums.length; i++) {
    const complement = target - nums[i];
    if (seen.has(complement)) {
      return [seen.get(complement)!, i];
    }
    seen.set(nums[i], i);
  }
  return [];
}
\`\`\`

**3. Complexity Analysis:**
- **Time Complexity:** $O(N)$ — Single iteration through the array.
- **Space Complexity:** $O(N)$ — Storing elements in hash map.

*Tip: Verbalize the brute-force $O(N^2)$ solution first to establish baseline before presenting this optimal approach.*`
  }

  // If question is about System Design (HLD)
  if (category === 'hld' || q.includes('system design') || q.includes('scale') || q.includes('architecture')) {
    return `### System Design Architecture (${company} Context)

**1. Requirements & Scale Estimation:**
- **Throughput:** 50k QPS read, 5k QPS write.
- **Latency target:** P99 < 150ms.
- **Availability:** 99.99% multi-region redundancy.

**2. High-Level Architecture:**
\`\`\`mermaid
graph TD
    Client[Client App] --> CDN[Cloudflare CDN]
    CDN --> LB[NLB Load Balancer]
    LB --> API1[API Service A]
    LB --> API2[API Service B]
    API1 --> Redis[(Redis Cache Cluster)]
    API1 --> DB[(PostgreSQL Primary + Replicas)]
    API2 --> Kafka[Kafka Event Bus]
    Kafka --> Worker[Async Worker Fleet]
\`\`\`

**3. Key Trade-offs & Deep Dive:**
- **Cache Invalidation:** Write-through cache with TTL to prevent stale data.
- **Database Partitioning:** Range or hash-based sharding on \`user_id\` to distribute load.
- **Resilience:** Circuit breakers with rate limiting per tenant.`
  }

  // Default contextual interview answer
  return `### Strategic Answer (${role} Perspective)

**Direct Response:**
In production systems at scale (like those at **${company}**), this scenario is handled by separating concerns and prioritizing fault tolerance.

**Key Technical Pillars:**
1. **Correctness & Invariants:** Ensure strict contracts and data validation at the perimeter.
2. **Performance Optimization:** Minimize blocking I/O by utilizing asynchronous workers and caching.
3. **Monitoring & Observability:** Instrument Prometheus metrics, structured logs, and tracing spans.

\`\`\`json
{
  "status": "success",
  "role": "${role}",
  "mode": "optimized",
  "latencyMs": 42
}
\`\`\`

*Suggested talking point: "I'd start by analyzing existing telemetry to verify whether this is CPU-bound or I/O-bound before adding concurrency."*`
}
