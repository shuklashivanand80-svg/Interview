/**
 * Dashboard — InterviewPilot Clone
 *
 * Implements:
 *  - Screen 1: New Interview (CreateSessionTab)
 *  - Screen 2: Configuration (ConfigurationTab)
 *  - Screen 3: Live Interview trigger -> /overlay
 *  - Left rail with exact aesthetics from Screenshots 1 & 2
 */
import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../store/auth'
import CreateSessionTab from './dashboard/CreateSessionTab'
import ConfigurationTab, { SessionConfigData } from './dashboard/ConfigurationTab'
import HistoryTab from './dashboard/HistoryTab'
import SettingsView from './dashboard/SettingsView'

type DashTab = 'new-interview' | 'configuration' | 'history' | 'settings'

const ipc = () => (window as any).electron?.ipcRenderer ?? null

export default function Dashboard() {
  const { user, logout, isAuthenticated } = useAuth()
  const navigate = useNavigate()

  // Load existing session data or default
  const [sessionData, setSessionData] = useState<SessionConfigData>(() => {
    try {
      const saved = localStorage.getItem('ip_session_config')
      if (saved) return JSON.parse(saved)
    } catch {}
    return {
      company: '',
      role: '',
      jd: '',
      resume: null,
      brief: null,
      answerStyle: 'on-the-point',
      language: 'auto',
      autoAnswer: false,
    }
  })

  // Start on new-interview
  const [activeTab, setActiveTab] = useState<DashTab>('new-interview')

  const minimize = () => ipc()?.send('window:minimize')
  const maximize = () => ipc()?.send('window:maximize')
  const close    = () => ipc()?.send('window:close')

  const handleContinueToConfig = (data: SessionConfigData) => {
    setSessionData(data)
    localStorage.setItem('ip_session_config', JSON.stringify(data))
    setActiveTab('configuration')
  }

  const handleBackToNewInterview = () => {
    setActiveTab('new-interview')
  }

  const handleStartInterview = (finalConfig: SessionConfigData) => {
    setSessionData(finalConfig)
    localStorage.setItem('ip_session_config', JSON.stringify(finalConfig))
    const r = ipc()
    if (r) {
      r.invoke('window:openOverlay').catch(() => {})
    } else {
      navigate('/overlay')
    }
  }

  return (
    <div className="flex h-screen w-screen bg-surface-base text-white-90 overflow-hidden select-none">

      {/* ── Side Rail (matches Screenshots 1 & 2) ───────────────────── */}
      <nav className="w-14 flex flex-col items-center py-3.5 gap-2 bg-surface-rail border-r border-line-subtle shrink-0 z-10">
        {/* Top Logo / Icon */}
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-500 flex items-center justify-center mb-1 shadow-md shrink-0">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-white">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
          </svg>
        </div>

        {/* New Interview / Active Session — + Icon */}
        <RailBtn
          id="nav-new-interview"
          title="New Interview"
          active={activeTab === 'new-interview' || activeTab === 'configuration'}
          onClick={() => setActiveTab('new-interview')}
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9"/>
              <line x1="12" y1="8" x2="12" y2="16"/>
              <line x1="8" y1="12" x2="16" y2="12"/>
            </svg>
          }
        />

        {/* History — Clock icon */}
        <RailBtn
          id="nav-history"
          title="History"
          active={activeTab === 'history'}
          onClick={() => setActiveTab('history')}
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9"/>
              <polyline points="12 7 12 12 15 14"/>
            </svg>
          }
        />

        <div className="flex-1" />

        {/* User Avatar Circle — Green Ring with 'S' matching Screenshot 1 */}
        <div className="mb-1">
          <button
            onClick={() => isAuthenticated ? logout() : navigate('/login')}
            title={isAuthenticated ? `${user.email} (click to sign out)` : 'Sign in / Account'}
            className="w-8 h-8 rounded-full border-2 border-emerald-500 bg-surface-strong flex items-center justify-center text-xs font-bold text-emerald-400 hover:ring-2 hover:ring-emerald-400/50 transition-all shrink-0 shadow-sm"
          >
            {(user?.name?.[0] || user?.email?.[0] || 'S').toUpperCase()}
          </button>
        </div>

        {/* Settings Gear */}
        <RailBtn
          id="nav-settings"
          title="Settings"
          active={activeTab === 'settings'}
          onClick={() => setActiveTab('settings')}
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          }
        />
      </nav>

      {/* ── Main Content Area ───────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Title / Drag bar */}
        <div className="drag h-9 flex items-center px-4 border-b border-line-subtle shrink-0 bg-surface-sunken justify-between">
          <div className="flex items-center gap-2 no-drag">
            <div className="w-3.5 h-3.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            </div>
            <span className="text-xs text-white-50 font-semibold select-none">InterviewPilot</span>
          </div>

          <div className="flex items-center gap-1 no-drag">
            <button
              onClick={minimize}
              title="Minimize"
              className="w-7 h-6 rounded flex items-center justify-center text-white-40 hover:text-white hover:bg-surface-hover transition-colors"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </button>
            <button
              onClick={maximize}
              title="Maximize"
              className="w-7 h-6 rounded flex items-center justify-center text-white-40 hover:text-white hover:bg-surface-hover transition-colors"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="4" width="16" height="16" rx="1"/></svg>
            </button>
            <button
              onClick={close}
              title="Close"
              className="w-7 h-6 rounded flex items-center justify-center text-white-40 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>

        {/* Dynamic Tab Body */}
        <div className="flex-1 overflow-hidden">
          <AnimatePresence mode="wait">
            {activeTab === 'new-interview' && (
              <motion.div
                key="new-interview"
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.12 }}
                className="h-full"
              >
                <CreateSessionTab
                  initialData={sessionData}
                  onContinue={handleContinueToConfig}
                />
              </motion.div>
            )}

            {activeTab === 'configuration' && (
              <motion.div
                key="configuration"
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.12 }}
                className="h-full"
              >
                <ConfigurationTab
                  sessionData={sessionData}
                  onEdit={handleBackToNewInterview}
                  onStart={handleStartInterview}
                />
              </motion.div>
            )}

            {activeTab === 'history' && (
              <motion.div
                key="history"
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.12 }}
                className="h-full"
              >
                <HistoryTab />
              </motion.div>
            )}

            {activeTab === 'settings' && (
              <motion.div
                key="settings"
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.12 }}
                className="h-full"
              >
                <SettingsView />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

function RailBtn({ id, title, icon, active, onClick }: {
  id: string; title: string; icon: React.ReactNode; active: boolean; onClick: () => void
}) {
  return (
    <button
      id={id}
      onClick={onClick}
      title={title}
      className={`relative w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
        active
          ? 'bg-surface-active text-emerald-400'
          : 'text-white-40 hover:text-white-80 hover:bg-surface-hover'
      }`}
    >
      {active && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-emerald-500 rounded-r-full shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
      )}
      {icon}
    </button>
  )
}
