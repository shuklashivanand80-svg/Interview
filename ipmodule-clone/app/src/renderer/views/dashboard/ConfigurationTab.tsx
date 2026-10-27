/**
 * ConfigurationTab — "Configuration" screen
 * Matches Screenshot 2 from the original InterviewPilot application.
 *
 * Sections:
 *  - Interview summary card: Briefcase icon, Role, Company, "✓ Resume" badge, "Edit" button
 *  - Answer Style selector with BUILT-IN badge + "⚙ Manage" link
 *  - Interview Language dropdown (Auto (English + Hindi), English, Hindi, etc.)
 *  - Auto Answer toggle (Off / On with switch slider)
 *  - Session duration card: Free session 10 min, ...
 *  - Start Interview button (bottom-right white pill button)
 */
import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useSettings } from '../../store/settings'

const ipc = () => (window as any).electron?.ipcRenderer ?? null

export interface SessionConfigData {
  company: string
  role: string
  jd: string
  resume: { name: string; size: number; path?: string } | null
  brief: { name: string; size: number; path?: string } | null
  answerStyle?: string
  language?: string
  autoAnswer?: boolean
  model?: string
}

const ANSWER_STYLES = [
  {
    id: 'on-the-point',
    label: 'On the point',
    badge: 'BUILT-IN',
    desc: 'Sounds like a real person — simple English, natural filler words, first person, bullet-pointed answers.',
    icon: '✳',
  },
  {
    id: 'structured',
    label: 'Structured',
    badge: 'BUILT-IN',
    desc: 'Organised with clear headings, numbered steps, and formal phrasing.',
    icon: '📋',
  },
  {
    id: 'star',
    label: 'STAR Method',
    badge: 'BUILT-IN',
    desc: 'Situation → Task → Action → Result format. Best for behavioural questions.',
    icon: '⭐',
  },
  {
    id: 'concise',
    label: 'Concise Bullet Points',
    badge: 'BUILT-IN',
    desc: 'Direct, high-impact key phrases and code snippets without fluff.',
    icon: '⚡',
  },
]

const LANGUAGES = [
  { value: 'auto', label: 'Auto (English + Hindi)', sub: 'AUTO' },
  { value: 'en',   label: 'English',                sub: 'EN' },
  { value: 'hi',   label: 'Hindi',                  sub: 'HI' },
  { value: 'es',   label: 'Spanish',                sub: 'ES' },
  { value: 'fr',   label: 'French',                 sub: 'FR' },
  { value: 'de',   label: 'German',                 sub: 'DE' },
  { value: 'zh',   label: 'Chinese (Mandarin)',     sub: 'ZH' },
  { value: 'ja',   label: 'Japanese',               sub: 'JA' },
]

interface ConfigurationTabProps {
  sessionData: SessionConfigData
  onEdit: () => void
  onStart: (finalConfig: SessionConfigData) => void
}

export default function ConfigurationTab({ sessionData, onEdit, onStart }: ConfigurationTabProps) {
  const { settings, updateAI } = useSettings()
  const navigate = useNavigate()

  const [answerStyle, setAnswerStyle] = useState(sessionData.answerStyle || 'on-the-point')
  const [language, setLanguage]       = useState(sessionData.language || 'auto')
  const [autoAnswer, setAutoAnswer]   = useState(sessionData.autoAnswer ?? false)
  const [isStarting, setIsStarting]   = useState(false)

  const [showStyleDropdown, setShowStyleDropdown] = useState(false)
  const [showLangDropdown, setShowLangDropdown]   = useState(false)
  const [showManageModal, setShowManageModal]     = useState(false)
  const [customStyleText, setCustomStyleText]     = useState('')

  const selectedStyle = ANSWER_STYLES.find(s => s.id === answerStyle) || ANSWER_STYLES[0]
  const selectedLang  = LANGUAGES.find(l => l.value === language) || LANGUAGES[0]

  useEffect(() => {
    updateAI({ autoAnswer } as any)
  }, [autoAnswer])

  const handleStartInterview = async () => {
    setIsStarting(true)
    const finalConfig: SessionConfigData = {
      ...sessionData,
      answerStyle,
      language: selectedLang.label,
      autoAnswer,
      model: settings.ai.model || 'openai/gpt-oss-120b',
    }
    localStorage.setItem('ip_session_config', JSON.stringify(finalConfig))

    try {
      const r = ipc()
      if (r) {
        // Open stealth overlay in Electron
        await r.invoke('window:openOverlay').catch(() => {})
        r.send('shortcut:session-started')
      }
      onStart(finalConfig)
      // Navigate to /overlay if in browser or as active tab
      navigate('/overlay')
    } catch (e) {
      navigate('/overlay')
    } finally {
      setIsStarting(false)
    }
  }

  return (
    <div className="h-full flex flex-col overflow-hidden bg-surface-base text-white-90">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="px-8 pt-7 pb-4 shrink-0 border-b border-line-subtle">
        <h1 className="text-2xl font-bold text-white tracking-tight">Configuration</h1>
        <p className="text-xs text-white-40 mt-1 font-medium">Customize your interview experience.</p>
      </div>

      {/* ── Scrollable Body ─────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">

        {/* 1. Interview Summary Card */}
        <div className="rounded-2xl border border-line bg-surface-raised p-4 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3.5">
            {/* Briefcase Icon in Emerald Box */}
            <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">{sessionData.role || 'Software Eng'}</h2>
              <p className="text-xs text-white-50 font-medium">{sessionData.company || 'Company'}</p>
              {sessionData.resume ? (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-surface-strong border border-line-strong text-[10px] text-emerald-400 font-semibold mt-1">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  <span className="text-white-70">Resume</span>
                </div>
              ) : (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-surface-strong border border-line text-[10px] text-white-40 font-medium mt-1">
                  <span>No resume attached</span>
                </div>
              )}
            </div>
          </div>

          {/* Edit button */}
          <button
            id="cfg-edit-btn"
            onClick={onEdit}
            className="text-xs font-semibold text-white-60 hover:text-white px-3 py-1.5 rounded-lg hover:bg-surface-hover transition-colors"
          >
            Edit
          </button>
        </div>

        {/* 2. ANSWER STYLE */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="flex items-center gap-1.5 text-[10px] font-bold tracking-widest uppercase text-white-50">
              ANSWER STYLE
              <InfoTip text="Configure how the AI phrases answers during your interview." />
            </label>
            <button
              onClick={() => setShowManageModal(true)}
              className="flex items-center gap-1 text-[11px] font-medium text-white-50 hover:text-white-80 transition-colors"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
              Manage
            </button>
          </div>

          <div className="relative">
            <div
              id="cfg-style-selector"
              onClick={() => setShowStyleDropdown(v => !v)}
              className="rounded-2xl border border-line bg-surface-raised p-4 flex items-center justify-between cursor-pointer hover:border-line-strong transition-all"
            >
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-surface-strong flex items-center justify-center text-white-70 text-lg shrink-0">
                  {selectedStyle.icon}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">{selectedStyle.label}</span>
                    <span className="px-2 py-0.5 rounded bg-surface-strong border border-line text-[9px] font-bold text-white-60 tracking-wider">
                      {selectedStyle.badge}
                    </span>
                  </div>
                  <p className="text-xs text-white-50 mt-1 leading-relaxed max-w-xl">
                    {selectedStyle.desc}
                  </p>
                </div>
              </div>

              <div className="text-white-40 ml-4 shrink-0">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={`transition-transform duration-200 ${showStyleDropdown ? 'rotate-180' : ''}`}>
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </div>
            </div>

            {/* Style Dropdown Menu */}
            <AnimatePresence>
              {showStyleDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="absolute top-full left-0 right-0 mt-2 rounded-2xl border border-line-strong bg-surface-raised shadow-xl z-30 overflow-hidden py-1.5"
                >
                  {ANSWER_STYLES.map(style => (
                    <button
                      key={style.id}
                      onClick={() => { setAnswerStyle(style.id); setShowStyleDropdown(false) }}
                      className={`w-full px-4 py-3 text-left flex items-start gap-3 hover:bg-surface-hover transition-colors ${
                        answerStyle === style.id ? 'bg-surface-active/50' : ''
                      }`}
                    >
                      <span className="text-base shrink-0 mt-0.5">{style.icon}</span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-bold ${answerStyle === style.id ? 'text-emerald-400' : 'text-white'}`}>
                            {style.label}
                          </span>
                          <span className="px-1.5 py-0.2 rounded bg-surface-strong text-[9px] font-bold text-white-50">
                            {style.badge}
                          </span>
                        </div>
                        <p className="text-[11px] text-white-40 mt-0.5 leading-relaxed">{style.desc}</p>
                      </div>
                      {answerStyle === style.id && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2.5" className="shrink-0 mt-1">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      )}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* 3. INTERVIEW LANGUAGE & AUTO ANSWER (2 columns) */}
        <div className="grid grid-cols-2 gap-4">

          {/* Left: Interview Language */}
          <div>
            <label className="flex items-center gap-1.5 text-[10px] font-bold tracking-widest uppercase text-white-50 mb-2">
              INTERVIEW LANGUAGE
              <InfoTip text="Select spoken language for speech recognition and answers." />
            </label>

            <div className="relative">
              <div
                id="cfg-lang-selector"
                onClick={() => setShowLangDropdown(v => !v)}
                className="rounded-2xl border border-line bg-surface-raised p-4 flex items-center justify-between cursor-pointer hover:border-line-strong transition-all h-[88px]"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-surface-strong flex items-center justify-center text-white-70 text-lg shrink-0">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"/>
                      <line x1="2" y1="12" x2="22" y2="12"/>
                      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-white">{selectedLang.label}</h3>
                    <p className="text-[10px] font-mono text-white-40 font-semibold tracking-wider mt-0.5">{selectedLang.sub}</p>
                  </div>
                </div>

                <div className="text-white-40 shrink-0">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={`transition-transform duration-200 ${showLangDropdown ? 'rotate-180' : ''}`}>
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </div>
              </div>

              {/* Language Dropdown */}
              <AnimatePresence>
                {showLangDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="absolute top-full left-0 right-0 mt-2 rounded-2xl border border-line-strong bg-surface-raised shadow-xl z-30 max-h-56 overflow-y-auto py-1.5"
                  >
                    {LANGUAGES.map(lang => (
                      <button
                        key={lang.value}
                        onClick={() => { setLanguage(lang.value); setShowLangDropdown(false) }}
                        className={`w-full px-4 py-2 text-left flex items-center justify-between hover:bg-surface-hover transition-colors ${
                          language === lang.value ? 'text-emerald-400 font-bold bg-surface-active/40' : 'text-white-80 text-xs'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xs">{lang.label}</span>
                          <span className="text-[9px] font-mono text-white-40">{lang.sub}</span>
                        </div>
                        {language === lang.value && (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                        )}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Right: Auto Answer */}
          <div>
            <label className="flex items-center gap-1.5 text-[10px] font-bold tracking-widest uppercase text-white-50 mb-2">
              AUTO ANSWER
              <InfoTip text="When enabled, speech recognition automatically triggers AI answers." />
            </label>

            <div
              id="cfg-auto-answer-toggle"
              onClick={() => setAutoAnswer(v => !v)}
              className="rounded-2xl border border-line bg-surface-raised p-4 flex items-center justify-between cursor-pointer hover:border-line-strong transition-all h-[88px]"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-surface-strong flex items-center justify-center text-white-70 text-lg shrink-0">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill={autoAnswer ? '#34d399' : 'none'} stroke={autoAnswer ? '#34d399' : 'currentColor'} strokeWidth="2">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                  </svg>
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white">{autoAnswer ? 'On' : 'Off'}</h3>
                  <p className="text-[10px] text-white-40 mt-0.5">
                    {autoAnswer ? 'AI responds automatically' : 'You ask when you need to'}
                  </p>
                </div>
              </div>

              {/* iOS-style Switch Slider */}
              <div className={`w-11 h-6 rounded-full transition-colors flex items-center p-0.5 shrink-0 ${
                autoAnswer ? 'bg-emerald-500' : 'bg-surface-strong border border-line'
              }`}>
                <motion.div
                  className="w-5 h-5 rounded-full bg-white shadow-sm"
                  animate={{ x: autoAnswer ? 20 : 0 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* 4. Session Info Card */}
        <div className="rounded-2xl border border-line bg-surface-raised p-4 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white">Free session</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 font-semibold font-mono">10 min</span>
              </div>
              <p className="text-[10px] text-white-40 mt-0.5">
                4 sessions remaining today · 30 minute gap between sessions.
              </p>
            </div>
          </div>

          <button className="text-white-30 hover:text-white-70 p-1.5 rounded-lg hover:bg-surface-hover transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/>
            </svg>
          </button>
        </div>

      </div>

      {/* ── Footer — Start Interview ─────────────────────────────────── */}
      <div className="px-8 py-5 border-t border-line-subtle shrink-0 flex justify-end">
        <button
          id="cfg-start-interview-btn"
          onClick={handleStartInterview}
          disabled={isStarting}
          className="flex items-center gap-2.5 px-8 py-3 rounded-xl bg-white hover:bg-white/90 text-surface-base text-sm font-bold shadow-lg hover:shadow-xl transition-all"
        >
          {isStarting ? (
            <>
              <div className="w-4 h-4 rounded-full border-2 border-surface-base border-t-transparent animate-spin" />
              Launching Live Interview…
            </>
          ) : (
            'Start Interview'
          )}
        </button>
      </div>

      {/* ── Manage Style Modal ────────────────────────────────────────── */}
      {showManageModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-surface-raised border border-line-strong rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-white">Manage Answer Styles</h3>
              <button onClick={() => setShowManageModal(false)} className="text-white-40 hover:text-white">✕</button>
            </div>
            <p className="text-xs text-white-50 mb-3">Add custom guidance for how InterviewPilot formats AI responses during interview sessions.</p>
            <textarea
              value={customStyleText}
              onChange={e => setCustomStyleText(e.target.value)}
              placeholder="e.g. Always include time/space complexity analysis at the end of the answer..."
              rows={4}
              className="w-full rounded-xl border border-line bg-surface-sunken p-3 text-xs text-white placeholder:text-white-30 focus:outline-none focus:border-emerald-500/70 resize-none"
            />
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowManageModal(false)} className="px-4 py-2 rounded-xl text-xs text-white-60 hover:text-white">Cancel</button>
              <button
                onClick={() => {
                  if (customStyleText.trim()) {
                    localStorage.setItem('ip_custom_style_prompt', customStyleText.trim())
                  }
                  setShowManageModal(false)
                }}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white"
              >
                Save Style
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function InfoTip({ text }: { text: string }) {
  const [show, setShow] = useState(false)
  return (
    <span className="relative inline-flex items-center">
      <button
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        className="w-3.5 h-3.5 rounded-full border border-white-30 flex items-center justify-center text-white-40 hover:text-white-70 text-[9px] font-bold transition-colors"
        tabIndex={-1}
      >i</button>
      {show && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-48 text-[10px] text-white-70 bg-surface-strong border border-line rounded-lg px-2.5 py-1.5 z-50 leading-relaxed shadow-lg">
          {text}
        </span>
      )}
    </span>
  )
}
