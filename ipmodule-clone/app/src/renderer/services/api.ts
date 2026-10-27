/**
 * API client — proxies requests through Electron IPC to avoid CORS issues.
 * Falls back to direct fetch in browser/dev mode.
 */

const BASE_URL = 'https://api.interviewpilot.in/api/v1'

const ipc = () => (window as any).electron?.ipcRenderer ?? null

function getTokens(): { accessToken?: string } {
  try {
    const stored = localStorage.getItem('ip_auth')
    if (stored) return JSON.parse(stored).tokens ?? {}
  } catch {}
  return {}
}

async function request<T>(
  path: string,
  method: string = 'GET',
  body?: unknown,
  extraHeaders?: Record<string, string>
): Promise<T> {
  const { accessToken } = getTokens()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    ...extraHeaders,
  }

  const r = ipc()
  if (r) {
    // Route through Electron IPC proxy (avoids CORS, handles auth)
    const result = await r.invoke('api:request', { path, method, body, headers })
    if (result?.error) throw new Error(result.error.message || 'API error')
    return result as T
  }

  // Direct fetch fallback (dev/browser mode)
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }))
    throw new Error(err.message || `HTTP ${res.status}`)
  }
  return res.json()
}

export const api = {
  get: <T>(path: string) => request<T>(path, 'GET'),
  post: <T>(path: string, body: unknown) => request<T>(path, 'POST', body),
  put: <T>(path: string, body: unknown) => request<T>(path, 'PUT', body),
  patch: <T>(path: string, body: unknown) => request<T>(path, 'PATCH', body),
  delete: <T>(path: string) => request<T>(path, 'DELETE'),
}

// ─── Interview Session Types (from bundle analysis) ────────────────────────
export interface Interview {
  id: string
  title: string
  type: 'technical' | 'behavioral' | 'meeting' | 'custom'
  language?: string
  status: 'active' | 'ended' | 'draft'
  createdAt: string
  updatedAt: string
  conversationCount?: number
}

export interface Conversation {
  id: string
  interviewId: string
  question: string
  response: string
  responseMode: 'concise' | 'explain' | 'story'
  model: string
  createdAt: string
  tokens?: number
}

export interface UserProfile {
  id: string
  email: string
  name: string
  avatar?: string
  plan: 'free' | 'pro' | 'premium'
  credits: number
  resumeUrl?: string
  bio?: string
}

// ─── Service functions (matching original service layer) ───────────────────
export const interviewService = {
  getAll: () => api.get<Interview[]>('/interviews'),
  getById: (id: string) => api.get<Interview>(`/interviews/${id}`),
  create: (data: Partial<Interview>) => api.post<Interview>('/interviews', data),
  update: (id: string, data: Partial<Interview>) => api.patch<Interview>(`/interviews/${id}`, data),
  delete: (id: string) => api.delete(`/interviews/${id}`),
  end: (id: string) => api.post(`/interviews/${id}/end`, {}),
  getConversations: (id: string) => api.get<Conversation[]>(`/interviews/${id}/conversations`),
}

export const profileService = {
  get: () => api.get<UserProfile>('/profile'),
  update: (data: Partial<UserProfile>) => api.patch<UserProfile>('/profile', data),
}

export const meetingService = {
  getAll: () => api.get<Interview[]>('/meetings'),
  getById: (id: string) => api.get<Interview>(`/meetings/${id}`),
}
