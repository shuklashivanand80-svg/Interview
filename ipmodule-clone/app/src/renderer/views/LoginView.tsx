/**
 * LoginView — InterviewPilot Clone
 *
 * This page is OPTIONAL and never shown automatically.
 * All local features work without signing in.
 * "Continue without account" is the primary CTA.
 */
import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../store/auth'
import { motion, AnimatePresence } from 'framer-motion'

type Tab = 'login' | 'register'
interface Props { defaultTab?: Tab }

export default function LoginView({ defaultTab = 'login' }: Props) {
  const { login, register, continueAsGuest, isLoading, error, clearError } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>(defaultTab)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [localError, setLocalError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLocalError('')
    clearError()
    try {
      if (tab === 'login') {
        await login(email, password)
      } else {
        if (!name.trim()) { setLocalError('Name is required'); return }
        await register(email, password, name)
      }
      navigate('/', { replace: true })
    } catch (err: any) {
      setLocalError(err.message || 'Authentication failed')
    }
  }

  const handleContinueLocal = () => {
    continueAsGuest()
    navigate('/', { replace: true })
  }

  const displayError = localError || error

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-surface-base relative overflow-hidden">
      {/* Background glows */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full bg-violet-600/10 blur-3xl" />
        <div className="absolute bottom-1/4 left-1/3 w-64 h-64 rounded-full bg-emerald-600/8 blur-3xl" />
      </div>

      {/* Title bar drag region */}
      <div className="drag absolute top-0 left-0 right-0 h-8" />

      {/* Back arrow */}
      <button onClick={() => navigate('/')}
        className="no-drag absolute top-3 left-3 flex items-center gap-1.5 text-xs text-white-40 hover:text-white-70 transition-colors">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
        Back to app
      </button>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="relative z-10 w-full max-w-sm mx-4"
      >
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-emerald-500 flex items-center justify-center mb-3 shadow-lg">
            <img src="/logo.svg" alt="logo" className="w-7 h-7"
              onError={e => (e.currentTarget.style.display = 'none')} />
          </div>
          <h1 className="text-xl font-semibold text-white-90">InterviewPilot</h1>
          <p className="text-sm text-white-50 mt-1">AI interview assistant</p>
        </div>

        {/* PRIMARY CTA — continue without account */}
        <button onClick={handleContinueLocal}
          className="no-drag w-full mb-5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/18 px-4 py-3.5 text-sm font-semibold text-emerald-400 transition-all flex items-center justify-center gap-2 shadow-sm">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
          Use locally — no account needed
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="flex-1 h-px bg-line" />
          <span className="text-[11px] text-white-30">or sign in for cloud AI</span>
          <div className="flex-1 h-px bg-line" />
        </div>

        {/* Sign in / register card */}
        <div className="rounded-2xl border border-line bg-surface-raised shadow-[var(--shadow-popover)] overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-line">
            {(['login', 'register'] as Tab[]).map(t => (
              <button key={t} onClick={() => { setTab(t); setLocalError(''); clearError() }}
                className={`flex-1 py-3 text-sm font-medium transition-colors no-drag ${
                  tab === t
                    ? 'text-white-90 border-b-2 border-violet-500 -mb-px'
                    : 'text-white-50 hover:text-white-70'
                }`}>
                {t === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4 no-drag">
            <AnimatePresence mode="wait">
              {tab === 'register' && (
                <motion.div key="name"
                  initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.18 }}>
                  <label className="block text-xs font-medium text-white-50 mb-1.5">Name</label>
                  <input type="text" value={name} onChange={e => setName(e.target.value)}
                    placeholder="Your name" autoComplete="name"
                    className="w-full rounded-lg border border-line bg-surface-sunken px-3 py-2.5 text-sm text-white-90 placeholder:text-white-30 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30 transition-colors" />
                </motion.div>
              )}
            </AnimatePresence>

            <div>
              <label className="block text-xs font-medium text-white-50 mb-1.5">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com" required autoComplete="email"
                className="w-full rounded-lg border border-line bg-surface-sunken px-3 py-2.5 text-sm text-white-90 placeholder:text-white-30 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30 transition-colors" />
            </div>

            <div>
              <label className="block text-xs font-medium text-white-50 mb-1.5">Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••" required minLength={8}
                autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
                className="w-full rounded-lg border border-line bg-surface-sunken px-3 py-2.5 text-sm text-white-90 placeholder:text-white-30 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30 transition-colors" />
            </div>

            <AnimatePresence>
              {displayError && (
                <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                  {displayError}
                </motion.p>
              )}
            </AnimatePresence>

            <button type="submit" disabled={!!isLoading}
              className="w-full rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2.5 text-sm font-medium text-white transition-colors flex items-center justify-center gap-2">
              {isLoading
                ? <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                : tab === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>
        </div>

        <p className="text-center text-[11px] text-white-25 mt-4 px-4 leading-relaxed">
          Cloud features use the real api.interviewpilot.in backend and require a valid account.
          All local features work permanently without signing in.
        </p>
      </motion.div>
    </div>
  )
}
