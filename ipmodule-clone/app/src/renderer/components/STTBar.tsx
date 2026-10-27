import React, { useState, useEffect, useRef, useCallback } from 'react'

export type STTStatus = 'idle' | 'requesting-permission' | 'listening' | 'paused' | 'error' | 'no-support'
export type STTProvider = 'browser' | 'deepgram' | 'mock'

export interface STTConfig {
  provider: STTProvider
  deepgramApiKey?: string
  language?: string
}

interface STTProps {
  config: STTConfig
  onTranscript: (text: string, isFinal: boolean) => void
  onStatusChange?: (status: STTStatus) => void
  onError?: (msg: string) => void
}

// ─── Browser Web Speech API adapter ──────────────────────────────────────────
function useBrowserSTT(opts: { onTranscript: (t: string, final: boolean) => void; onError: (m: string) => void; language: string }) {
  const recogRef = useRef<any>(null)
  const [status, setStatus] = useState<STTStatus>('idle')

  const SpeechRec = typeof window !== 'undefined'
    ? ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
    : null

  const start = useCallback(async () => {
    if (!SpeechRec) { setStatus('no-support'); opts.onError('Browser speech recognition not supported'); return }
    try {
      setStatus('requesting-permission')
      await navigator.mediaDevices.getUserMedia({ audio: true })
      const recog = new SpeechRec()
      recog.continuous = true
      recog.interimResults = true
      recog.lang = opts.language || 'en-US'
      recog.maxAlternatives = 1
      recog.onresult = (e: any) => {
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const text = e.results[i][0].transcript
          opts.onTranscript(text, e.results[i].isFinal)
        }
      }
      recog.onerror = (e: any) => {
        if (e.error === 'not-allowed') opts.onError('Microphone permission denied. Enable in browser settings.')
        else if (e.error === 'no-speech') opts.onError('No speech detected. Check your microphone.')
        else opts.onError(`Speech recognition error: ${e.error}`)
        setStatus('error')
      }
      recog.onstart = () => setStatus('listening')
      recog.onend = () => setStatus(s => s === 'listening' ? 'idle' : s)
      recogRef.current = recog
      recog.start()
    } catch (e: any) {
      setStatus('error')
      opts.onError('Microphone access denied: ' + (e.message || e.name))
    }
  }, [opts.language])

  const stop = useCallback(() => {
    recogRef.current?.stop()
    recogRef.current = null
    setStatus('idle')
  }, [])

  const pause = useCallback(() => {
    recogRef.current?.stop()
    setStatus('paused')
  }, [])

  const resume = useCallback(() => {
    if (status === 'paused') start()
  }, [status, start])

  useEffect(() => () => { recogRef.current?.abort() }, [])

  return { status, start, stop, pause, resume }
}

// ─── Mock STT (demo text when no mic/API available) ───────────────────────────
const MOCK_TRANSCRIPTS = [
  'Can you explain the time complexity of quicksort?',
  'What are the main differences between REST and GraphQL?',
  'How would you design a URL shortener like bit.ly?',
  'Tell me about a challenging technical problem you solved.',
  'What is your approach to debugging a production issue?',
]

function useMockSTT(opts: { onTranscript: (t: string, final: boolean) => void }) {
  const [status, setStatus] = useState<STTStatus>('idle')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  let idx = 0

  const start = useCallback(() => {
    setStatus('listening')
    const tick = () => {
      const text = MOCK_TRANSCRIPTS[idx % MOCK_TRANSCRIPTS.length]
      idx++
      // Simulate interim results
      let partial = ''
      const words = text.split(' ')
      let wi = 0
      const wordTimer = setInterval(() => {
        partial += (wi > 0 ? ' ' : '') + words[wi]
        opts.onTranscript(partial, false)
        wi++
        if (wi >= words.length) {
          clearInterval(wordTimer)
          opts.onTranscript(text, true)
          timerRef.current = setTimeout(tick, 4000)
        }
      }, 120)
    }
    timerRef.current = setTimeout(tick, 800)
  }, [opts.onTranscript])

  const stop = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setStatus('idle')
  }, [])

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

  return { status, start, stop, pause: stop, resume: start }
}

// ─── Deepgram STT (WebSocket, real API) ───────────────────────────────────────
function useDeepgramSTT(opts: { apiKey: string; onTranscript: (t: string, final: boolean) => void; onError: (m: string) => void; language: string }) {
  const [status, setStatus] = useState<STTStatus>('idle')
  const wsRef = useRef<WebSocket | null>(null)
  const mediaRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)

  const start = useCallback(async () => {
    if (!opts.apiKey) { opts.onError('Deepgram API key required. Add it in Settings → AI & Models → STT Key.'); setStatus('error'); return }
    try {
      setStatus('requesting-permission')
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaRef.current = stream
      const ws = new WebSocket(`wss://api.deepgram.com/v1/listen?language=${opts.language || 'en-US'}&smart_format=true&interim_results=true`, ['token', opts.apiKey])
      wsRef.current = ws
      ws.onopen = () => {
        setStatus('listening')
        const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' })
        recorderRef.current = recorder
        recorder.ondataavailable = e => { if (ws.readyState === WebSocket.OPEN) ws.send(e.data) }
        recorder.start(250)
      }
      ws.onmessage = e => {
        try {
          const data = JSON.parse(e.data)
          const alt = data.channel?.alternatives?.[0]
          if (alt?.transcript) opts.onTranscript(alt.transcript, data.is_final)
        } catch {}
      }
      ws.onerror = () => { opts.onError('Deepgram connection error. Check your API key.'); setStatus('error') }
      ws.onclose = () => setStatus(s => s === 'listening' ? 'idle' : s)
    } catch (e: any) {
      setStatus('error')
      opts.onError('Microphone error: ' + (e.message || e.name))
    }
  }, [opts.apiKey, opts.language])

  const stop = useCallback(() => {
    recorderRef.current?.stop()
    wsRef.current?.close()
    mediaRef.current?.getTracks().forEach(t => t.stop())
    setStatus('idle')
  }, [])

  useEffect(() => () => { recorderRef.current?.stop(); wsRef.current?.close(); mediaRef.current?.getTracks().forEach(t => t.stop()) }, [])

  return { status, start, stop, pause: stop, resume: start }
}

// ─── Unified STT Hook ─────────────────────────────────────────────────────────
export function useSTT(config: STTConfig, onTranscript: (t: string, final: boolean) => void, onError?: (m: string) => void) {
  const errorHandler = onError || console.error
  const browserSTT = useBrowserSTT({ onTranscript, onError: errorHandler, language: config.language || 'en-US' })
  const mockSTT = useMockSTT({ onTranscript })
  const deepgramSTT = useDeepgramSTT({ apiKey: config.deepgramApiKey || '', onTranscript, onError: errorHandler, language: config.language || 'en-US' })

  if (config.provider === 'deepgram') return deepgramSTT
  if (config.provider === 'mock') return mockSTT
  return browserSTT
}

// ─── STT Control Bar component ────────────────────────────────────────────────
interface STTBarProps {
  config: STTConfig
  onTranscript: (text: string, isFinal: boolean) => void
  compact?: boolean
}

export function STTBar({ config, onTranscript, compact = false }: STTBarProps) {
  const [liveText, setLiveText] = useState('')
  const [error, setError] = useState('')

  const handleTranscript = useCallback((text: string, isFinal: boolean) => {
    setLiveText(isFinal ? '' : text)
    if (isFinal && text.trim()) onTranscript(text.trim(), true)
  }, [onTranscript])

  const { status, start, stop, pause, resume } = useSTT(config, handleTranscript, setError)

  const isActive = status === 'listening'
  const isPaused = status === 'paused'
  const isError = status === 'error'
  const noSupport = status === 'no-support'

  return (
    <div className={`${compact ? '' : 'border-t border-line-subtle pt-2'}`}>
      {/* Provider badge */}
      <div className="flex items-center gap-2 mb-1.5">
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
          config.provider === 'deepgram' ? 'bg-blue-500/15 text-blue-400' :
          config.provider === 'mock' ? 'bg-amber-500/15 text-amber-400' :
          'bg-emerald-500/15 text-emerald-400'
        }`}>
          {config.provider === 'deepgram' ? 'Deepgram' : config.provider === 'mock' ? 'Demo Mode' : 'Browser STT'}
        </span>
        {config.provider === 'mock' && (
          <span className="text-[9px] text-white-30">Simulated transcription — not real speech</span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {/* Mic button */}
        {!isActive && !isPaused ? (
          <button onClick={start}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-400 transition-colors">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
            {status === 'requesting-permission' ? 'Requesting…' : 'Start STT'}
          </button>
        ) : (
          <>
            <button onClick={pause}
              className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/30 text-amber-400 transition-colors">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
              Pause
            </button>
            <button onClick={stop}
              className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-400 transition-colors">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
              Stop
            </button>
            {isActive && (
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                <span className="text-[10px] text-red-400">Listening</span>
              </div>
            )}
          </>
        )}
        {isPaused && (
          <button onClick={resume}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-400 transition-colors">
            Resume
          </button>
        )}
      </div>

      {/* Live interim text */}
      {liveText && (
        <div className="mt-1.5 text-xs text-white-50 italic bg-surface-sunken rounded px-2 py-1 border border-line">
          "{liveText}"
        </div>
      )}

      {/* Error display */}
      {(isError || noSupport || error) && (
        <div className="mt-1.5 text-xs text-amber-400 bg-amber-500/8 border border-amber-500/20 rounded px-2 py-1.5 flex items-start gap-1.5">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 mt-0.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          {noSupport ? 'Browser does not support speech recognition. Use Chrome or Edge.' : error || 'STT error occurred.'}
        </div>
      )}
    </div>
  )
}
