import { app, BrowserWindow, ipcMain, globalShortcut, shell, screen, dialog } from 'electron'
import { join, resolve, normalize, extname } from 'path'
import { homedir } from 'os'
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, statSync } from 'fs'

// ─── Simple JSON store (avoids electron-store ESM/CJS issues) ────────────────
class SimpleStore {
  private data: Record<string, unknown> = {}
  private file: string
  constructor(name: string) {
    const dir = join(app.getPath('userData'))
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    this.file = join(dir, `${name}.json`)
    try { this.data = JSON.parse(readFileSync(this.file, 'utf-8')) } catch {}
  }
  get(key: string, def?: unknown): unknown {
    return key in this.data ? this.data[key] : def
  }
  set(key: string, value: unknown): void {
    this.data[key] = value; this._save()
  }
  delete(key: string): void {
    delete this.data[key]; this._save()
  }
  clear(): void { this.data = {}; this._save() }
  get store(): Record<string, unknown> { return this.data }
  private _save(): void {
    try { writeFileSync(this.file, JSON.stringify(this.data, null, 2)) } catch {}
  }
}

const BACKEND_URL = 'https://api.interviewpilot.in/api/v1'
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

// ─── Persistent Store ─────────────────────────────────────────────────────────
let store: SimpleStore  // initialized after app.ready

let mainWindow: BrowserWindow | null = null
let overlayWindow: BrowserWindow | null = null

// ─── Main Window ──────────────────────────────────────────────────────────────
function createMainWindow() {
  const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize

  mainWindow = new BrowserWindow({
    width: 900,
    height: 650,
    minWidth: 760,
    minHeight: 520,
    x: Math.round(sw / 2 - 450),
    y: Math.round(sh / 2 - 325),
    show: false,
    backgroundColor: '#0f0f13',
    frame: false,
    titleBarStyle: 'hidden',
    title: 'InterviewPilot',
    icon: join(__dirname, '../public/logo.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: join(__dirname, 'preload.js'),
      backgroundThrottling: false,
      webSecurity: true,
      sandbox: true,
    },
  })

  mainWindow.setMenu(null)

  // Content protection: request OS-level exclusion from screen capture.
  // On supported Windows configurations this hides the window content from
  // DWM-based capture (e.g. Windows Game Bar, some OBS configurations).
  // Physical cameras, remote-desktop software, and hardware capture devices
  // are NOT blocked — see docs/content-protection-limitations.md.
  try { mainWindow.setContentProtection(true) } catch { /* unsupported — no-op */ }

  // Security: deny child windows and route valid external links through default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const parsed = new URL(url)
      if (parsed.protocol === 'https:') shell.openExternal(url)
    } catch {}
    return { action: 'deny' }
  })

  // Security: block top-level navigation away from the app
  mainWindow.webContents.on('will-navigate', (event, navUrl) => {
    if (!navUrl.startsWith('file://') && !navUrl.startsWith('http://localhost:5173')) {
      event.preventDefault()
      try {
        const parsed = new URL(navUrl)
        if (parsed.protocol === 'https:') shell.openExternal(navUrl)
      } catch {}
    }
  })

  // Security: disable DevTools in production
  if (!isDev) {
    mainWindow.webContents.on('devtools-opened', () => {
      mainWindow?.webContents.closeDevTools()
    })
  }

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(join(__dirname, '../../dist/renderer/index.html'))
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
    mainWindow?.focus()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
    overlayWindow?.destroy()
    overlayWindow = null
  })

  return mainWindow
}

// Track always-on-top pinned state separately so it survives hide/show
let overlayPinned = true

// ─── Overlay Window ───────────────────────────────────────────────────────────
function createOverlayWindow() {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.show()
    return overlayWindow
  }

  // Use primary display; re-creation after a display change picks up the new size
  const primaryDisplay = screen.getPrimaryDisplay()
  const { width: sw, height: sh } = primaryDisplay.bounds

  overlayWindow = new BrowserWindow({
    width: sw,
    height: sh,
    x: primaryDisplay.bounds.x,
    y: primaryDisplay.bounds.y,
    show: false,
    transparent: true,
    backgroundColor: '#00000000',
    frame: false,
    // alwaysOnTop is managed dynamically via setAlwaysOnTop below
    alwaysOnTop: overlayPinned,
    skipTaskbar: true,
    // resizable must be false for full-screen transparent overlay; the inner
    // panel handles its own sizing via pointer-events drag logic in the renderer.
    resizable: false,
    hasShadow: false,
    // focusable: false lets clicks pass through to apps below
    focusable: false,
    acceptFirstMouse: true,
    fullscreenable: false,
    minimizable: false,
    // closable: true — "End Session" in the renderer calls window:closeOverlay
    closable: true,
    title: 'InterviewPilot Overlay',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: join(__dirname, 'preload.js'),
      backgroundThrottling: false,
    },
  })

  // Overlay always-on-top: 'screen-saver' level keeps it above fullscreen apps
  // on Windows. Level 1 is the z-order sub-level within that level.
  if (overlayPinned) {
    overlayWindow.setAlwaysOnTop(true, 'screen-saver', 1)
  }
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  overlayWindow.setIgnoreMouseEvents(true, { forward: true })
  overlayWindow.setMenu(null)

  // Content protection for overlay — same semantics as main window.
  try { overlayWindow.setContentProtection(true) } catch { /* unsupported — no-op */ }

  // Security: deny child windows and route valid external links through default browser
  overlayWindow.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const parsed = new URL(url)
      if (parsed.protocol === 'https:') shell.openExternal(url)
    } catch {}
    return { action: 'deny' }
  })

  // Security: block top-level navigation away from the app
  overlayWindow.webContents.on('will-navigate', (event, navUrl) => {
    if (!navUrl.startsWith('file://') && !navUrl.startsWith('http://localhost:5173')) {
      event.preventDefault()
    }
  })

  // Security: disable DevTools in production
  if (!isDev) {
    overlayWindow.webContents.on('devtools-opened', () => {
      overlayWindow?.webContents.closeDevTools()
    })
  }

  if (isDev) {
    overlayWindow.loadURL('http://localhost:5173/#/overlay')
  } else {
    overlayWindow.loadFile(join(__dirname, '../../dist/renderer/index.html'), { hash: '/overlay' })
  }

  overlayWindow.on('closed', () => { overlayWindow = null })
  return overlayWindow
}

// ─── IPC: Window Controls ─────────────────────────────────────────────────────
const handleMinimize = () => mainWindow?.minimize()
const handleMaximize = () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize()
  else mainWindow?.maximize()
}
const handleClose = () => mainWindow?.close()

ipcMain.on('window:minimize', handleMinimize)
ipcMain.handle('window:minimize', handleMinimize)
ipcMain.on('window:maximize', handleMaximize)
ipcMain.handle('window:maximize', handleMaximize)
ipcMain.on('window:close', handleClose)
ipcMain.handle('window:close', handleClose)

ipcMain.handle('window:setTitle', (_e, title: string) => mainWindow?.setTitle(title))
ipcMain.handle('app:getVersion', () => app.getVersion())
ipcMain.handle('app:isVisible', () => mainWindow?.isVisible() ?? false)
ipcMain.handle('app:relaunch', () => { app.relaunch(); app.quit() })
ipcMain.handle('window:isMaximized', () => mainWindow?.isMaximized() ?? false)

// ─── IPC: Overlay ─────────────────────────────────────────────────────────────
ipcMain.handle('window:openOverlay', async () => {
  const ow = createOverlayWindow()
  ow.show()
  mainWindow?.webContents.send('overlay:opened')
  return true
})

ipcMain.handle('window:closeOverlay', () => {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    // destroy instead of hide so the window is fully gone ("End Session" flow)
    overlayWindow.destroy()
    overlayWindow = null
    mainWindow?.webContents.send('overlay:closed')
  }
})

ipcMain.handle('window:toggleVisibility', () => {
  if (!overlayWindow || overlayWindow.isDestroyed()) {
    const ow = createOverlayWindow()
    ow.show()
    return true
  }
  if (overlayWindow.isVisible()) {
    overlayWindow.hide()
    return false
  } else {
    overlayWindow.show()
    return true
  }
})

ipcMain.handle('window:isStealthEnabled', () =>
  overlayWindow ? !overlayWindow.isDestroyed() && overlayWindow.isVisible() : false
)

// ─── IPC: Overlay Pin / Unpin (always-on-top toggle) ──────────────────────────
ipcMain.handle('overlay:setAlwaysOnTop', (_e, pinned: boolean) => {
  overlayPinned = pinned
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    if (pinned) {
      overlayWindow.setAlwaysOnTop(true, 'screen-saver', 1)
    } else {
      overlayWindow.setAlwaysOnTop(false)
    }
  }
  return overlayPinned
})

ipcMain.handle('overlay:getPinned', () => overlayPinned)

ipcMain.on('window:set-ignore-mouse-events', (_e, ignore: boolean, opts?: { forward: boolean }) => {
  overlayWindow?.setIgnoreMouseEvents(ignore, opts)
})

ipcMain.on('window:set-interactive-rects', () => { /* simplified */ })
ipcMain.on('window:set-viewport-size', () => { /* handled on renderer side */ })
ipcMain.on('window:expand', () => overlayWindow?.show())
ipcMain.on('window:shrink', () => overlayWindow?.hide())
ipcMain.on('window:resync-mouse-capture', () => { /* noop */ })
ipcMain.handle('window:get-cursor-point', () => {
  const { x, y } = screen.getCursorScreenPoint()
  return { x, y }
})

// ─── IPC: System ──────────────────────────────────────────────────────────────
ipcMain.handle('system:openExternal', (_e, rawUrl: string) => {
  try {
    if (!rawUrl || typeof rawUrl !== 'string') return false
    const parsed = new URL(rawUrl)
    // Security: Only allow https protocol to prevent command injection and protocol spoofing
    if (parsed.protocol === 'https:') {
      shell.openExternal(parsed.href)
      return true
    }
    return false
  } catch {
    return false
  }
})

ipcMain.handle('system:getSystemInfo', () => ({
  platform: process.platform,
  version: app.getVersion(),
  electron: process.versions.electron,
  node: process.versions.node,
  arch: process.arch,
}))

// ─── IPC: Clipboard ───────────────────────────────────────────────────────────
const { clipboard } = require('electron')
ipcMain.handle('clipboard:readText', () => clipboard.readText())
ipcMain.handle('clipboard:writeText', (_e, text: string) => clipboard.writeText(text))

// ─── IPC: Settings ────────────────────────────────────────────────────────────
const DEFAULT_SETTINGS = {
  ai: { model: 'openai/gpt-4o-mini', defaultResponseMode: 'explain', apiKey: '' },
  stt: { provider: 'browser', apiKey: '', language: 'en-US' },
  overlay: { theme: 'dark', opacity: 1, position: { x: 20, y: 60 }, size: { width: 420, height: 580 }, alwaysOnTop: true },
}

ipcMain.handle('settings:load', () => {
  const saved = store.get('settings') as Record<string, unknown> | undefined
  return saved ? deepMerge(DEFAULT_SETTINGS as any, saved as any) : DEFAULT_SETTINGS
})

ipcMain.handle('settings:update', (_e, update: unknown) => {
  const current = (store.get('settings') as any) || DEFAULT_SETTINGS
  const next = deepMerge(current, update as any)
  store.set('settings', next)
  return next
})

ipcMain.handle('settings:batchUpdate', (_e, updates: unknown[]) => {
  const current = (store.get('settings') as any) || DEFAULT_SETTINGS
  const next = (updates as any[]).reduce((acc, u) => deepMerge(acc, u), current)
  store.set('settings', next)
  return next
})

ipcMain.handle('local-settings:get', (_e, key: string) => store.get(key))
ipcMain.handle('local-settings:set', (_e, key: string, value: unknown) => { store.set(key, value); return true })
ipcMain.handle('local-settings:getAll', () => store.store)
ipcMain.handle('local-settings:reset', () => {
  store.clear()
  return true
})

// ─── IPC: Auth ────────────────────────────────────────────────────────────────
ipcMain.handle('auth:get-tokens', () => store.get('auth_data') ?? null)
ipcMain.handle('auth:store-tokens', (_e, tokens: unknown, user: unknown) => {
  store.set('auth_data', { tokens, user })
  return { success: true }
})
ipcMain.handle('auth:clear-tokens', () => { store.delete('auth_data'); return { success: true } })
ipcMain.handle('auth:getAuthState', () => {
  const data = store.get('auth_data') as any
  return { isAuthenticated: !!data?.tokens, user: data?.user ?? null }
})
ipcMain.handle('auth:open-login', () =>
  shell.openExternal('https://www.interviewpilot.in/auth/login?source=desktop')
)
ipcMain.handle('auth:open-register', () =>
  shell.openExternal('https://www.interviewpilot.in/auth/register?source=desktop')
)
ipcMain.handle('auth:logout', () => { store.delete('auth_data'); return { success: true } })

// ─── IPC: Interview Session Data ──────────────────────────────────────────────
const sessionData = new Map<string, unknown>()
ipcMain.handle('interview:getSessionData', (_e, key: string) => sessionData.get(key) ?? null)
ipcMain.handle('interview:setSessionData', (_e, key: string, value: unknown) => { sessionData.set(key, value); return true })
ipcMain.handle('interview:clearSessionData', () => { sessionData.clear(); return true })

// ─── IPC: Session History (local) ─────────────────────────────────────────────
ipcMain.handle('history:getAll', () => store.get('session_history', []))
ipcMain.handle('history:save', (_e, session: unknown) => {
  const history = (store.get('session_history', []) as any[])
  history.unshift(session)
  store.set('session_history', history.slice(0, 100))
  return true
})
ipcMain.handle('history:delete', (_e, id: string) => {
  const history = (store.get('session_history', []) as any[]).filter((s: any) => s.id !== id)
  store.set('session_history', history)
  return true
})
ipcMain.handle('history:clear', () => { store.set('session_history', []); return true })

// ─── IPC: Theme ───────────────────────────────────────────────────────────────
ipcMain.handle('theme:get', () => store.get('theme', 'dark'))
ipcMain.handle('theme:set', (_e, theme: string) => { store.set('theme', theme); return theme })
ipcMain.handle('theme:toggle', () => {
  const current = store.get('theme', 'dark') as string
  const next = current === 'dark' ? 'light' : 'dark'
  store.set('theme', next)
  mainWindow?.webContents.send('theme:update', next)
  overlayWindow?.webContents.send('theme:update', next)
  return next
})
ipcMain.handle('theme:syncSystem', () => { store.set('theme', 'system'); return 'system' })

// ─── IPC: Screenshot ─────────────────────────────────────────────────────────
ipcMain.handle('capture-screenshot', async () => {
  try {
    const { desktopCapturer } = require('electron')
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 1920, height: 1080 },
    })
    if (sources.length > 0) {
      return sources[0].thumbnail.toDataURL()
    }
    return null
  } catch (e) {
    console.error('[Screenshot] Failed:', e)
    return null
  }
})

ipcMain.handle('desktop:getSources', async (_e, opts: any) => {
  try {
    const { desktopCapturer } = require('electron')
    return await desktopCapturer.getSources(opts || { types: ['screen', 'window'] })
  } catch {
    return []
  }
})

// ─── IPC: File Storage ────────────────────────────────────────────────────────
const ALLOWED_FILE_EXTS = new Set(['.pdf', '.docx', '.txt', '.md', '.json', '.csv'])
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024 // 5 MB

ipcMain.handle('storage:getCommonDirs', () => ({
  home: homedir(),
  documents: join(homedir(), 'Documents'),
  downloads: join(homedir(), 'Downloads'),
  desktop: join(homedir(), 'Desktop'),
}))

ipcMain.handle('storage:listDir', async (_e, dirPath: string) => {
  try {
    if (!dirPath || typeof dirPath !== 'string' || dirPath.includes('\0')) {
      return { error: 'Invalid directory path' }
    }
    const normalized = normalize(resolve(dirPath))
    const entries = readdirSync(normalized, { withFileTypes: true })
    return entries.map(e => ({ name: e.name, isDir: e.isDirectory(), path: join(normalized, e.name) }))
  } catch (err: any) {
    return { error: err.message }
  }
})

ipcMain.handle('storage:readFile', async (_e, filePath: string) => {
  try {
    if (!filePath || typeof filePath !== 'string' || filePath.includes('\0')) {
      return { error: 'Invalid file path' }
    }
    const normalized = normalize(resolve(filePath))
    const ext = extname(normalized).toLowerCase()
    if (!ALLOWED_FILE_EXTS.has(ext)) {
      return { error: `File type '${ext}' is not permitted for upload` }
    }
    if (!existsSync(normalized)) {
      return { error: 'File does not exist' }
    }
    const stat = statSync(normalized)
    if (!stat.isFile()) {
      return { error: 'Specified path is not a file' }
    }
    if (stat.size > MAX_FILE_SIZE_BYTES) {
      return { error: 'File size exceeds maximum permitted limit of 5 MB' }
    }
    return { content: readFileSync(normalized, 'utf-8'), size: stat.size }
  } catch (err: any) {
    return { error: 'Failed to read file: ' + err.message }
  }
})

ipcMain.handle('storage:selectDocumentFile', async () => {
  const r = await dialog.showOpenDialog({ properties: ['openFile'], filters: [{ name: 'Documents', extensions: ['pdf', 'docx', 'txt', 'md'] }] })
  return r.canceled ? null : r.filePaths[0]
})

ipcMain.handle('storage:selectResumeFile', async () => {
  const r = await dialog.showOpenDialog({ properties: ['openFile'], filters: [{ name: 'Resume', extensions: ['pdf', 'docx', 'txt'] }] })
  return r.canceled ? null : r.filePaths[0]
})

ipcMain.handle('storage:selectFileStealth', async () => {
  const r = await dialog.showOpenDialog({ properties: ['openFile'] })
  return r.canceled ? null : r.filePaths[0]
})

// ─── IPC: API Proxy ───────────────────────────────────────────────────────────
const ALLOWED_API_PATHS = ['/auth/', '/profile', '/interviews', '/meetings', '/ai/', '/usage', '/plans']
const ALLOWED_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete'])

ipcMain.handle('api:request', async (_e, { path, method, body, headers }: any) => {
  if (!path || typeof path !== 'string' || path.includes('..') ||
      !ALLOWED_API_PATHS.some(p => path.startsWith(p))) {
    return { error: { code: 'FORBIDDEN', message: 'Path not allowed', retryable: false } }
  }
  const m = (method || 'GET').toLowerCase()
  if (!ALLOWED_METHODS.has(m)) return { error: { code: 'FORBIDDEN', message: 'Method not allowed', retryable: false } }

  const authData = store.get('auth_data') as any
  const accessToken = authData?.tokens?.accessToken
  try {
    const https = require('https')
    const url = new URL(`${BACKEND_URL}${path}`)
    return await new Promise((resolve) => {
      const reqHeaders: any = { 'Content-Type': 'application/json', 'User-Agent': 'InterviewPilot-Clone/1.5.0' }
      if (accessToken) reqHeaders['Authorization'] = `Bearer ${accessToken}`
      const bodyStr = body ? JSON.stringify(body) : undefined
      if (bodyStr) reqHeaders['Content-Length'] = Buffer.byteLength(bodyStr)
      const req = https.request({ hostname: url.hostname, path: url.pathname + url.search, method: m.toUpperCase(), headers: reqHeaders }, (res: any) => {
        let data = ''
        res.on('data', (chunk: any) => data += chunk)
        res.on('end', () => {
          try { resolve(JSON.parse(data)) }
          catch { resolve({ error: { code: 'PARSE_ERROR', message: 'Invalid JSON response', retryable: false } }) }
        })
      })
      req.on('error', (e: any) => resolve({ error: { code: 'NETWORK_ERROR', message: e.message, retryable: true } }))
      if (bodyStr) req.write(bodyStr)
      req.end()
    })
  } catch (e: any) {
    return { error: { code: 'NETWORK_ERROR', message: e.message, retryable: true } }
  }
})

// ─── IPC: Usage / Profile ─────────────────────────────────────────────────────
ipcMain.handle('usage:drain', () => ({ used: 0, limit: -1 }))
ipcMain.handle('profile:load', () => store.get('profile', null))
ipcMain.handle('profile:uploadResume', () => ({ success: true }))
ipcMain.handle('error:log', (_e, err: unknown) => console.error('[renderer error]', err))
ipcMain.handle('virtual-mouse-state', () => ({ active: false }))
ipcMain.handle('update:quitAndInstall', () => { app.quit() })

// ─── IPC: Audio (mock/stub — real impl requires native binaries) ────────────
ipcMain.handle('audio:getDevices', () => [{ id: 'default', label: 'Default Microphone', kind: 'audioinput' }])
ipcMain.handle('audio:isActive', () => false)
ipcMain.handle('audio:startCapture', () => ({ success: false, error: 'Audio capture requires Deepgram API key in settings' }))
ipcMain.handle('audio:stopCapture', () => ({ success: true }))
ipcMain.handle('audio:startUserCapture', () => ({ success: false, error: 'STT: set Deepgram API key in Settings → AI & Models' }))
ipcMain.handle('audio:stopUserCapture', () => ({ success: true }))
ipcMain.handle('audio:switchDevice', () => ({ success: true }))
ipcMain.handle('audio:getActiveDevices', () => [])

// ─── IPC: Transcription ───────────────────────────────────────────────────────
ipcMain.handle('transcription:getSettings', () => store.get('transcription_settings', { provider: 'browser', language: 'en-US' }))
ipcMain.handle('transcription:updateSettings', (_e, s: unknown) => { store.set('transcription_settings', s); return true })
ipcMain.handle('transcription:getMode', () => store.get('transcription_mode', 'off'))
ipcMain.handle('transcription:setMode', (_e, mode: string) => { store.set('transcription_mode', mode); return mode })
ipcMain.handle('transcription:toggle', () => {
  const cur = store.get('transcription_mode', 'off') as string
  const next = cur === 'off' ? 'browser' : 'off'
  store.set('transcription_mode', next)
  return next
})
ipcMain.handle('transcription:cycleMode', () => {
  const modes = ['off', 'browser', 'deepgram']
  const cur = store.get('transcription_mode', 'off') as string
  const next = modes[(modes.indexOf(cur) + 1) % modes.length]
  store.set('transcription_mode', next)
  return next
})
ipcMain.handle('transcription:addTranscript', (_e, text: string) => {
  mainWindow?.webContents.send('transcription:updated', text)
  return true
})
ipcMain.handle('transcription:clear', () => true)

// ─── Native Binaries & Cloaking Helper ────────────────────────────────────────
function getNativeBinaryPath(filename: string): string {
  try {
    if (app.isPackaged) {
      return join(process.resourcesPath, 'native', filename)
    }
    return join(app.getAppPath(), 'native', 'bin', filename)
  } catch {
    return join(__dirname, '../../native/bin', filename)
  }
}

ipcMain.handle('native:getBinaryPath', (_e, name: string) => {
  const p = getNativeBinaryPath(name)
  return { path: p, exists: existsSync(p) }
})

ipcMain.handle('native:status', () => {
  const appHook = getNativeBinaryPath('app_hook.dll')
  const dll1 = getNativeBinaryPath('Dll1.dll')
  const minhook = getNativeBinaryPath('MinHook.x64.dll')
  return {
    appHook: { path: appHook, exists: existsSync(appHook) },
    dll1: { path: dll1, exists: existsSync(dll1) },
    minhook: { path: minhook, exists: existsSync(minhook) },
    cloakingActive: true
  }
})

// ─── Shortcuts ────────────────────────────────────────────────────────────────
function registerGlobalShortcuts() {
  const shortcuts: [string, string][] = [
    ['CommandOrControl+Alt+H', 'shortcut:minimize'],
    ['CommandOrControl+M', 'shortcut:toggleContext'],
    ['CommandOrControl+Shift+A', 'shortcut:autoAnswer'],
    ['CommandOrControl+Shift+R', 'shortcut:regenerateResponse'],
    ['CommandOrControl+Shift+N', 'shortcut:newChat'],
    ['CommandOrControl+Alt+Left', 'shortcut:moveWindowLeft'],
    ['CommandOrControl+Alt+Right', 'shortcut:moveWindowRight'],
    ['CommandOrControl+Alt+Up', 'shortcut:moveWindowUp'],
    ['CommandOrControl+Alt+Down', 'shortcut:moveWindowDown'],
    ['CommandOrControl+1', 'shortcut:switchToConcise'],
    ['CommandOrControl+2', 'shortcut:switchToExplain'],
    ['CommandOrControl+3', 'shortcut:switchToStory'],
  ]
  for (const [key, event] of shortcuts) {
    try {
      globalShortcut.register(key, () => {
        mainWindow?.webContents.send(event)
        overlayWindow?.webContents.send(event)
      })
    } catch { /* ignore conflicting shortcuts */ }
  }
}

// ─── App Lifecycle ────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  store = new SimpleStore('interviewpilot-clone')
  createMainWindow()
  // Register shortcuts in both dev and packaged builds
  registerGlobalShortcuts()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })
})

app.on('window-all-closed', () => {
  globalShortcut.unregisterAll()
  if (process.platform !== 'darwin') app.quit()
})

app.on('will-quit', () => globalShortcut.unregisterAll())

// ─── Helpers ──────────────────────────────────────────────────────────────────
function deepMerge(base: any, override: any): any {
  const result = { ...base }
  for (const key in override) {
    const v = override[key]
    if (v !== null && typeof v === 'object' && !Array.isArray(v) && key in result && typeof result[key] === 'object') {
      result[key] = deepMerge(result[key], v)
    } else if (v !== undefined) {
      result[key] = v
    }
  }
  return result
}
