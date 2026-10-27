import React from 'react'
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { STTBar, useSTT, STTConfig } from '../src/renderer/components/STTBar'

describe('Audio and Microphone STT Subsystem', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('handles unsupported browser SpeechRecognition gracefully', async () => {
    delete (window as any).SpeechRecognition
    delete (window as any).webkitSpeechRecognition

    const onTranscript = vi.fn()
    const config: STTConfig = { provider: 'browser' }

    render(<STTBar config={config} onTranscript={onTranscript} />)

    const startBtn = screen.getByRole('button', { name: /Start STT/i })
    fireEvent.click(startBtn)

    await waitFor(() => {
      expect(screen.getByText(/Browser does not support speech recognition/i)).toBeInTheDocument()
    })
  })

  it('handles microphone permission denied error', async () => {
    // Provide SpeechRecognition constructor
    const MockSpeechRec = vi.fn().mockImplementation(() => ({
      start: vi.fn(),
      stop: vi.fn(),
      abort: vi.fn(),
    }))
    ;(window as any).webkitSpeechRecognition = MockSpeechRec

    // Mock getUserMedia rejecting with NotAllowedError
    Object.defineProperty(navigator, 'mediaDevices', {
      writable: true,
      value: {
        getUserMedia: vi.fn().mockRejectedValue(new DOMException('Permission denied', 'NotAllowedError')),
      },
    })

    const onTranscript = vi.fn()
    const config: STTConfig = { provider: 'browser' }

    render(<STTBar config={config} onTranscript={onTranscript} />)

    const startBtn = screen.getByRole('button', { name: /Start STT/i })
    fireEvent.click(startBtn)

    await waitFor(() => {
      expect(screen.getByText(/Microphone access denied/i)).toBeInTheDocument()
    })
  })

  it('mock STT provider runs in demo mode without real microphone', async () => {
    vi.useFakeTimers()
    const onTranscript = vi.fn()
    const config: STTConfig = { provider: 'mock' }

    render(<STTBar config={config} onTranscript={onTranscript} />)

    expect(screen.getByText('Demo Mode')).toBeInTheDocument()
    expect(screen.getByText(/Simulated transcription/i)).toBeInTheDocument()

    const startBtn = screen.getByRole('button', { name: /Start STT/i })
    fireEvent.click(startBtn)

    // Should switch to Listening state with Pause and Stop buttons
    expect(screen.getByRole('button', { name: /Stop/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Pause/i })).toBeInTheDocument()

    // Fast-forward mock timers to simulate incoming interim/final transcript
    vi.advanceTimersByTime(2500)

    expect(onTranscript).toHaveBeenCalledWith(expect.any(String), true)

    // Stop recording
    const stopBtn = screen.getByRole('button', { name: /Stop/i })
    fireEvent.click(stopBtn)

    expect(screen.getByRole('button', { name: /Start STT/i })).toBeInTheDocument()
    vi.useRealTimers()
  })

  it('stops media streams and cleans up audio tracks when stopping', async () => {
    const stopTrackMock = vi.fn()
    const mockStream = {
      getTracks: () => [{ stop: stopTrackMock }],
    }

    Object.defineProperty(navigator, 'mediaDevices', {
      writable: true,
      value: {
        getUserMedia: vi.fn().mockResolvedValue(mockStream),
      },
    })

    // Mock MediaRecorder as proper class constructor
    class MockMediaRecorder {
      state = 'inactive'
      start = vi.fn()
      stop = vi.fn()
      ondataavailable: any = null
      addEventListener = vi.fn()
    }
    ;(window as any).MediaRecorder = MockMediaRecorder

    // Mock WebSocket for Deepgram
    class MockWebSocket {
      onopen: any = null
      onmessage: any = null
      onerror: any = null
      onclose: any = null
      send = vi.fn()
      close = vi.fn()
      constructor(public url: string) {
        setTimeout(() => this.onopen?.(), 10)
      }
    }
    ;(window as any).WebSocket = MockWebSocket

    const onTranscript = vi.fn()
    const config: STTConfig = { provider: 'deepgram', deepgramApiKey: 'test-key-mock' }

    render(<STTBar config={config} onTranscript={onTranscript} />)

    const startBtn = screen.getByRole('button', { name: /Start STT/i })
    fireEvent.click(startBtn)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Stop/i })).toBeInTheDocument()
    })

    const stopBtn = screen.getByRole('button', { name: /Stop/i })
    fireEvent.click(stopBtn)

    expect(stopTrackMock).toHaveBeenCalled()
  })
})
