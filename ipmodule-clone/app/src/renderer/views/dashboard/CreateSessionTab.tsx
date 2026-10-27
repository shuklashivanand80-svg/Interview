/**
 * CreateSessionTab — "New Interview" screen
 * Matches Screenshot 1 from the original InterviewPilot application.
 *
 * Fields:
 *  - Target Company (required, e.g. Google)
 *  - Target Role (required, e.g. Software Engineer)
 *  - Job Description (optional, 0/5000 char counter)
 *  - Resume upload (optional, PDF/DOCX/TXT ≤5 MB) with "📁 1 v" dropdown selector
 *  - Background Brief upload (optional, ≤5 MB)
 *  - Continue button (bottom-right white pill button, disabled when required fields empty)
 */
import React, { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { SessionConfigData } from './ConfigurationTab'

const ipc = () => (window as any).electron?.ipcRenderer ?? null

const MAX_JD_CHARS = 5000
const MAX_FILE_BYTES = 5 * 1024 * 1024 // 5 MB

interface UploadedFile {
  name: string
  size: number
  path?: string
  dataUrl?: string
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

interface CreateSessionTabProps {
  initialData?: Partial<SessionConfigData>
  onContinue: (data: SessionConfigData) => void
}

export default function CreateSessionTab({ initialData, onContinue }: CreateSessionTabProps) {
  // Saved draft or initialData
  const savedDraft = (() => {
    try { return JSON.parse(localStorage.getItem('ip_session_config') || '{}') } catch { return {} }
  })()

  const [company, setCompany] = useState(initialData?.company ?? savedDraft?.company ?? '')
  const [role, setRole]       = useState(initialData?.role ?? savedDraft?.role ?? '')
  const [jd, setJD]           = useState(initialData?.jd ?? savedDraft?.jd ?? '')
  const [resume, setResume]   = useState<UploadedFile | null>(initialData?.resume ?? savedDraft?.resume ?? null)
  const [brief, setBrief]     = useState<UploadedFile | null>(initialData?.brief ?? savedDraft?.brief ?? null)
  const [errors, setErrors]   = useState<Record<string, string>>({})
  const [showSavedResumes, setShowSavedResumes] = useState(false)

  const resumeInputRef = useRef<HTMLInputElement>(null)
  const briefInputRef  = useRef<HTMLInputElement>(null)

  // Auto-save draft so navigation preserves data
  useEffect(() => {
    const draft: SessionConfigData = {
      company,
      role,
      jd,
      resume: resume ? { name: resume.name, size: resume.size, path: resume.path } : null,
      brief:  brief  ? { name: brief.name,  size: brief.size,  path: brief.path  } : null,
      answerStyle: savedDraft?.answerStyle || 'on-the-point',
      language: savedDraft?.language || 'auto',
      autoAnswer: savedDraft?.autoAnswer ?? false,
    }
    localStorage.setItem('ip_session_config', JSON.stringify(draft))
  }, [company, role, jd, resume, brief])

  // ── Validation ──────────────────────────────────────────────────────────────
  const validate = () => {
    const e: Record<string, string> = {}
    if (!company.trim()) e.company = 'Target company is required.'
    if (!role.trim())    e.role    = 'Target role is required.'
    if (jd.length > MAX_JD_CHARS) e.jd = `Job description must be ≤ ${MAX_JD_CHARS} characters.`
    return e
  }

  // ── File selection helpers ───────────────────────────────────────────────────
  const pickFileElectron = useCallback(async (type: 'resume' | 'brief') => {
    const r = ipc()
    if (!r) return null
    const path: string | null = type === 'resume'
      ? await r.invoke('storage:selectResumeFile').catch(() => null)
      : await r.invoke('storage:selectDocumentFile').catch(() => null)
    if (!path) return null
    const result = await r.invoke('storage:readFile', path).catch(() => null)
    if (result?.error) { alert(`Cannot read file: ${result.error}`); return null }
    const name = path.split(/[\\/]/).pop() || path
    const size = new TextEncoder().encode(result?.content || '').length
    if (size > MAX_FILE_BYTES) { alert(`File too large. Maximum is 5 MB.`); return null }
    return { name, size, path } as UploadedFile
  }, [])

  const handleResumePick = async () => {
    if (ipc()) {
      const f = await pickFileElectron('resume')
      if (f) setResume(f)
    } else {
      resumeInputRef.current?.click()
    }
  }

  const handleBriefPick = async () => {
    if (ipc()) {
      const f = await pickFileElectron('brief')
      if (f) setBrief(f)
    } else {
      briefInputRef.current?.click()
    }
  }

  const handleResumeFileBrowser = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > MAX_FILE_BYTES) { alert('File too large. Maximum is 5 MB.'); return }
    const allowed = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain']
    if (!allowed.includes(file.type) && !file.name.match(/\.(pdf|docx|txt)$/i)) {
      alert('Unsupported file type. Please upload PDF, DOCX, or TXT.')
      return
    }
    const reader = new FileReader()
    reader.onload = ev => setResume({ name: file.name, size: file.size, dataUrl: ev.target?.result as string })
    reader.readAsDataURL(file)
  }

  const handleBriefFileBrowser = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > MAX_FILE_BYTES) { alert('File too large. Maximum is 5 MB.'); return }
    const reader = new FileReader()
    reader.onload = ev => setBrief({ name: file.name, size: file.size, dataUrl: ev.target?.result as string })
    reader.readAsDataURL(file)
  }

  // ── Continue to Configuration screen ─────────────────────────────────────────
  const handleContinue = () => {
    const v = validate()
    setErrors(v)
    if (Object.keys(v).length > 0) return

    const sessionData: SessionConfigData = {
      company: company.trim(),
      role: role.trim(),
      jd: jd.trim(),
      resume: resume ? { name: resume.name, size: resume.size, path: resume.path } : null,
      brief:  brief  ? { name: brief.name,  size: brief.size,  path: brief.path  } : null,
      answerStyle: savedDraft?.answerStyle || 'on-the-point',
      language: savedDraft?.language || 'auto',
      autoAnswer: savedDraft?.autoAnswer ?? false,
    }
    onContinue(sessionData)
  }

  const canContinue = company.trim().length > 0 && role.trim().length > 0

  return (
    <div className="h-full flex flex-col overflow-hidden bg-surface-base text-white-90">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="px-8 pt-7 pb-4 shrink-0 border-b border-line-subtle">
        <h1 className="text-2xl font-bold text-white tracking-tight">New Interview</h1>
        <p className="text-xs text-white-40 mt-1 font-medium">Start a new interview by providing basic details.</p>
      </div>

      {/* ── Form Body ───────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">

        {/* Target Company + Target Role (2 columns) */}
        <div className="grid grid-cols-2 gap-5">
          <div>
            <label className="block text-[10px] font-bold tracking-widest uppercase text-white-50 mb-2">
              TARGET COMPANY <span className="text-emerald-400">*</span>
            </label>
            <input
              id="target-company"
              type="text"
              value={company}
              onChange={e => { setCompany(e.target.value); setErrors(p => ({ ...p, company: '' })) }}
              placeholder="e.g. Google"
              className={`w-full rounded-2xl border px-4 py-3.5 text-sm text-white bg-surface-raised placeholder:text-white-30 focus:outline-none transition-colors ${
                errors.company ? 'border-red-500/70 focus:border-red-500' : 'border-line focus:border-emerald-500/60'
              }`}
            />
            {errors.company && <p className="text-[11px] text-red-400 mt-1.5 font-medium">{errors.company}</p>}
          </div>

          <div>
            <label className="block text-[10px] font-bold tracking-widest uppercase text-white-50 mb-2">
              TARGET ROLE <span className="text-emerald-400">*</span>
            </label>
            <input
              id="target-role"
              type="text"
              value={role}
              onChange={e => { setRole(e.target.value); setErrors(p => ({ ...p, role: '' })) }}
              placeholder="e.g. Software Engineer"
              className={`w-full rounded-2xl border px-4 py-3.5 text-sm text-white bg-surface-raised placeholder:text-white-30 focus:outline-none transition-colors ${
                errors.role ? 'border-red-500/70 focus:border-red-500' : 'border-line focus:border-emerald-500/60'
              }`}
            />
            {errors.role && <p className="text-[11px] text-red-400 mt-1.5 font-medium">{errors.role}</p>}
          </div>
        </div>

        {/* Job Description */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="flex items-center gap-2 text-[10px] font-bold tracking-widest uppercase text-white-50">
              JOB DESCRIPTION
              <span className="px-2 py-0.5 rounded bg-surface-strong border border-line text-[9px] font-bold text-white-40 tracking-normal normal-case">
                OPTIONAL
              </span>
              <InfoTip text="Paste the job description to get tailored interview context and questions." />
            </label>
            <span className={`text-[10px] font-mono ${jd.length > MAX_JD_CHARS * 0.9 ? 'text-amber-400' : 'text-white-30'}`}>
              {jd.length}/{MAX_JD_CHARS}
            </span>
          </div>
          <textarea
            id="job-description"
            value={jd}
            onChange={e => { if (e.target.value.length <= MAX_JD_CHARS) { setJD(e.target.value); setErrors(p => ({ ...p, jd: '' })) } }}
            placeholder="Paste the job description here (optional)..."
            rows={5}
            className={`w-full rounded-2xl border px-4 py-3.5 text-sm text-white bg-surface-raised placeholder:text-white-30 focus:outline-none resize-none transition-colors ${
              errors.jd ? 'border-red-500/70' : 'border-line focus:border-emerald-500/60'
            }`}
          />
          {errors.jd && <p className="text-[11px] text-red-400 mt-1.5 font-medium">{errors.jd}</p>}
        </div>

        {/* Resume + Background Brief (2 columns) */}
        <div className="grid grid-cols-2 gap-5">

          {/* Resume Card */}
          <div>
            <label className="flex items-center gap-2 text-[10px] font-bold tracking-widest uppercase text-white-50 mb-2">
              RESUME
              <span className="px-2 py-0.5 rounded bg-surface-strong border border-line text-[9px] font-bold text-white-40 tracking-normal normal-case">
                OPTIONAL
              </span>
              <InfoTip text="Upload your resume. PDF, DOCX, or TXT up to 5 MB." />
            </label>

            <div className="rounded-2xl border border-line bg-surface-raised p-4 flex items-center justify-between shadow-sm min-h-[76px]">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-surface-strong flex items-center justify-center text-white-60 shrink-0">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  {resume ? (
                    <div>
                      <p className="text-xs font-bold text-white truncate max-w-[170px]">{resume.name}</p>
                      <p className="text-[10px] text-emerald-400 font-semibold">{formatBytes(resume.size)} · Ready</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-xs font-bold text-white-70">Add your resume</p>
                      <p className="text-[10px] text-white-30">PDF, DOCX or TXT · up to 5 M...</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-1.5 shrink-0 ml-2">
                <button
                  id="resume-upload-btn"
                  onClick={handleResumePick}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-strong hover:bg-surface-hover border border-line-strong text-white text-xs font-semibold transition-all shadow-sm"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                  Upload
                </button>

                {/* Dropdown / saved count indicator */}
                <div className="relative">
                  <button
                    onClick={() => setShowSavedResumes(v => !v)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-surface-strong hover:bg-surface-hover border border-line text-white-60 hover:text-white text-xs font-medium transition-all"
                    title="Saved Resumes"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                    </svg>
                    <span>1</span>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="6 9 12 15 18 9"/>
                    </svg>
                  </button>

                  {showSavedResumes && (
                    <div className="absolute right-0 top-full mt-2 w-48 bg-surface-raised border border-line-strong rounded-xl shadow-xl z-20 p-2">
                      <p className="text-[10px] font-bold text-white-40 uppercase px-2 py-1">Saved Resumes</p>
                      <button
                        onClick={() => {
                          setResume({ name: 'Default_Resume.pdf', size: 142000 })
                          setShowSavedResumes(false)
                        }}
                        className="w-full text-left px-2 py-1.5 rounded text-xs text-white-80 hover:bg-surface-hover flex items-center justify-between"
                      >
                        <span className="truncate">Default_Resume.pdf</span>
                        <span className="text-[10px] text-white-40">142 KB</span>
                      </button>
                    </div>
                  )}
                </div>

                {resume && (
                  <button
                    onClick={() => setResume(null)}
                    title="Remove file"
                    className="p-1.5 text-white-30 hover:text-red-400 transition-colors"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                )}
              </div>
            </div>
            <input ref={resumeInputRef} type="file" accept=".pdf,.docx,.txt" onChange={handleResumeFileBrowser} className="hidden" />
          </div>

          {/* Background Brief Card */}
          <div>
            <label className="flex items-center gap-2 text-[10px] font-bold tracking-widest uppercase text-white-50 mb-2">
              BACKGROUND BRIEF
              <span className="px-2 py-0.5 rounded bg-surface-strong border border-line text-[9px] font-bold text-white-40 tracking-normal normal-case">
                OPTIONAL
              </span>
              <InfoTip text="Add a cover letter, statement or background notes up to 5 MB." />
            </label>

            <div className="rounded-2xl border border-line bg-surface-raised p-4 flex items-center justify-between shadow-sm min-h-[76px]">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-surface-strong flex items-center justify-center text-white-60 shrink-0">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  {brief ? (
                    <div>
                      <p className="text-xs font-bold text-white truncate max-w-[170px]">{brief.name}</p>
                      <p className="text-[10px] text-emerald-400 font-semibold">{formatBytes(brief.size)} · Ready</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-xs font-bold text-white-70">Add a background brief</p>
                      <p className="text-[10px] text-white-30">Cover letter, statement or notes · up to 5 MB</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-1.5 shrink-0 ml-2">
                <button
                  id="brief-upload-btn"
                  onClick={handleBriefPick}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-strong hover:bg-surface-hover border border-line-strong text-white text-xs font-semibold transition-all shadow-sm"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                  Upload
                </button>

                {brief && (
                  <button
                    onClick={() => setBrief(null)}
                    title="Remove file"
                    className="p-1.5 text-white-30 hover:text-red-400 transition-colors"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                )}
              </div>
            </div>
            <input ref={briefInputRef} type="file" accept=".pdf,.docx,.txt,.md" onChange={handleBriefFileBrowser} className="hidden" />
          </div>

        </div>

      </div>

      {/* ── Footer — Continue Button ─────────────────────────────────── */}
      <div className="px-8 py-5 border-t border-line-subtle shrink-0 flex justify-end">
        <button
          id="continue-btn"
          onClick={handleContinue}
          disabled={!canContinue}
          className="flex items-center gap-2.5 px-8 py-3 rounded-xl bg-white hover:bg-white/90 disabled:opacity-40 disabled:cursor-not-allowed text-surface-base text-sm font-bold shadow-lg hover:shadow-xl transition-all"
        >
          Continue
        </button>
      </div>
    </div>
  )
}

function InfoTip({ text }: { text: string }) {
  const [show, setShow] = useState(false)
  return (
    <span className="relative inline-flex items-center">
      <button
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        className="w-3.5 h-3.5 rounded-full border border-white-30 flex items-center justify-center text-white-40 hover:text-white-70 text-[9px] font-bold transition-colors"
        tabIndex={-1}
      >i</button>
      {show && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-48 text-[10px] text-white-70 bg-surface-strong border border-line rounded-lg px-2.5 py-1.5 z-50 leading-relaxed shadow-lg">
          {text}
        </span>
      )}
    </span>
  )
}
