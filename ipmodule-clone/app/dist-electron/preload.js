"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
// ─── IPC Channel Whitelists (from original app) ───────────────────────────────
const INVOKE_CHANNELS = new Set([
    'window:setPosition', 'window:getPosition', 'window:setSize', 'window:getSize',
    'window:toggleVisibility', 'window:isStealthEnabled', 'window:maximize',
    'window:switchToInterview', 'window:setTitle', 'window:close',
    'audio:startCapture', 'audio:stopCapture', 'audio:startUserCapture',
    'audio:stopUserCapture', 'audio:startInterviewerCapture', 'audio:stopInterviewerCapture',
    'audio:getDevices', 'audio:switchDevice', 'audio:getActiveDevices', 'audio:isActive',
    'transcription:toggle', 'transcription:setMode', 'transcription:getMode',
    'transcription:cycleMode', 'transcription:addTranscript', 'transcription:clear',
    'transcription:getSettings', 'transcription:updateSettings',
    'profile:load', 'profile:update', 'profile:uploadResume', 'profile:parseResume',
    'settings:load', 'settings:update', 'settings:batchUpdate',
    'local-settings:get', 'local-settings:set', 'local-settings:getAll',
    'manual:triggerResponse', 'manual:pauseResume', 'manual:clearResponse',
    'manual:regenerate', 'manual:aiAnswer', 'manual:analyzeScreen',
    'capture-screenshot',
    'interview:create', 'interview:getAll', 'interview:getById', 'interview:getCurrent',
    'interview:setCurrent', 'interview:update', 'interview:delete', 'interview:end',
    'interview:getConversations', 'interview:getStatistics',
    'interview:setSessionData', 'interview:getSessionData', 'interview:clearSessionData',
    'theme:get', 'theme:set', 'theme:toggle', 'theme:syncSystem',
    'auth:register', 'auth:login', 'auth:logout', 'auth:refreshToken', 'auth:getAuthState',
    'auth:open-login', 'auth:open-register',
    'auth:get-tokens', 'auth:store-tokens', 'auth:clear-tokens',
    'storage:selectDocumentFile', 'storage:selectResumeFile', 'storage:readFile',
    'storage:listDir', 'storage:getCommonDirs', 'storage:selectFileStealth',
    'system:openExternal', 'system:getSystemInfo',
    'update:quitAndInstall',
    'desktop:getSources',
    'app:getVersion', 'app:relaunch', 'app:isVisible',
    'usage:drain',
    'clipboard:readText', 'clipboard:writeText',
    'error:log',
    'virtual-mouse-state',
    'window:get-cursor-point',
    'api:request',
]);
const SEND_CHANNELS = new Set([
    'window:minimize', 'window:restore', 'close-window',
    'manual:clearResponse',
    'updater:check', 'updater:start-download', 'updater:cancel-download',
    'updater:quitAndInstall', 'updater:schedule-install', 'updater:get-state',
    'kbd:setBlocking',
    'window:set-ignore-mouse-events', 'window:set-interactive-rects',
    'window:set-viewport-size', 'window:resync-mouse-capture',
    'tour:open-window', 'tour:close-window',
]);
const RECEIVE_CHANNELS = new Set([
    'stealth-mode-status', 'stealth-mode-failed',
    'window:minimize-to-icon', 'window:restore-from-icon',
    'window-focused',
    'virtual-input', 'manual-input-focused', 'native-click', 'window-clicked',
    'virtual-mouse-state', 'virtual-mouse-move', 'virtual-mouse-click',
    'virtual-mouse-wheel',
    'audio:data', 'audio:deviceChanged', 'audio:error', 'audio:started', 'audio:stopped',
    'transcription:updated', 'transcription:word', 'transcription:final',
    'ai:questionSet', 'ai:responseToken', 'ai:responseComplete', 'ai:error',
    'error:critical', 'error:warning', 'error:info', 'error:log',
    'theme:update',
    'interview:sessionDataReady',
    'app:forceClose',
    // Shortcut receive channels
    'shortcut:minimize', 'shortcut:moveWindowLeft', 'shortcut:moveWindowRight',
    'shortcut:moveWindowUp', 'shortcut:moveWindowDown',
    'shortcut:toggleInterviewerAudio', 'shortcut:toggleUserAudio',
    'shortcut:switchToConcise', 'shortcut:submitMessageCtrl',
    'shortcut:switchToExplain', 'shortcut:switchToStory',
    'shortcut:autoAnswer', 'shortcut:analyzeScreen', 'shortcut:captureScreenshot',
    'shortcut:regenerateResponse', 'shortcut:nextResponse', 'shortcut:previousResponse',
    'shortcut:toggleContext', 'shortcut:collapseResponse', 'shortcut:toggleCompetitiveMode',
    'shortcut:editLastTranscript', 'shortcut:changeTab', 'shortcut:stealthPaste',
    // Update events
    'update-available', 'update-not-available', 'update-error',
    'update-download-progress', 'update-downloaded', 'update-checking',
    // Auth events
    'auth:google-callback', 'auth:google-error', 'auth:oauth-success',
    'auth:oauth-error', 'auth:tokens-received', 'auth:token-error',
    'payment:completed',
    'stealth-copied-text',
    'kbd:focus-lost-externally',
]);
// ─── Listener registry for cleanup ────────────────────────────────────────────
const listenerRegistry = new Map();
function getOrCreateListenerMap(channel) {
    let m = listenerRegistry.get(channel);
    if (!m) {
        m = new Map();
        listenerRegistry.set(channel, m);
    }
    return m;
}
function removeListener(channel, handler, rawHandler) {
    electron_1.ipcRenderer.removeListener(channel, rawHandler);
    const m = listenerRegistry.get(channel);
    if (m) {
        m.delete(handler);
        if (m.size === 0)
            listenerRegistry.delete(channel);
    }
}
// ─── Exposed APIs ─────────────────────────────────────────────────────────────
electron_1.contextBridge.exposeInMainWorld('electron', {
    ipcRenderer: {
        invoke(channel, ...args) {
            if (!INVOKE_CHANNELS.has(channel)) {
                console.warn(`[Preload] Invalid invoke: ${channel}`);
                return Promise.reject(new Error(`Invalid channel: ${channel}`));
            }
            return electron_1.ipcRenderer.invoke(channel, ...args);
        },
        send(channel, ...args) {
            if (!SEND_CHANNELS.has(channel)) {
                console.warn(`[Preload] Invalid send: ${channel}`);
                return;
            }
            electron_1.ipcRenderer.send(channel, ...args);
        },
        on(channel, handler) {
            if (!RECEIVE_CHANNELS.has(channel)) {
                console.warn(`[Preload] Invalid receive: ${channel}`);
                return () => { };
            }
            const m = getOrCreateListenerMap(channel);
            if (m.has(handler)) {
                const existing = m.get(handler);
                return () => removeListener(channel, handler, existing);
            }
            const rawHandler = (_e, ...args) => handler(...args);
            m.set(handler, rawHandler);
            electron_1.ipcRenderer.on(channel, rawHandler);
            return () => removeListener(channel, handler, rawHandler);
        },
        once(channel, handler) {
            if (!RECEIVE_CHANNELS.has(channel)) {
                console.warn(`[Preload] Invalid once: ${channel}`);
                return;
            }
            electron_1.ipcRenderer.once(channel, (_e, ...args) => handler(...args));
        },
        removeListener(channel, handler) {
            if (!RECEIVE_CHANNELS.has(channel))
                return;
            const m = listenerRegistry.get(channel);
            if (!m)
                return;
            const rawHandler = m.get(handler);
            if (rawHandler)
                removeListener(channel, handler, rawHandler);
        },
        removeAllListeners(channel) {
            if (!RECEIVE_CHANNELS.has(channel))
                return;
            electron_1.ipcRenderer.removeAllListeners(channel);
            listenerRegistry.delete(channel);
        },
    },
    storageAPI: {
        listDir: (path) => electron_1.ipcRenderer.invoke('storage:listDir', path),
        readFile: (path) => electron_1.ipcRenderer.invoke('storage:readFile', path),
        getCommonDirs: () => electron_1.ipcRenderer.invoke('storage:getCommonDirs'),
        selectFileStealth: () => electron_1.ipcRenderer.invoke('storage:selectFileStealth'),
    },
});
electron_1.contextBridge.exposeInMainWorld('theme', {
    getTheme: () => electron_1.ipcRenderer.invoke('theme:get'),
    setTheme: (t) => electron_1.ipcRenderer.invoke('theme:set', t),
    toggleTheme: () => electron_1.ipcRenderer.invoke('theme:toggle'),
    syncWithSystem: () => electron_1.ipcRenderer.invoke('theme:syncSystem'),
    onThemeUpdate: (cb) => {
        const handler = (_e, theme) => cb(theme);
        electron_1.ipcRenderer.on('theme:update', handler);
        return () => electron_1.ipcRenderer.removeListener('theme:update', handler);
    },
});
//# sourceMappingURL=preload.js.map