import React from 'react'
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ConfigurationTab, { SessionConfigData } from '../src/renderer/views/dashboard/ConfigurationTab'

// Mock react-router-dom navigate
const mockNavigate = vi.fn()
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
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

describe('Configuration Screen (ConfigurationTab)', () => {
  const defaultSessionData: SessionConfigData = {
    company: 'Anthropic',
    role: 'Staff ML Engineer',
    jd: 'Build scalable LLM inference pipelines.',
    resume: { name: 'Resume_Staff_ML.pdf', size: 104857 },
    brief: null,
  }

  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('renders correct company, role, and resume indicator', () => {
    render(
      <ConfigurationTab
        sessionData={defaultSessionData}
        onEdit={vi.fn()}
        onStart={vi.fn()}
      />
    )

    expect(screen.getByRole('heading', { name: /Configuration/i })).toBeInTheDocument()
    expect(screen.getByText('Anthropic')).toBeInTheDocument()
    expect(screen.getByText('Staff ML Engineer')).toBeInTheDocument()
    expect(screen.getByText('Resume')).toBeInTheDocument()
  })

  it('displays "No resume attached" when resume is missing', () => {
    const noResumeData: SessionConfigData = {
      company: 'Startup Inc',
      role: 'Full Stack Dev',
      jd: '',
      resume: null,
      brief: null,
    }

    render(
      <ConfigurationTab
        sessionData={noResumeData}
        onEdit={vi.fn()}
        onStart={vi.fn()}
      />
    )

    expect(screen.getByText('No resume attached')).toBeInTheDocument()
  })

  it('triggers onEdit callback when clicking Edit button', () => {
    const onEdit = vi.fn()
    render(
      <ConfigurationTab
        sessionData={defaultSessionData}
        onEdit={onEdit}
        onStart={vi.fn()}
      />
    )

    const editBtn = screen.getByRole('button', { name: /Edit/i })
    fireEvent.click(editBtn)
    expect(onEdit).toHaveBeenCalledTimes(1)
  })

  it('changes answer style from On the point to Structured or STAR Method', () => {
    render(
      <ConfigurationTab
        sessionData={defaultSessionData}
        onEdit={vi.fn()}
        onStart={vi.fn()}
      />
    )

    // Initial selected style
    expect(screen.getByText('On the point')).toBeInTheDocument()

    // Click style selector to open dropdown
    const styleSelector = document.getElementById('cfg-style-selector')
    expect(styleSelector).toBeTruthy()
    fireEvent.click(styleSelector!)

    // Click "STAR Method" option
    const starOption = screen.getByText('STAR Method')
    fireEvent.click(starOption)

    // Should now show STAR Method as selected
    expect(screen.getAllByText('STAR Method')[0]).toBeInTheDocument()
  })

  it('changes interview language via language selector', () => {
    render(
      <ConfigurationTab
        sessionData={defaultSessionData}
        onEdit={vi.fn()}
        onStart={vi.fn()}
      />
    )

    // Default language is Auto
    expect(screen.getByText('Auto (English + Hindi)')).toBeInTheDocument()

    // Open language dropdown
    const langSelector = document.getElementById('cfg-lang-selector')
    fireEvent.click(langSelector!)

    // Select Hindi
    const hindiOption = screen.getAllByText('Hindi')[0]
    fireEvent.click(hindiOption)

    expect(screen.getAllByText('Hindi')[0]).toBeInTheDocument()
  })

  it('toggles Auto Answer state between Off and On', () => {
    render(
      <ConfigurationTab
        sessionData={defaultSessionData}
        onEdit={vi.fn()}
        onStart={vi.fn()}
      />
    )

    // Initially Off
    expect(screen.getByText('Off')).toBeInTheDocument()
    expect(screen.getByText('You ask when you need to')).toBeInTheDocument()

    // Toggle on
    const toggle = document.getElementById('cfg-auto-answer-toggle')
    fireEvent.click(toggle!)

    expect(screen.getByText('On')).toBeInTheDocument()
    expect(screen.getByText('AI responds automatically')).toBeInTheDocument()
  })

  it('displays session duration and session limits info card', () => {
    render(
      <ConfigurationTab
        sessionData={defaultSessionData}
        onEdit={vi.fn()}
        onStart={vi.fn()}
      />
    )

    expect(screen.getByText('Free session')).toBeInTheDocument()
    expect(screen.getByText('10 min')).toBeInTheDocument()
    expect(screen.getByText(/4 sessions remaining today/i)).toBeInTheDocument()
  })

  it('starts interview, invokes overlay IPC, saves config, and navigates', async () => {
    const invokeMock = vi.fn().mockResolvedValue({ ok: true })
    const sendMock = vi.fn()

    ;(window as any).electron = {
      ipcRenderer: {
        invoke: invokeMock,
        send: sendMock,
      },
    }

    const onStart = vi.fn()
    render(
      <ConfigurationTab
        sessionData={defaultSessionData}
        onEdit={vi.fn()}
        onStart={onStart}
      />
    )

    const startBtn = screen.getByRole('button', { name: /Start Interview/i })
    fireEvent.click(startBtn)

    await waitFor(() => {
      expect(onStart).toHaveBeenCalledWith(expect.objectContaining({
        company: 'Anthropic',
        role: 'Staff ML Engineer',
      }))
      expect(invokeMock).toHaveBeenCalledWith('window:openOverlay')
      expect(sendMock).toHaveBeenCalledWith('shortcut:session-started')
      expect(mockNavigate).toHaveBeenCalledWith('/overlay')
    })

    const saved = JSON.parse(localStorage.getItem('ip_session_config') || '{}')
    expect(saved.company).toBe('Anthropic')
    expect(saved.role).toBe('Staff ML Engineer')
  })

  it('opens Manage Answer Styles modal and persists custom instructions', () => {
    render(
      <ConfigurationTab
        sessionData={defaultSessionData}
        onEdit={vi.fn()}
        onStart={vi.fn()}
      />
    )

    const manageBtn = screen.getByRole('button', { name: /Manage/i })
    fireEvent.click(manageBtn)

    expect(screen.getByRole('heading', { name: /Manage Answer Styles/i })).toBeInTheDocument()

    const textarea = screen.getByPlaceholderText(/Always include time\/space complexity/i)
    fireEvent.change(textarea, { target: { value: 'Always include unit tests in answers.' } })

    const saveBtn = screen.getByRole('button', { name: /Save Style/i })
    fireEvent.click(saveBtn)

    expect(localStorage.getItem('ip_custom_style_prompt')).toBe('Always include unit tests in answers.')
    expect(screen.queryByRole('heading', { name: /Manage Answer Styles/i })).not.toBeInTheDocument()
  })
})
