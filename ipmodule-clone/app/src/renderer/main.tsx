/**
 * App entry point — InterviewPilot Clone
 *
 * ACCESS POLICY:
 *  • Dashboard is the default route — loads immediately on every launch.
 *  • No auth guard, no loading spinner gating any route.
 *  • /login and /register are optional side routes only.
 *  • /overlay is the Electron stealth overlay window.
 */
import React, { Suspense, lazy } from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter, Routes, Route } from 'react-router-dom'
import './styles.css'

import { AuthProvider } from './store/auth'
import { SettingsProvider } from './store/settings'
import { ThemeProvider } from './store/theme'

// Code-split views (lazy loaded after dashboard renders)
const Dashboard    = lazy(() => import('./views/Dashboard'))
const OverlaySession = lazy(() => import('./views/OverlaySession'))
const LoginView    = lazy(() => import('./views/LoginView'))

/** Minimal inline spinner — only shows during lazy chunk loading, never for auth */
function ChunkSpinner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#17181c' }}>
      <div style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid #7c3aed', borderTopColor: 'transparent', animation: 'spin 0.7s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

function AppRoutes() {
  // NOTE: No isLoading check here — dashboard renders immediately on every launch.
  // Auth state is restored silently in the background without blocking the UI.
  return (
    <Routes>
      {/* Stealth overlay window — opened programmatically by Electron */}
      <Route path="/overlay"   element={<OverlaySession />} />

      {/* Optional login / register — never shown automatically */}
      <Route path="/login"     element={<LoginView />} />
      <Route path="/register"  element={<LoginView defaultTab="register" />} />

      {/* Dashboard — the default destination for every launch */}
      <Route path="/*"         element={<Dashboard />} />
    </Routes>
  )
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <SettingsProvider>
          <HashRouter>
            <Suspense fallback={<ChunkSpinner />}>
              <AppRoutes />
            </Suspense>
          </HashRouter>
        </SettingsProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(<App />)
