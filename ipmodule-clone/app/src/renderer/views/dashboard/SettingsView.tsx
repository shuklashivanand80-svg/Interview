/**
 * ConfigurationView — "Configuration" screen
 * Matches Screenshot A from the original InterviewPilot application.
 *
 * Sections visible in screenshot:
 *  - Resume profile card (name, username, Resume badge, Edit button)
 *  - Answer Style selector with BUILT-IN badge + Manage link
 *  - Interview Language dropdown
 *  - Auto Answer toggle
 *  - Session info card (Free session / 10 min, ...)
 *
 * Additional sections (not visible in cropped screenshot but exist in original):
 *  - STT / Speech settings
 *  - Keybinds reference
 *  - About / version
 */
import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSettings, AI_MODELS } from '../../store/settings'
import { useTheme } from '../../store/theme'
import { useAuth } from '../../store/auth'

const ipc = () => (window as any).electron?.ipcRenderer ?? null

// ── Answer styles (from original app strings) ─────────────────────────────────
const ANSWER_STYLES = [
  {
    id: 'on-the-point',
    label: 'On the point',
    badge: 'BUILT-IN',
    desc: 'Sounds like a real person — simple English, natural filler words, first person, bullet-pointed answers.',
    icon: '⚡',
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
]

// ── Interview language options ─────────────────────────────────────────────────
const LANGUAGES = [
  { value: 'auto', label: 'Auto (English + Hindi)', sub: 'AUTO' },
  { value: 'en',   label: 'English',                sub: 'EN' },
  { value: 'hi',   label: 'Hindi',                  sub: 'HI' },
  { value: 'es',   label: 'Spanish',                sub: 'ES' },
  { value: 'fr',   label: 'French',                 sub: 'FR' },
  { value: 'de',   label: 'German',                 sub: 'DE' },
  { value: 'zh',   label: 'Chinese (Mandarin)',      sub: 'ZH' },
  { value: 'ja',   label: 'Japanese',               sub: 'JA' },
  { value: 'pt',   label: 'Portuguese',             sub: 'PT' },
  { value: 'ar',   label: 'Arabic',                 sub: 'AR' },
  { value: 'ru',   label: 'Russian',                sub: 'RU' },
]

const SHORTCUTS = [
  { action: 'Hide / show overlay',        key: 'Ctrl+Alt+H' },
  { action: 'Toggle context visibility',  key: 'Ctrl+M' },
  { action: 'Submit message',             key: 'Ctrl+Enter' },
  { action: 'Analyse screen',            key: 'Ctrl+Shift+Enter' },
  { action: 'Auto-answer toggle',         key: 'Ctrl+Shift+A' },
  { action: 'Regenerate response',        key: 'Ctrl+Shift+R' },
  { action: 'New chat',                   key: 'Ctrl+Shift+N' },
  { action: 'Concise mode',             key: 'Ctrl+1' },
  { action: 'Explain mode',             key: 'Ctrl+2' },
  { action: 'Story / STAR mode',        key: 'Ctrl+3' },
  { action: 'Move overlay left',        key: 'Ctrl+Alt+←' },
  { action: 'Move overlay right',       key: 'Ctrl+Alt+→' },
  { action: 'Move overlay up',          key: 'Ctrl+Alt+↑' },
  { action: 'Move overlay down',        key: 'Ctrl+Alt+↓' },
]

type Tab = 'config' | 'ai' | 'stt' | 'keybinds' | 'about'

export default function SettingsView() {
  const [tab, setTab] = useState<Tab>('config')
  const { settings, updateAI, updateSTT, updateOverlay, resetSettings } = useSettings()
  const { preference, setTheme } = useTheme()
  const { user, isAuthenticated, logout } = useAuth()
  const navigate = useNavigate()

  // Config-tab local state
  const [answerStyle,  setAnswerStyle]  = useState('on-the-point')
  const [language,     setLanguage]     = useState('auto')
  const [autoAnswer,   setAutoAnswer]   = useState(false)
  const [showStyleMgr, setShowStyleMgr] = useState(false)
  const [profileName,  setProfileName]  = useState(user?.name || 'Software Eng')
  const [profileUser,  setProfileUser]  = useState(user?.email?.split('@')[0] || 'cagi')
  const [hasResume,    setHasResume]    = useState(false)
  const [editingProfile, setEditingProfile] = useState(false)

  // Persist auto-answer to settings
  useEffect(() => {
    updateAI({ autoAnswer } as any)
  }, [autoAnswer])

  const selectedStyle = ANSWER_STYLES.find(s => s.id === answerStyle) || ANSWER_STYLES[0]
  const selectedLang  = LANGUAGES.find(l => l.value === language) || LANGUAGES[0]

  const TABS: { id: Tab; label: string }[] = [
    { id: 'config',   label: 'Configuration' },
    { id: 'ai',       label: 'AI Models' },
    { id: 'stt',      label: 'Speech (STT)' },
    { id: 'keybinds', label: 'Keybinds' },
    { id: 'about',    label: 'About' },
  ]

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Left sidebar ─────────────────────────────────────────────── */}
      <nav className="w-36 shrink-0 border-r border-line-subtle p-2 space-y-0.5 overflow-y-auto">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`w-full text-left px-2.5 py-2 rounded-lg text-xs font-medium transition-colors ${
              tab === t.id ? 'bg-violet-500/15 text-violet-300' : 'text-white-50 hover:text-white-70 hover:bg-surface-hover'
            }`}>
            {t.label}
          </button>
        ))}
      </nav>

      {/* ── Main content ─────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">

        {/* ══ CONFIGURATION tab ══════════════════════════════════════ */}
        {tab === 'config' && (
          <div className="p-5 space-y-5">
            <div>
              <h2 className="text-xl font-bold text-white-90" style={{ fontStyle: 'italic' }}>Configuration</h2>
              <p className="text-xs text-white-50 mt-0.5">Customize your interview experience.</p>
            </div>

            {/* Resume Profile Card */}
            <div className="rounded-xl border border-line bg-surface-raised p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-violet-500 to-emerald-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
                {profileName[0]?.toUpperCase() || 'S'}
              </div>
              <div className="flex-1 min-w-0">
                {editingProfile ? (
                  <div className="space-y-1">
                    <input value={profileName} onChange={e => setProfileName(e.target.value)}
                      className="w-full text-sm font-semibold text-white-90 bg-transparent border-b border-violet-500/50 focus:outline-none"
                      placeholder="Name" />
                    <input value={profileUser} onChange={e => setProfileUser(e.target.value)}
                      className="w-full text-xs text-white-50 bg-transparent border-b border-violet-500/30 focus:outline-none"
                      placeholder="Username" />
                  </div>
                ) : (
                  <>
                    <p className="text-sm font-semibold text-white-90 truncate">{profileName}</p>
                    <p className="text-xs text-white-50">{profileUser}</p>
                  </>
                )}
                <div className="flex items-center gap-2 mt-1.5">
                  {hasResume ? (
                    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-medium">
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                      Resume
                    </span>
                  ) : (
                    <button onClick={() => setHasResume(true)}
                      className="text-[10px] text-white-40 hover:text-violet-400 transition-colors">
                      + Add Resume
                    </button>
                  )}
                </div>
              </div>
              <button
                onClick={() => setEditingProfile(e => { if (e) { /* save */ } return !e })}
                className="text-xs text-white-50 hover:text-white-80 transition-colors shrink-0 px-2 py-1 rounded-lg hover:bg-surface-hover"
              >
                {editingProfile ? 'Save' : 'Edit'}
              </button>
            </div>

            {/* Answer Style */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="flex items-center gap-2 text-[10px] font-bold tracking-widest uppercase text-white-60">
                  ANSWER STYLE
                  <InfoTip text="Defines how the AI structures and phrases its answers." />
                </label>
                <button onClick={() => setShowStyleMgr(s => !s)}
                  className="text-[10px] text-white-40 hover:text-violet-400 flex items-center gap-1 transition-colors">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>
                  Manage
                </button>
              </div>

              <div className="rounded-xl border border-line bg-surface-raised px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="text-base">{selectedStyle.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-semibold text-white-90">{selectedStyle.label}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-700 text-white-50 font-bold tracking-wider">{selectedStyle.badge}</span>
                    </div>
                    <p className="text-xs text-white-40 leading-relaxed">{selectedStyle.desc}</p>
                  </div>
                  {/* Dropdown chevron */}
                  <button onClick={() => setShowStyleMgr(s => !s)}
                    className="w-6 h-6 flex items-center justify-center text-white-40 hover:text-white-70 transition-colors">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points={showStyleMgr ? '18 15 12 9 6 15' : '6 9 12 15 18 9'}/>
                    </svg>
                  </button>
                </div>

                {showStyleMgr && (
                  <div className="mt-3 pt-3 border-t border-line-subtle space-y-1.5">
                    {ANSWER_STYLES.map(s => (
                      <button key={s.id} onClick={() => { setAnswerStyle(s.id); setShowStyleMgr(false) }}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                          answerStyle === s.id ? 'bg-violet-500/15 border border-violet-500/30' : 'hover:bg-surface-hover border border-transparent'
                        }`}>
                        <span>{s.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-white-80">{s.label}</span>
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-700 text-white-50">{s.badge}</span>
                          </div>
                          <p className="text-[10px] text-white-40 truncate">{s.desc}</p>
                        </div>
                        {answerStyle === s.id && (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-violet-400 shrink-0">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Interview Language + Auto Answer */}
            <div className="grid grid-cols-2 gap-4">
              {/* Interview Language */}
              <div>
                <label className="flex items-center gap-2 text-[10px] font-bold tracking-widest uppercase text-white-60 mb-2">
                  INTERVIEW LANGUAGE
                  <InfoTip text="The language the AI will use for answers." />
                </label>
                <div className="relative">
                  <div className="rounded-xl border border-line bg-surface-raised px-3 py-2.5 flex items-center gap-2.5 cursor-pointer">
                    <div className="w-6 h-6 rounded-full bg-emerald-600 flex items-center justify-center shrink-0">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                    </div>
                    <div className="flex-1">
                      <select value={language} onChange={e => setLanguage(e.target.value)}
                        className="w-full bg-transparent text-sm font-medium text-white-90 focus:outline-none appearance-none cursor-pointer">
                        {LANGUAGES.map(l => (
                          <option key={l.value} value={l.value}>{l.label}</option>
                        ))}
                      </select>
                      <p className="text-[10px] text-white-40 -mt-0.5">{selectedLang.sub}</p>
                    </div>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white-40 shrink-0">
                      <polyline points="6 9 12 15 18 9"/>
                    </svg>
                  </div>
                </div>
              </div>

              {/* Auto Answer */}
              <div>
                <label className="flex items-center gap-2 text-[10px] font-bold tracking-widest uppercase text-white-60 mb-2">
                  AUTO ANSWER
                  <InfoTip text="When on, the AI automatically answers every detected question." />
                </label>
                <div className="rounded-xl border border-line bg-surface-raised px-3 py-2.5 flex items-center gap-2.5">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${autoAnswer ? 'bg-emerald-600' : 'bg-surface-strong'}`}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" className={autoAnswer ? 'text-white' : 'text-white-40'}>
                      <path d="M13 3L4 14h7l-2 7 9-11h-7l2-7z"/>
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white-90">{autoAnswer ? 'On' : 'Off'}</p>
                    <p className="text-[10px] text-white-40">{autoAnswer ? 'AI answers automatically' : 'You ask when you need to'}</p>
                  </div>
                  {/* Toggle */}
                  <button
                    id="auto-answer-toggle"
                    onClick={() => setAutoAnswer(v => !v)}
                    className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${autoAnswer ? 'bg-emerald-500' : 'bg-surface-strong'}`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${autoAnswer ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </button>
                </div>
              </div>
            </div>

            {/* Session info card */}
            <div className="rounded-xl border border-line bg-surface-raised px-4 py-3 flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg bg-violet-600/30 flex items-center justify-center shrink-0">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-violet-400">
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-xs font-semibold text-white-80">Free session · 10 min</p>
                <p className="text-[10px] text-white-40">10 minutes gap between sessions</p>
              </div>
              <button className="w-6 h-6 rounded flex items-center justify-center text-white-30 hover:text-white-60 transition-colors">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/>
                </svg>
              </button>
            </div>

            {/* Theme */}
            <div>
              <label className="block text-[10px] font-bold tracking-widest uppercase text-white-60 mb-2">APPEARANCE</label>
              <div className="flex gap-2">
                {(['dark', 'light', 'system'] as const).map(t => (
                  <button key={t} onClick={() => setTheme(t)}
                    className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-all capitalize ${
                      preference === t ? 'border-violet-500 bg-violet-500/10 text-violet-300' : 'border-line text-white-50 hover:text-white-70'
                    }`}>{t}</button>
                ))}
              </div>
            </div>

            {/* Overlay opacity */}
            <div>
              <label className="block text-[10px] font-bold tracking-widest uppercase text-white-60 mb-2">
                OVERLAY OPACITY — {Math.round(settings.overlay.opacity * 100)}%
              </label>
              <input type="range" min="0.3" max="1" step="0.05"
                value={settings.overlay.opacity}
                onChange={e => updateOverlay({ opacity: parseFloat(e.target.value) })}
                className="w-full accent-violet-500" />
            </div>

            {/* Reset */}
            <button onClick={() => { resetSettings(); alert('Settings reset to defaults.') }}
              className="text-xs px-3 py-1.5 rounded-lg border border-line hover:border-red-500/50 hover:bg-red-500/8 text-white-50 hover:text-red-400 transition-all">
              Reset to defaults
            </button>
          </div>
        )}

        {/* ══ AI MODELS tab ══════════════════════════════════════════ */}
        {tab === 'ai' && (
          <div className="p-5 space-y-6">
            <h2 className="text-sm font-semibold text-white-70 uppercase tracking-wider">AI Models</h2>

            <div>
              <label className="block text-[10px] font-bold tracking-widest uppercase text-white-60 mb-2">DEFAULT AI MODEL</label>
              <select value={settings.ai.model} onChange={e => updateAI({ model: e.target.value })}
                className="w-full rounded-lg border border-line bg-surface-raised px-3 py-2.5 text-sm text-white-90 focus:outline-none focus:border-violet-500 appearance-none">
                <optgroup label="── Free tier ──">
                  {AI_MODELS.filter(m => m.tier === 'free').map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </optgroup>
                <optgroup label="── Pro ──">
                  {AI_MODELS.filter(m => m.tier === 'pro').map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </optgroup>
                <optgroup label="── Premium ──">
                  {AI_MODELS.filter(m => m.tier === 'premium').map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </optgroup>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold tracking-widest uppercase text-white-60 mb-2">YOUR API KEY (OPTIONAL)</label>
              <input type="password" placeholder="sk-... or provider key"
                value={settings.ai.apiKey || ''}
                onChange={e => updateAI({ apiKey: e.target.value })}
                className="w-full rounded-lg border border-line bg-surface-sunken px-3 py-2.5 text-sm text-white-90 placeholder:text-white-30 focus:outline-none focus:border-violet-500" />
              <p className="text-[10px] text-amber-400/80 mt-1">Keys are stored only on this device. Never shared.</p>
            </div>

            <div>
              <label className="block text-[10px] font-bold tracking-widest uppercase text-white-60 mb-2">DEFAULT RESPONSE MODE</label>
              <div className="flex gap-2">
                {(['concise', 'explain', 'story'] as const).map(m => (
                  <button key={m} onClick={() => updateAI({ defaultResponseMode: m })}
                    className={`flex-1 py-2 rounded-lg text-xs font-medium border capitalize transition-all ${
                      settings.ai.defaultResponseMode === m ? 'border-violet-500 bg-violet-500/10 text-violet-300' : 'border-line text-white-50 hover:text-white-70'
                    }`}>{m}</button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ══ STT tab ════════════════════════════════════════════════ */}
        {tab === 'stt' && (
          <div className="p-5 space-y-6">
            <h2 className="text-sm font-semibold text-white-70 uppercase tracking-wider">Speech to Text</h2>

            <div>
              <label className="block text-[10px] font-bold tracking-widest uppercase text-white-60 mb-2">PROVIDER</label>
              <div className="flex gap-2">
                {([
                  { id: 'browser',  label: 'Browser STT',  note: 'Free. Chrome/Edge. No key.' },
                  { id: 'deepgram', label: 'Deepgram',     note: 'High accuracy. API key required.' },
                  { id: 'mock',     label: 'Demo Mode',    note: 'Simulated. No mic needed.' },
                ]).map(p => (
                  <button key={p.id} onClick={() => updateSTT({ provider: p.id as any })} title={p.note}
                    className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-all ${
                      settings.stt?.provider === p.id ? 'border-violet-500 bg-violet-500/10 text-violet-300' : 'border-line text-white-50 hover:text-white-70'
                    }`}>{p.label}</button>
                ))}
              </div>
              <p className="text-[10px] text-white-30 mt-1.5">
                {settings.stt?.provider === 'browser'  && 'Uses Web Speech API — free, no account. Chrome and Edge only.'}
                {settings.stt?.provider === 'deepgram' && 'Real-time Deepgram transcription. Get a free API key at deepgram.com.'}
                {settings.stt?.provider === 'mock'     && '⚠️ Simulates transcription with example questions. Not real speech recognition.'}
              </p>
            </div>

            {settings.stt?.provider === 'deepgram' && (
              <div>
                <label className="block text-[10px] font-bold tracking-widest uppercase text-white-60 mb-2">DEEPGRAM API KEY</label>
                <input type="password" placeholder="Your Deepgram API key"
                  value={settings.stt?.apiKey || ''}
                  onChange={e => updateSTT({ apiKey: e.target.value })}
                  className="w-full rounded-lg border border-line bg-surface-sunken px-3 py-2.5 text-sm text-white-90 placeholder:text-white-30 focus:outline-none focus:border-violet-500" />
                <p className="text-[10px] text-white-30 mt-1">
                  Get a free key at{' '}
                  <button onClick={() => ipc()?.invoke('system:openExternal', 'https://deepgram.com')} className="text-violet-400 hover:text-violet-300">deepgram.com</button>
                </p>
              </div>
            )}

            <div>
              <label className="block text-[10px] font-bold tracking-widest uppercase text-white-60 mb-2">LANGUAGE</label>
              <select value={settings.stt?.language || 'en-US'} onChange={e => updateSTT({ language: e.target.value })}
                className="w-full rounded-lg border border-line bg-surface-raised px-3 py-2.5 text-sm text-white-90 focus:outline-none focus:border-violet-500 appearance-none">
                {[['en-US','English (US)'],['en-GB','English (UK)'],['hi-IN','Hindi'],['es-ES','Spanish'],['fr-FR','French'],['de-DE','German'],['zh-CN','Chinese'],['ja-JP','Japanese']].map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* ══ KEYBINDS tab ═══════════════════════════════════════════ */}
        {tab === 'keybinds' && (
          <div className="p-5">
            <h2 className="text-sm font-semibold text-white-70 uppercase tracking-wider mb-4">Keyboard Shortcuts</h2>
            <p className="text-xs text-white-40 mb-4">Global shortcuts — active during overlay sessions (Electron build only).</p>
            <div className="space-y-0.5">
              {SHORTCUTS.map(s => (
                <div key={s.action} className="flex items-center justify-between py-2.5 border-b border-line-subtle last:border-0">
                  <span className="text-sm text-white-70">{s.action}</span>
                  <kbd className="text-xs bg-surface-raised border border-line rounded-md px-2 py-1 font-mono text-white-50">{s.key}</kbd>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══ ABOUT tab ══════════════════════════════════════════════ */}
        {tab === 'about' && (
          <div className="p-5 space-y-4">
            <h2 className="text-sm font-semibold text-white-70 uppercase tracking-wider">About</h2>

            <div className="flex items-center gap-3 p-4 bg-surface-raised rounded-xl border border-line">
              <img src="/logo.png" alt="logo" className="w-12 h-12 rounded-xl" onError={e => (e.currentTarget.style.display = 'none')} />
              <div>
                <h3 className="text-sm font-semibold text-white-90">InterviewPilot Clone</h3>
                <p className="text-xs text-white-50 mt-0.5">v1.5.0 — Reconstructed from original app.asar</p>
              </div>
            </div>

            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-xs text-emerald-300/80 space-y-1">
              <p className="font-medium text-emerald-400">Local Features — Free Forever</p>
              <p>• No session timer, no 10-minute limit, no daily session cap</p>
              <p>• No account required to start, use, or restart the app</p>
              <p>• All settings persist across restarts</p>
            </div>

            <div className="text-xs text-white-50 space-y-1.5">
              <p>Original application: InterviewPilot v1.5.0 by interviewpilot.in</p>
              <p>Cloud AI: <code className="text-violet-400">api.interviewpilot.in</code> (requires account/key)</p>
              <p>Local AI demo: built-in offline fallback (no external call)</p>
            </div>

            <div className="flex gap-2 flex-wrap">
              <button onClick={() => ipc()?.invoke('system:openExternal', 'https://www.interviewpilot.in')}
                className="text-xs px-3 py-1.5 rounded-lg border border-line text-white-50 hover:text-white-70 transition-colors">
                interviewpilot.in
              </button>
              <button onClick={() => ipc()?.invoke('system:openExternal', 'https://deepgram.com')}
                className="text-xs px-3 py-1.5 rounded-lg border border-line text-white-50 hover:text-white-70 transition-colors">
                Get Deepgram key
              </button>
            </div>

            {/* Auth section */}
            {isAuthenticated ? (
              <div className="p-4 bg-surface-raised rounded-xl border border-line">
                <p className="text-sm font-semibold text-white-90">{user.name}</p>
                <p className="text-xs text-white-50">{user.email}</p>
                <button onClick={logout} className="mt-2 text-xs px-3 py-1.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/8 transition-colors">Sign Out</button>
              </div>
            ) : (
              <button onClick={() => navigate('/login')}
                className="text-xs px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white transition-colors">
                Sign In / Create Account (optional)
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function InfoTip({ text }: { text: string }) {
  const [show, setShow] = useState(false)
  return (
    <span className="relative">
      <button
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        className="w-3.5 h-3.5 rounded-full border border-white-30 flex items-center justify-center text-white-40 hover:text-white-70 text-[9px] font-bold transition-colors"
        tabIndex={-1}
      >i</button>
      {show && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-44 text-[10px] text-white-70 bg-surface-strong border border-line rounded-lg px-2 py-1.5 z-50 leading-relaxed shadow-lg">
          {text}
        </span>
      )}
    </span>
  )
}
