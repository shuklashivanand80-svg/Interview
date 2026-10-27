import React from 'react'
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import OverlaySession from '../src/renderer/views/OverlaySession'

// Mock react-markdown & remark-gfm
vi.mock('react-markdown', () => ({
  default: ({ children }: any) => <div data-testid="markdown">{children}</div>,
}))
vi.mock('remark-gfm', () => ({
  default: () => () => {},
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

describe('Live Interview Screen (OverlaySession)', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    localStorage.setItem('ip_session_config', JSON.stringify({
      company: 'Meta',
      role: 'Production Engineer',
      jd: 'Linux kernel, distributed systems, incident response.',
      answerStyle: 'concise',
      language: 'English',
      autoAnswer: false,
    }))
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('renders empty state with "Ask your first question" and 6 category buttons', () => {
    render(<OverlaySession />)

    expect(screen.getByText('Ask your first question')).toBeInTheDocument()
    expect(screen.getByText('DSA / Coding')).toBeInTheDocument()
    expect(screen.getByText('System Design (HLD)')).toBeInTheDocument()
    expect(screen.getByText('LLD / OOD')).toBeInTheDocument()
    expect(screen.getByText('Machine Coding')).toBeInTheDocument()
    expect(screen.getByText('Debugging')).toBeInTheDocument()
    expect(screen.getByText('SQL & Databases')).toBeInTheDocument()
  })

  it('rejects empty and whitespace-only question submissions', () => {
    render(<OverlaySession />)

    const sendBtn = document.getElementById('send-question-btn') as HTMLButtonElement
    expect(sendBtn).toBeDisabled()

    const textarea = screen.getByPlaceholderText('Type question to ask')
    fireEvent.change(textarea, { target: { value: '   \n  ' } })
    expect(sendBtn).toBeDisabled()
  })

  it('clicking category shortcut inserts prefix into input', () => {
    render(<OverlaySession />)

    const dsaBtn = screen.getByText('DSA / Coding')
    fireEvent.click(dsaBtn)

    const textarea = screen.getByPlaceholderText('Type question to ask') as HTMLTextAreaElement
    expect(textarea.value).toBe('[DSA / Coding] ')

    const sendBtn = document.getElementById('send-question-btn') as HTMLButtonElement
    expect(sendBtn).not.toBeDisabled()
  })

  it('displays default model GPT-OSS 120B and allows switching models', () => {
    render(<OverlaySession />)

    const modelBtn = document.getElementById('model-selector-btn')
    expect(modelBtn).toHaveTextContent('GPT-OSS 120B')

    // Open model menu
    fireEvent.click(modelBtn!)

    // Select Claude 3.5 Sonnet
    const claudeOption = screen.getByText('Claude 3.5 Sonnet')
    fireEvent.click(claudeOption)

    expect(modelBtn).toHaveTextContent('Claude 3.5')
  })

  it('submits question and sends context in stream API request', async () => {
    const mockStreamResponse = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"Two Sum can be solved with a hash map."}}]}\n\n'))
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

    const textarea = screen.getByPlaceholderText('Type question to ask')
    fireEvent.change(textarea, { target: { value: 'How do you solve Two Sum?' } })

    const sendBtn = document.getElementById('send-question-btn')!
    fireEvent.click(sendBtn)

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1)
      const call = fetchMock.mock.calls[0]
      expect(call[0]).toContain('/ai/stream')
      const body = JSON.parse(call[1].body)
      expect(body.message).toBe('How do you solve Two Sum?')
      expect(body.company).toBe('Meta')
      expect(body.role).toBe('Production Engineer')
      expect(body.answerStyle).toBe('concise')
      expect(body.language).toBe('English')
    })
  })

  it('supports round creation and switches round context', () => {
    render(<OverlaySession />)

    // Initially tab 1 exists
    expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument()

    // Click "+" to add Round
    const addRoundBtn = screen.getByTitle('Add Round')
    fireEvent.click(addRoundBtn)

    // Round 2 tab should now exist and be active
    expect(screen.getByRole('button', { name: '2' })).toBeInTheDocument()

    // Switch back to Round 1
    const round1Btn = screen.getByRole('button', { name: '1' })
    fireEvent.click(round1Btn)
    expect(round1Btn).toHaveClass('bg-teal-500')
  })

  it('toggles view mode between Chat and Audio waveform', () => {
    render(<OverlaySession />)

    // Find audio waveform toggle button in top control bar
    const audioToggleBtn = screen.getByTitle('Audio Waveform View')
    fireEvent.click(audioToggleBtn)

    expect(screen.getByText('Listening to speech...')).toBeInTheDocument()

    // Switch back to chat mode
    const chatToggleBtn = screen.getByTitle('Chat View')
    fireEvent.click(chatToggleBtn)

    expect(screen.getByText('Ask your first question')).toBeInTheDocument()
  })
})
