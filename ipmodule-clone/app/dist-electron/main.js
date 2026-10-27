"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = require("path");
const os_1 = require("os");
const fs_1 = require("fs");
const electron_store_1 = __importDefault(require("electron-store"));
const BACKEND_URL = 'https://api.interviewpilot.in/api/v1';
const isDev = process.env.NODE_ENV === 'development' || !electron_1.app.isPackaged;
// ─── Persistent Store ─────────────────────────────────────────────────────────
const store = new electron_store_1.default({ name: 'interviewpilot-clone' });
let mainWindow = null;
let overlayWindow = null;
// ─── Main Window ──────────────────────────────────────────────────────────────
function createMainWindow() {
    const { width: sw, height: sh } = electron_1.screen.getPrimaryDisplay().workAreaSize;
    mainWindow = new electron_1.BrowserWindow({
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
        icon: (0, path_1.join)(__dirname, '../public/logo.png'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: (0, path_1.join)(__dirname, 'preload.js'),
            backgroundThrottling: false,
            webSecurity: true,
        },
    });
    mainWindow.setMenu(null);
    if (isDev) {
        mainWindow.loadURL('http://localhost:5173');
    }
    else {
        mainWindow.loadFile((0, path_1.join)(__dirname, '../dist/renderer/index.html'));
    }
    mainWindow.once('ready-to-show', () => {
        mainWindow?.show();
        mainWindow?.focus();
    });
    mainWindow.on('closed', () => {
        mainWindow = null;
        overlayWindow?.destroy();
        overlayWindow = null;
    });
    return mainWindow;
}
// ─── Overlay Window ───────────────────────────────────────────────────────────
function createOverlayWindow() {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
        overlayWindow.show();
        return overlayWindow;
    }
    const { width: sw, height: sh } = electron_1.screen.getPrimaryDisplay().bounds;
    overlayWindow = new electron_1.BrowserWindow({
        width: sw,
        height: sh,
        x: 0,
        y: 0,
        show: false,
        transparent: true,
        backgroundColor: '#00000000',
        frame: false,
        alwaysOnTop: true,
        skipTaskbar: true,
        resizable: false,
        hasShadow: false,
        focusable: false,
        acceptFirstMouse: true,
        fullscreenable: false,
        minimizable: false,
        closable: false,
        title: 'InterviewPilot Overlay',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: (0, path_1.join)(__dirname, 'preload.js'),
            backgroundThrottling: false,
        },
    });
    overlayWindow.setAlwaysOnTop(true, 'screen-saver', 1);
    overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    overlayWindow.setIgnoreMouseEvents(true, { forward: true });
    overlayWindow.setMenu(null);
    if (isDev) {
        overlayWindow.loadURL('http://localhost:5173/#/overlay');
    }
    else {
        overlayWindow.loadFile((0, path_1.join)(__dirname, '../dist/renderer/index.html'), { hash: '/overlay' });
    }
    overlayWindow.on('closed', () => { overlayWindow = null; });
    return overlayWindow;
}
// ─── IPC: Window Controls ─────────────────────────────────────────────────────
electron_1.ipcMain.on('window:minimize', () => mainWindow?.minimize());
electron_1.ipcMain.on('window:maximize', () => {
    if (mainWindow?.isMaximized())
        mainWindow.unmaximize();
    else
        mainWindow?.maximize();
});
electron_1.ipcMain.on('window:close', () => mainWindow?.close());
electron_1.ipcMain.handle('window:setTitle', (_e, title) => mainWindow?.setTitle(title));
electron_1.ipcMain.handle('app:getVersion', () => electron_1.app.getVersion());
electron_1.ipcMain.handle('app:isVisible', () => mainWindow?.isVisible() ?? false);
electron_1.ipcMain.handle('app:relaunch', () => { electron_1.app.relaunch(); electron_1.app.quit(); });
electron_1.ipcMain.handle('window:isMaximized', () => mainWindow?.isMaximized() ?? false);
// ─── IPC: Overlay ─────────────────────────────────────────────────────────────
electron_1.ipcMain.handle('window:openOverlay', async () => {
    const ow = createOverlayWindow();
    ow.show();
    mainWindow?.webContents.send('overlay:opened');
    return true;
});
electron_1.ipcMain.handle('window:closeOverlay', () => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
        overlayWindow.hide();
        mainWindow?.webContents.send('overlay:closed');
    }
});
electron_1.ipcMain.handle('window:toggleVisibility', () => {
    if (!overlayWindow || overlayWindow.isDestroyed()) {
        const ow = createOverlayWindow();
        ow.show();
        return true;
    }
    if (overlayWindow.isVisible()) {
        overlayWindow.hide();
        return false;
    }
    else {
        overlayWindow.show();
        return true;
    }
});
electron_1.ipcMain.handle('window:isStealthEnabled', () => overlayWindow ? !overlayWindow.isDestroyed() && overlayWindow.isVisible() : false);
electron_1.ipcMain.on('window:set-ignore-mouse-events', (_e, ignore, opts) => {
    overlayWindow?.setIgnoreMouseEvents(ignore, opts);
});
electron_1.ipcMain.on('window:set-interactive-rects', () => { });
electron_1.ipcMain.on('window:set-viewport-size', () => { });
electron_1.ipcMain.on('window:expand', () => overlayWindow?.show());
electron_1.ipcMain.on('window:shrink', () => overlayWindow?.hide());
electron_1.ipcMain.on('window:resync-mouse-capture', () => { });
electron_1.ipcMain.handle('window:get-cursor-point', () => {
    const { x, y } = electron_1.screen.getCursorScreenPoint();
    return { x, y };
});
// ─── IPC: System ──────────────────────────────────────────────────────────────
electron_1.ipcMain.handle('system:openExternal', (_e, url) => {
    if (typeof url === 'string' && (url.startsWith('https://') || url.startsWith('http://')))
        return electron_1.shell.openExternal(url);
});
electron_1.ipcMain.handle('system:getSystemInfo', () => ({
    platform: process.platform,
    version: electron_1.app.getVersion(),
    electron: process.versions.electron,
    node: process.versions.node,
    arch: process.arch,
}));
// ─── IPC: Clipboard ───────────────────────────────────────────────────────────
const { clipboard } = require('electron');
electron_1.ipcMain.handle('clipboard:readText', () => clipboard.readText());
electron_1.ipcMain.handle('clipboard:writeText', (_e, text) => clipboard.writeText(text));
// ─── IPC: Settings ────────────────────────────────────────────────────────────
const DEFAULT_SETTINGS = {
    ai: { model: 'openai/gpt-4o-mini', defaultResponseMode: 'explain', apiKey: '' },
    stt: { provider: 'browser', apiKey: '', language: 'en-US' },
    overlay: { theme: 'dark', opacity: 1, position: { x: 20, y: 60 }, size: { width: 420, height: 580 }, alwaysOnTop: true },
};
electron_1.ipcMain.handle('settings:load', () => {
    const saved = store.get('settings');
    return saved ? deepMerge(DEFAULT_SETTINGS, saved) : DEFAULT_SETTINGS;
});
electron_1.ipcMain.handle('settings:update', (_e, update) => {
    const current = store.get('settings') || DEFAULT_SETTINGS;
    const next = deepMerge(current, update);
    store.set('settings', next);
    return next;
});
electron_1.ipcMain.handle('settings:batchUpdate', (_e, updates) => {
    const current = store.get('settings') || DEFAULT_SETTINGS;
    const next = updates.reduce((acc, u) => deepMerge(acc, u), current);
    store.set('settings', next);
    return next;
});
electron_1.ipcMain.handle('local-settings:get', (_e, key) => store.get(key));
electron_1.ipcMain.handle('local-settings:set', (_e, key, value) => { store.set(key, value); return true; });
electron_1.ipcMain.handle('local-settings:getAll', () => store.store);
electron_1.ipcMain.handle('local-settings:reset', () => {
    store.clear();
    return true;
});
// ─── IPC: Auth ────────────────────────────────────────────────────────────────
electron_1.ipcMain.handle('auth:get-tokens', () => store.get('auth_data') ?? null);
electron_1.ipcMain.handle('auth:store-tokens', (_e, tokens, user) => {
    store.set('auth_data', { tokens, user });
    return { success: true };
});
electron_1.ipcMain.handle('auth:clear-tokens', () => { store.delete('auth_data'); return { success: true }; });
electron_1.ipcMain.handle('auth:getAuthState', () => {
    const data = store.get('auth_data');
    return { isAuthenticated: !!data?.tokens, user: data?.user ?? null };
});
electron_1.ipcMain.handle('auth:open-login', () => electron_1.shell.openExternal('https://www.interviewpilot.in/auth/login?source=desktop'));
electron_1.ipcMain.handle('auth:open-register', () => electron_1.shell.openExternal('https://www.interviewpilot.in/auth/register?source=desktop'));
electron_1.ipcMain.handle('auth:logout', () => { store.delete('auth_data'); return { success: true }; });
// ─── IPC: Interview Session Data ──────────────────────────────────────────────
const sessionData = new Map();
electron_1.ipcMain.handle('interview:getSessionData', (_e, key) => sessionData.get(key) ?? null);
electron_1.ipcMain.handle('interview:setSessionData', (_e, key, value) => { sessionData.set(key, value); return true; });
electron_1.ipcMain.handle('interview:clearSessionData', () => { sessionData.clear(); return true; });
// ─── IPC: Session History (local) ─────────────────────────────────────────────
electron_1.ipcMain.handle('history:getAll', () => store.get('session_history', []));
electron_1.ipcMain.handle('history:save', (_e, session) => {
    const history = store.get('session_history', []);
    history.unshift(session);
    store.set('session_history', history.slice(0, 100));
    return true;
});
electron_1.ipcMain.handle('history:delete', (_e, id) => {
    const history = store.get('session_history', []).filter((s) => s.id !== id);
    store.set('session_history', history);
    return true;
});
electron_1.ipcMain.handle('history:clear', () => { store.set('session_history', []); return true; });
// ─── IPC: Theme ───────────────────────────────────────────────────────────────
electron_1.ipcMain.handle('theme:get', () => store.get('theme', 'dark'));
electron_1.ipcMain.handle('theme:set', (_e, theme) => { store.set('theme', theme); return theme; });
electron_1.ipcMain.handle('theme:toggle', () => {
    const current = store.get('theme', 'dark');
    const next = current === 'dark' ? 'light' : 'dark';
    store.set('theme', next);
    mainWindow?.webContents.send('theme:update', next);
    overlayWindow?.webContents.send('theme:update', next);
    return next;
});
electron_1.ipcMain.handle('theme:syncSystem', () => { store.set('theme', 'system'); return 'system'; });
// ─── IPC: Screenshot ─────────────────────────────────────────────────────────
electron_1.ipcMain.handle('capture-screenshot', async () => {
    try {
        const { desktopCapturer } = require('electron');
        const sources = await desktopCapturer.getSources({
            types: ['screen'],
            thumbnailSize: { width: 1920, height: 1080 },
        });
        if (sources.length > 0) {
            return sources[0].thumbnail.toDataURL();
        }
        return null;
    }
    catch (e) {
        console.error('[Screenshot] Failed:', e);
        return null;
    }
});
electron_1.ipcMain.handle('desktop:getSources', async (_e, opts) => {
    try {
        const { desktopCapturer } = require('electron');
        return await desktopCapturer.getSources(opts || { types: ['screen', 'window'] });
    }
    catch {
        return [];
    }
});
// ─── IPC: File Storage ────────────────────────────────────────────────────────
electron_1.ipcMain.handle('storage:getCommonDirs', () => ({
    home: (0, os_1.homedir)(),
    documents: (0, path_1.join)((0, os_1.homedir)(), 'Documents'),
    downloads: (0, path_1.join)((0, os_1.homedir)(), 'Downloads'),
    desktop: (0, path_1.join)((0, os_1.homedir)(), 'Desktop'),
}));
electron_1.ipcMain.handle('storage:listDir', async (_e, dirPath) => {
    try {
        const entries = (0, fs_1.readdirSync)(dirPath, { withFileTypes: true });
        return entries.map(e => ({ name: e.name, isDir: e.isDirectory(), path: (0, path_1.join)(dirPath, e.name) }));
    }
    catch (err) {
        return { error: err.message };
    }
});
electron_1.ipcMain.handle('storage:readFile', async (_e, filePath) => {
    try {
        return { content: (0, fs_1.readFileSync)(filePath, 'utf-8') };
    }
    catch (err) {
        return { error: err.message };
    }
});
electron_1.ipcMain.handle('storage:selectDocumentFile', async () => {
    const r = await electron_1.dialog.showOpenDialog({ properties: ['openFile'], filters: [{ name: 'Documents', extensions: ['pdf', 'docx', 'txt', 'md'] }] });
    return r.canceled ? null : r.filePaths[0];
});
electron_1.ipcMain.handle('storage:selectResumeFile', async () => {
    const r = await electron_1.dialog.showOpenDialog({ properties: ['openFile'], filters: [{ name: 'Resume', extensions: ['pdf', 'docx', 'txt'] }] });
    return r.canceled ? null : r.filePaths[0];
});
electron_1.ipcMain.handle('storage:selectFileStealth', async () => {
    const r = await electron_1.dialog.showOpenDialog({ properties: ['openFile'] });
    return r.canceled ? null : r.filePaths[0];
});
// ─── IPC: API Proxy ───────────────────────────────────────────────────────────
const ALLOWED_API_PATHS = ['/auth/', '/profile', '/interviews', '/meetings', '/ai/', '/usage', '/plans'];
const ALLOWED_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete']);
electron_1.ipcMain.handle('api:request', async (_e, { path, method, body, headers }) => {
    if (!path || typeof path !== 'string' || path.includes('..') ||
        !ALLOWED_API_PATHS.some(p => path.startsWith(p))) {
        return { error: { code: 'FORBIDDEN', message: 'Path not allowed', retryable: false } };
    }
    const m = (method || 'GET').toLowerCase();
    if (!ALLOWED_METHODS.has(m))
        return { error: { code: 'FORBIDDEN', message: 'Method not allowed', retryable: false } };
    const authData = store.get('auth_data');
    const accessToken = authData?.tokens?.accessToken;
    try {
        const https = require('https');
        const url = new URL(`${BACKEND_URL}${path}`);
        return await new Promise((resolve) => {
            const reqHeaders = { 'Content-Type': 'application/json', 'User-Agent': 'InterviewPilot-Clone/1.5.0' };
            if (accessToken)
                reqHeaders['Authorization'] = `Bearer ${accessToken}`;
            const bodyStr = body ? JSON.stringify(body) : undefined;
            if (bodyStr)
                reqHeaders['Content-Length'] = Buffer.byteLength(bodyStr);
            const req = https.request({ hostname: url.hostname, path: url.pathname + url.search, method: m.toUpperCase(), headers: reqHeaders }, (res) => {
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => {
                    try {
                        resolve(JSON.parse(data));
                    }
                    catch {
                        resolve({ error: { code: 'PARSE_ERROR', message: 'Invalid JSON response', retryable: false } });
                    }
                });
            });
            req.on('error', (e) => resolve({ error: { code: 'NETWORK_ERROR', message: e.message, retryable: true } }));
            if (bodyStr)
                req.write(bodyStr);
            req.end();
        });
    }
    catch (e) {
        return { error: { code: 'NETWORK_ERROR', message: e.message, retryable: true } };
    }
});
// ─── IPC: Usage / Profile ─────────────────────────────────────────────────────
electron_1.ipcMain.handle('usage:drain', () => ({ used: 0, limit: -1 }));
electron_1.ipcMain.handle('profile:load', () => store.get('profile', null));
electron_1.ipcMain.handle('profile:uploadResume', () => ({ success: true }));
electron_1.ipcMain.handle('error:log', (_e, err) => console.error('[renderer error]', err));
electron_1.ipcMain.handle('virtual-mouse-state', () => ({ active: false }));
electron_1.ipcMain.handle('update:quitAndInstall', () => { electron_1.app.quit(); });
// ─── IPC: Audio (mock/stub — real impl requires native binaries) ────────────
electron_1.ipcMain.handle('audio:getDevices', () => [{ id: 'default', label: 'Default Microphone', kind: 'audioinput' }]);
electron_1.ipcMain.handle('audio:isActive', () => false);
electron_1.ipcMain.handle('audio:startCapture', () => ({ success: false, error: 'Audio capture requires Deepgram API key in settings' }));
electron_1.ipcMain.handle('audio:stopCapture', () => ({ success: true }));
electron_1.ipcMain.handle('audio:startUserCapture', () => ({ success: false, error: 'STT: set Deepgram API key in Settings → AI & Models' }));
electron_1.ipcMain.handle('audio:stopUserCapture', () => ({ success: true }));
electron_1.ipcMain.handle('audio:switchDevice', () => ({ success: true }));
electron_1.ipcMain.handle('audio:getActiveDevices', () => []);
// ─── IPC: Transcription ───────────────────────────────────────────────────────
electron_1.ipcMain.handle('transcription:getSettings', () => store.get('transcription_settings', { provider: 'browser', language: 'en-US' }));
electron_1.ipcMain.handle('transcription:updateSettings', (_e, s) => { store.set('transcription_settings', s); return true; });
electron_1.ipcMain.handle('transcription:getMode', () => store.get('transcription_mode', 'off'));
electron_1.ipcMain.handle('transcription:setMode', (_e, mode) => { store.set('transcription_mode', mode); return mode; });
electron_1.ipcMain.handle('transcription:toggle', () => {
    const cur = store.get('transcription_mode', 'off');
    const next = cur === 'off' ? 'browser' : 'off';
    store.set('transcription_mode', next);
    return next;
});
electron_1.ipcMain.handle('transcription:cycleMode', () => {
    const modes = ['off', 'browser', 'deepgram'];
    const cur = store.get('transcription_mode', 'off');
    const next = modes[(modes.indexOf(cur) + 1) % modes.length];
    store.set('transcription_mode', next);
    return next;
});
electron_1.ipcMain.handle('transcription:addTranscript', (_e, text) => {
    mainWindow?.webContents.send('transcription:updated', text);
    return true;
});
electron_1.ipcMain.handle('transcription:clear', () => true);
// ─── Shortcuts ────────────────────────────────────────────────────────────────
function registerGlobalShortcuts() {
    const shortcuts = [
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
    ];
    for (const [key, event] of shortcuts) {
        try {
            electron_1.globalShortcut.register(key, () => {
                mainWindow?.webContents.send(event);
                overlayWindow?.webContents.send(event);
            });
        }
        catch { /* ignore conflicting shortcuts */ }
    }
}
// ─── App Lifecycle ────────────────────────────────────────────────────────────
electron_1.app.whenReady().then(() => {
    createMainWindow();
    if (electron_1.app.isPackaged)
        registerGlobalShortcuts();
    electron_1.app.on('activate', () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0)
            createMainWindow();
    });
});
electron_1.app.on('window-all-closed', () => {
    electron_1.globalShortcut.unregisterAll();
    if (process.platform !== 'darwin')
        electron_1.app.quit();
});
electron_1.app.on('will-quit', () => electron_1.globalShortcut.unregisterAll());
// ─── Helpers ──────────────────────────────────────────────────────────────────
function deepMerge(base, override) {
    const result = { ...base };
    for (const key in override) {
        const v = override[key];
        if (v !== null && typeof v === 'object' && !Array.isArray(v) && key in result && typeof result[key] === 'object') {
            result[key] = deepMerge(result[key], v);
        }
        else if (v !== undefined) {
            result[key] = v;
        }
    }
    return result;
}
//# sourceMappingURL=main.js.map