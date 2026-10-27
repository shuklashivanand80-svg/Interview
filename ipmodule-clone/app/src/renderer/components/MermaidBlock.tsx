import React, { useEffect, useRef, useState, useId } from 'react'

interface MermaidBlockProps {
  code: string
}

let mermaidLoaded = false
let mermaidLoadPromise: Promise<any> | null = null

function getMermaid(): Promise<any> {
  if (mermaidLoadPromise) return mermaidLoadPromise
  mermaidLoadPromise = import('mermaid').then(m => {
    const mermaid = m.default
    mermaid.initialize({
      startOnLoad: false,
      theme: 'dark',
      themeVariables: {
        darkMode: true,
        background: '#17181c',
        primaryColor: '#7c3aed',
        primaryTextColor: '#e8e8f0',
        primaryBorderColor: '#3b3c47',
        lineColor: '#6b6c7a',
        secondaryColor: '#1e1f24',
        tertiaryColor: '#2b2c33',
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '13px',
      },
      securityLevel: 'strict',
    })
    mermaidLoaded = true
    return mermaid
  })
  return mermaidLoadPromise
}

export default function MermaidBlock({ code }: MermaidBlockProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const uid = useId().replace(/:/g, '_')
  const [status, setStatus] = useState<'idle' | 'rendering' | 'done' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (!code.trim()) return
    setStatus('rendering')
    setErrorMsg('')

    getMermaid().then(async (mermaid) => {
      try {
        const id = `mermaid_${uid}_${Date.now()}`
        const { svg } = await mermaid.render(id, code.trim())
        if (containerRef.current) {
          containerRef.current.innerHTML = svg
          // Make SVG responsive
          const svgEl = containerRef.current.querySelector('svg')
          if (svgEl) {
            svgEl.removeAttribute('height')
            svgEl.style.maxWidth = '100%'
            svgEl.style.height = 'auto'
          }
          setStatus('done')
        }
      } catch (err: any) {
        setStatus('error')
        setErrorMsg(err.message || 'Invalid diagram syntax')
      }
    }).catch(err => {
      setStatus('error')
      setErrorMsg('Failed to load Mermaid: ' + err.message)
    })
  }, [code])

  if (!code.trim()) return null

  if (status === 'error') {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/8 p-3 my-2">
        <div className="flex items-center gap-2 mb-1">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-400 shrink-0">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <span className="text-xs font-medium text-red-400">Diagram Error</span>
        </div>
        <p className="text-xs text-red-300/80 font-mono">{errorMsg}</p>
        <details className="mt-2">
          <summary className="text-xs text-white-30 cursor-pointer">Show source</summary>
          <pre className="text-xs text-white-40 mt-1 overflow-x-auto">{code}</pre>
        </details>
      </div>
    )
  }

  if (status === 'rendering' || status === 'idle') {
    return (
      <div className="flex items-center gap-2 py-3 text-xs text-white-40">
        <div className="w-3.5 h-3.5 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
        Rendering diagram…
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="mermaid-container my-2 overflow-x-auto rounded-lg bg-surface-sunken p-3 border border-line"
    />
  )
}
