/**
 * LOCAL ACCESS CONFIGURATION
 * ──────────────────────────────────────────────────────────────────────────────
 * This file defines what is permanently free/local in this clone.
 *
 * THREE ACCESS TIERS:
 *   LOCAL_FREE    — Works 100% offline, no account, no key, no limit
 *   DEMO_MODE     — Simulated/mock, clearly labelled, no real AI
 *   API_REQUIRED  — Needs a real provider API key or cloud account (user-supplied)
 *
 * Rules:
 *   - NO session timer, countdown, or 10-minute limit
 *   - NO daily session count limit
 *   - NO credit expiry or plan expiry check
 *   - NO forced re-authentication after session ends
 *   - NO subscription popup or upgrade wall for local features
 */

export const ACCESS = {
  // Local features — free forever, no login required
  LOCAL_FREE: {
    dashboard: true,
    history: true,           // stored in localStorage / electron-store
    settings: true,          // all settings panels
    overlayWindow: true,     // stealth overlay window
    sessionCreator: true,    // create unlimited local sessions
    responseModes: true,     // concise / explain / story
    mermaidDiagrams: true,   // rendered locally
    sttBrowser: true,        // Browser Web Speech API
    sttMock: true,           // demo/mock transcription
    screenAnalyze: true,     // screenshot capture (Electron)
    keyboardShortcuts: true, // all 15 shortcuts
    themeToggle: true,
    unlimitedSessions: true, // NO session count limit
    unlimitedRestarts: true, // NO relaunch restrictions
  },

  // Demo/mock features — clearly labelled, no real AI
  DEMO_MODE: {
    aiResponses: true,       // fallback responses when no API key
    sttMock: true,           // simulated transcription
  },

  // Features that need a user-supplied key (honest requirement)
  API_REQUIRED: {
    realAIResponses: 'User must provide their own API key in Settings → AI Models, OR use an authenticated api.interviewpilot.in account.',
    deepgramSTT: 'User must provide a Deepgram API key in Settings → Speech (STT).',
    cloudHistory: 'Requires api.interviewpilot.in account for cloud sync.',
  },
} as const

// Session has NO timer, NO limit, NO expiry
export const SESSION_LIMITS = {
  maxDurationMs: null,         // null = unlimited
  dailySessionLimit: null,     // null = unlimited
  sessionCountLimit: null,     // null = unlimited
  requiresAuthAfterSession: false,
  resetOnRelaunch: false,
  creditSystem: false,
  planGating: false,
} as const

// Plan display — informational only, never enforced locally
export const LOCAL_PLAN = {
  name: 'Local Free',
  tier: 'local' as const,
  description: 'All local features — no subscription, no account required.',
  aiNote: 'Real AI inference requires a user-supplied API key or cloud account.',
} as const
