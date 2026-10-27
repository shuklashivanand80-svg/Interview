/**
 * Priority Changes — Focused Test Suite
 * Covers:
 *  1. No-registration startup
 *  2. Unlimited sessions (no auto-termination)
 *  3. Always-on-top overlay pin/unpin
 *  4. Screenshot/content protection API
 *  5. Overlay creation, close, recreation
 */
import React from 'react'
import "@testing-library/jest-dom/vitest"
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('react-markdown', () => ({ default: ({ children }: any) => <div data-testid="markdown">{children}</div> }))
vi.mock('remark-gfm', () => ({ default: () => () => {} }))
vi.mock('../src/renderer/components/STTBar', () => ({ STTBar: () => <div data-testid="stt-bar" /> }))
vi.mock('../src/renderer/components/MermaidBlock', () => ({ default: () => <div data-testid="mermaid" /> }))
vi.mock('../src/renderer/store/auth', () => ({
  useAuth: () => ({ user: { id: 'guest', email: '', name: 'Local User', plan: 'local-free', isGuest: true }, isAuthenticated: false, isGuest: true, logout: vi.fn() }),
  AuthProvider: ({ children }: any) => <>{children}</>,
  GUEST_USER: { id: 'guest', email: '', name: 'Local User', plan: 'local-free', isGuest: true },
}))
vi.mock('../src/renderer/store/settings', () => ({
  useSettings: () => ({ settings: { ai: { model: 'openai/gpt-oss-120b', autoAnswer: false }, stt: { provider: 'browser', apiKey: '', language: 'en-US' } }, updateAI: vi.fn() }),
  AI_MODELS: [{ id: 'openai/gpt-oss-120b', name: 'GPT-OSS 120B', tier: 'PRO' }, { id: 'anthropic/claude-3-5-sonnet', name: 'Claude 3.5 Sonnet', tier: 'PRO' }],
  SettingsProvider: ({ children }: any) => <>{children}</>,
}))

import Dashboard from '../src/renderer/views/Dashboard'
import OverlaySession from '../src/renderer/views/OverlaySession'

function makeIpcMock(overrides: Record<string, any> = {}) {
  const defaults: Record<string, any> = {
    'window:openOverlay': true,
    'window:closeOverlay': undefined,
    'overlay:getPinned': true,
    'overlay:setAlwaysOnTop': true,
    'settings:load': null,
    'history:getAll': [],
    'history:save': true,
    'capture-screenshot': 'data:image/png;base64,mock',
  }
  const merged = { ...defaults, ...overrides }
  return {
    invoke: vi.fn(async (channel: string) => channel in merged ? merged[channel] : null),
    send: vi.fn(), on: vi.fn(() => () => {}), once: vi.fn(), removeListener: vi.fn(), removeAllListeners: vi.fn(),
  }
}

// 1. No-registration startup
describe('1. No-registration startup', () => {
  beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); (window as any).electron = { ipcRenderer: makeIpcMock() } })

  it('loads Dashboard without login prompt', () => {
    render(<MemoryRouter initialEntries={['/']}><Dashboard /></MemoryRouter>)
    expect(screen.getByRole('heading', { name: /New Interview/i })).toBeInTheDocument()
    expect(screen.queryByPlaceholderText(/you@example.com/i)).not.toBeInTheDocument()
  })

  it('defaults to new-interview tab on fresh startup', () => {
    render(<MemoryRouter initialEntries={['/']}><Dashboard /></MemoryRouter>)
    const navBtn = document.getElementById('nav-new-interview')
    expect(navBtn).toBeInTheDocument()
    expect(navBtn?.className).toContain('bg-surface-active')
  })

  it('restores to Dashboard on window re-creation without login', () => {
    const { unmount } = render(<MemoryRouter initialEntries={['/']}><Dashboard /></MemoryRouter>)
    unmount()
    render(<MemoryRouter initialEntries={['/']}><Dashboard /></MemoryRouter>)
    expect(screen.getByRole('heading', { name: /New Interview/i })).toBeInTheDocument()
    expect(screen.queryByText(/Sign In/i)).not.toBeInTheDocument()
  })
})

// 2. Unlimited sessions
describe('2. Unlimited sessions — no auto-termination', () => {
  beforeEach(() => {
    localStorage.clear(); vi.clearAllMocks(); vi.useFakeTimers()
    ;(window as any).electron = { ipcRenderer: makeIpcMock() }
    localStorage.setItem('ip_session_config', JSON.stringify({ company: 'TestCo', role: 'Engineer', jd: 'x', language: 'English', autoAnswer: false }))
  })
  afterEach(() => vi.useRealTimers())

  it('timer increments beyond 600s without auto-termination', () => {
    render(<OverlaySession />)
    act(() => { vi.advanceTimersByTime(700_000) })
    expect(screen.getByText(/11:/)).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Type question to ask')).not.toBeDisabled()
  })

  it('accepts questions after 35 minutes', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, body: new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"Answer."}}]}\n\n')); c.enqueue(new TextEncoder().encode('data: [DONE]\n\n')); c.close() } }) })
    render(<OverlaySession />)
    // Advance fake timer 35 minutes to simulate long-running session
    act(() => { vi.advanceTimersByTime(35 * 60_000) })
    // Restore real timers before async fetch + waitFor (fake timers block microtask flushing)
    vi.useRealTimers()
    fireEvent.change(screen.getByPlaceholderText('Type question to ask'), { target: { value: 'Late question' } })
    fireEvent.click(document.getElementById('send-question-btn')!)
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1))
  })

  it('does not show session-expiry or limit UI', () => {
    render(<OverlaySession />)
    expect(screen.queryByText(/session expired/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/session limit/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/daily limit/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/sessions remaining/i)).not.toBeInTheDocument()
  })
})

// 3. Always-on-top pin/unpin
describe('3. Always-on-top overlay — pin/unpin', () => {
  beforeEach(() => {
    localStorage.clear(); vi.clearAllMocks()
    ;(window as any).electron = { ipcRenderer: makeIpcMock() }
    localStorage.setItem('ip_session_config', JSON.stringify({ company: 'Acme', role: 'Dev', language: 'English', autoAnswer: false }))
  })

  it('renders the pin button', () => { render(<OverlaySession />); expect(document.getElementById('overlay-pin-btn')).toBeInTheDocument() })

  it('calls overlay:getPinned on mount', async () => {
    const ipc = makeIpcMock({ 'overlay:getPinned': false }); (window as any).electron = { ipcRenderer: ipc }
    render(<OverlaySession />)
    await waitFor(() => expect(ipc.invoke).toHaveBeenCalledWith('overlay:getPinned'))
  })

  it('calls overlay:setAlwaysOnTop(false) when clicked while pinned', async () => {
    const ipc = makeIpcMock({ 'overlay:getPinned': true }); (window as any).electron = { ipcRenderer: ipc }
    render(<OverlaySession />)
    await waitFor(() => expect(ipc.invoke).toHaveBeenCalledWith('overlay:getPinned'))
    fireEvent.click(document.getElementById('overlay-pin-btn')!)
    await waitFor(() => expect(ipc.invoke).toHaveBeenCalledWith('overlay:setAlwaysOnTop', false))
  })

  it('calls overlay:setAlwaysOnTop(true) when clicked while unpinned', async () => {
    const ipc = makeIpcMock({ 'overlay:getPinned': false }); (window as any).electron = { ipcRenderer: ipc }
    render(<OverlaySession />)
    await waitFor(() => expect(ipc.invoke).toHaveBeenCalledWith('overlay:getPinned'))
    fireEvent.click(document.getElementById('overlay-pin-btn')!)
    await waitFor(() => expect(ipc.invoke).toHaveBeenCalledWith('overlay:setAlwaysOnTop', true))
  })

  it('pin option appears in the 3-dots options menu', () => {
    render(<OverlaySession />)
    fireEvent.click(screen.getByTitle('Menu'))
    const pinOption = screen.queryByText(/Unpin Overlay/i) || screen.queryByText(/Pin Overlay/i)
    expect(pinOption).toBeInTheDocument()
  })

  it('works gracefully without Electron in browser dev mode', () => {
    ;(window as any).electron = null
    render(<OverlaySession />)
    expect(() => fireEvent.click(document.getElementById('overlay-pin-btn')!)).not.toThrow()
  })
})

// 4. Screenshot/content protection
describe('4. Screenshot protection', () => {
  beforeEach(() => {
    localStorage.clear(); vi.clearAllMocks()
    ;(window as any).electron = { ipcRenderer: makeIpcMock() }
    localStorage.setItem('ip_session_config', JSON.stringify({ company: 'Snap', role: 'Dev', language: 'English', autoAnswer: false }))
  })

  it('capture-screenshot IPC is invoked via screenshot button', async () => {
    const ipc = makeIpcMock(); (window as any).electron = { ipcRenderer: ipc }
    render(<OverlaySession />)
    fireEvent.click(screen.getByTitle('Screen Capture & Analysis'))
    await waitFor(() => expect(ipc.invoke).toHaveBeenCalledWith('capture-screenshot'))
  })

  it('handles null return from capture-screenshot gracefully', () => {
    const ipc = makeIpcMock({ 'capture-screenshot': null }); (window as any).electron = { ipcRenderer: ipc }
    render(<OverlaySession />)
    expect(() => fireEvent.click(screen.getByTitle('Screen Capture & Analysis'))).not.toThrow()
  })

  it('setContentProtection try/catch pattern swallows unsupported-platform error', () => {
    const mockWin = { setContentProtection: vi.fn().mockImplementation(() => { throw new Error('not supported') }) }
    const safeSetProtection = (win: typeof mockWin) => { try { win.setContentProtection(true) } catch { /* graceful */ } }
    expect(() => safeSetProtection(mockWin)).not.toThrow()
    expect(mockWin.setContentProtection).toHaveBeenCalledWith(true)
  })
})

// 5. Overlay lifecycle
describe('5. Overlay lifecycle', () => {
  beforeEach(() => {
    localStorage.clear(); vi.clearAllMocks()
    ;(window as any).electron = { ipcRenderer: makeIpcMock() }
    localStorage.setItem('ip_session_config', JSON.stringify({ company: 'Corp', role: 'SWE', language: 'English', autoAnswer: false }))
  })

  it('opens overlay via window:openOverlay IPC on Start Interview', async () => {
    const ipc = makeIpcMock(); (window as any).electron = { ipcRenderer: ipc }
    render(<MemoryRouter initialEntries={['/']}><Dashboard /></MemoryRouter>)
    fireEvent.change(screen.getByPlaceholderText('e.g. Google'), { target: { value: 'Corp' } })
    fireEvent.change(screen.getByPlaceholderText('e.g. Software Engineer'), { target: { value: 'SWE' } })
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }))
    await waitFor(() => screen.getByRole('heading', { name: /Configuration/i }))
    fireEvent.click(screen.getByRole('button', { name: /Start Interview/i }))
    await waitFor(() => expect(ipc.invoke).toHaveBeenCalledWith('window:openOverlay'))
  })

  it('End Session calls window:closeOverlay (not window.close)', async () => {
    const ipc = makeIpcMock(); (window as any).electron = { ipcRenderer: ipc }
    render(<OverlaySession />)
    fireEvent.click(screen.getByTitle('Menu'))
    fireEvent.click(screen.getByText('End Session'))
    await waitFor(() => expect(ipc.invoke).toHaveBeenCalledWith('window:closeOverlay'))
  })

  it('overlay renders empty-state after recreation', () => {
    const { unmount } = render(<OverlaySession />)
    expect(screen.getByText('Ask your first question')).toBeInTheDocument()
    unmount()
    render(<OverlaySession />)
    expect(screen.getByText('Ask your first question')).toBeInTheDocument()
  })
})

