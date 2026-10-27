import React from 'react'
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Dashboard from '../src/renderer/views/Dashboard'
import OverlaySession from '../src/renderer/views/OverlaySession'

// Mock react-markdown & remark-gfm
vi.mock('react-markdown', () => ({
  default: ({ children }: any) => <div data-testid="markdown">{children}</div>,
}))
vi.mock('remark-gfm', () => ({
  default: () => () => {},
}))

vi.mock('../src/renderer/store/auth', () => ({
  useAuth: () => ({
    user: { id: 'usr_1', email: 'user@example.com', name: 'Demo User' },
    isAuthenticated: true,
    logout: vi.fn(),
  }),
  AuthProvider: ({ children }: any) => <>{children}</>,
}))

vi.mock('../src/renderer/store/settings', () => ({
  useSettings: () => ({
    settings: {
      ai: { model: 'openai/gpt-oss-120b', autoAnswer: false },
      stt: { provider: 'browser', apiKey: '', language: 'en-US' },
    },
    updateAI: vi.fn(),
  }),
  AI_MODELS: [
    { id: 'openai/gpt-oss-120b', name: 'GPT-OSS 120B', tier: 'PRO' },
    { id: 'anthropic/claude-3-5-sonnet', name: 'Claude 3.5 Sonnet', tier: 'PRO' },
  ],
}))

describe('PHASE 4 — End-to-End & Integration Testing', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('executes full New Interview -> Configuration -> Live Interview end-to-end workflow', async () => {
    const invokeMock = vi.fn().mockResolvedValue({ ok: true })
    const sendMock = vi.fn()

    ;(window as any).electron = {
      ipcRenderer: {
        invoke: invokeMock,
        send: sendMock,
      },
    }

    // ── STEP 1: New Interview Screen ──────────────────────────────────────────
    const { unmount } = render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Dashboard />
      </MemoryRouter>
    )

    expect(screen.getByRole('heading', { name: /New Interview/i })).toBeInTheDocument()

    // Fill Company and Role
    const companyInput = screen.getByPlaceholderText('e.g. Google')
    const roleInput = screen.getByPlaceholderText('e.g. Software Engineer')
    const jdTextarea = screen.getByPlaceholderText(/Paste the job description here/i)

    fireEvent.change(companyInput, { target: { value: 'Netflix' } })
    fireEvent.change(roleInput, { target: { value: 'Senior Distributed Systems Engineer' } })
    fireEvent.change(jdTextarea, { target: { value: 'Design edge streaming caching protocols.' } })

    const continueBtn = screen.getByRole('button', { name: /Continue/i })
    expect(continueBtn).not.toBeDisabled()
    fireEvent.click(continueBtn)

    // ── STEP 2: Configuration Screen ──────────────────────────────────────────
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Configuration/i })).toBeInTheDocument()
    })

    // Verify interview summary card received data
    expect(screen.getByText('Netflix')).toBeInTheDocument()
    expect(screen.getByText('Senior Distributed Systems Engineer')).toBeInTheDocument()

    // Test Edit navigation back to New Interview
    const editBtn = screen.getByRole('button', { name: /Edit/i })
    fireEvent.click(editBtn)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /New Interview/i })).toBeInTheDocument()
    })

    // Assert inputs were preserved
    expect((screen.getByPlaceholderText('e.g. Google') as HTMLInputElement).value).toBe('Netflix')
    expect((screen.getByPlaceholderText('e.g. Software Engineer') as HTMLInputElement).value).toBe('Senior Distributed Systems Engineer')

    // Navigate back to Configuration
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }))

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Configuration/i })).toBeInTheDocument()
    })

    // Toggle Auto Answer to ON
    const autoAnswerToggle = document.getElementById('cfg-auto-answer-toggle')!
    fireEvent.click(autoAnswerToggle)
    expect(screen.getByText('On')).toBeInTheDocument()

    // Change Answer Style to STAR Method
    const styleSelector = document.getElementById('cfg-style-selector')!
    fireEvent.click(styleSelector)
    const starOption = screen.getByText('STAR Method')
    fireEvent.click(starOption)
    expect(screen.getAllByText('STAR Method')[0]).toBeInTheDocument()

    // Click Start Interview
    const startBtn = screen.getByRole('button', { name: /Start Interview/i })
    fireEvent.click(startBtn)

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith('window:openOverlay')
    })

    // Verify localStorage has final configuration
    const saved = JSON.parse(localStorage.getItem('ip_session_config') || '{}')
    expect(saved.company).toBe('Netflix')
    expect(saved.role).toBe('Senior Distributed Systems Engineer')
    expect(saved.answerStyle).toBe('star')
    expect(saved.autoAnswer).toBe(true)

    unmount()

    // ── STEP 3: Live Interview (OverlaySession) Context Injection ─────────────
    const mockStreamResponse = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"To design resilient edge caching..."}}]}\n\n'))
        controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'))
        controller.close()
      },
    })

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      body: mockStreamResponse,
    })
    global.fetch = fetchMock

    render(<OverlaySession />)

    // Context label in round bar should show role & company
    expect(screen.getByText(/Senior Distributed Systems Engineer @ Netflix/i)).toBeInTheDocument()

    // Submit question
    const textarea = screen.getByPlaceholderText('Type question to ask')
    fireEvent.change(textarea, { target: { value: 'How do you handle cache invalidation at scale?' } })

    const sendBtn = document.getElementById('send-question-btn')!
    fireEvent.click(sendBtn)

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1)
      const call = fetchMock.mock.calls[0]
      const body = JSON.parse(call[1].body)
      expect(body.message).toBe('How do you handle cache invalidation at scale?')
      expect(body.company).toBe('Netflix')
      expect(body.role).toBe('Senior Distributed Systems Engineer')
      expect(body.answerStyle).toBe('star')
      expect(body.context).toContain('Target Company: Netflix')
      expect(body.context).toContain('Senior Distributed Systems Engineer')
    })
  })
})
