"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupAuthHandlers = setupAuthHandlers;
exports.setupApiHandlers = setupApiHandlers;
const electron_1 = require("electron");
const API_BASE = 'https://api.interviewpilot.in/api/v1';
const ALLOWED_PATHS = ['/auth/', '/profile', '/interviews', '/meetings', '/ai/', '/usage'];
const ALLOWED_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete']);
function setupAuthHandlers(store) {
    const WEBSITE_URL = 'https://www.interviewpilot.in';
    electron_1.ipcMain.handle('auth:get-tokens', () => store.get('auth_data'));
    electron_1.ipcMain.handle('auth:store-tokens', (_e, tokens, user) => {
        store.set('auth_data', { tokens, user });
        return { success: true };
    });
    electron_1.ipcMain.handle('auth:clear-tokens', () => { store.delete('auth_data'); return { success: true }; });
    electron_1.ipcMain.handle('auth:getAuthState', () => {
        const data = store.get('auth_data');
        return { isAuthenticated: !!data?.tokens, user: data?.user ?? null };
    });
    electron_1.ipcMain.handle('auth:open-login', () => electron_1.shell.openExternal(`${WEBSITE_URL}/auth/login?source=desktop`));
    electron_1.ipcMain.handle('auth:open-register', () => electron_1.shell.openExternal(`${WEBSITE_URL}/auth/register?source=desktop`));
    electron_1.ipcMain.handle('auth:logout', () => { store.delete('auth_data'); return { success: true }; });
}
function setupApiHandlers(store, backendUrl) {
    electron_1.ipcMain.handle('api:request', async (_e, { path, method, body, headers }) => {
        // Security: only allow whitelisted paths
        if (!path || typeof path !== 'string' || path.includes('..') || path.includes('//') ||
            !ALLOWED_PATHS.some(p => path.startsWith(p))) {
            return { error: { code: 'FORBIDDEN', message: 'Path not allowed', retryable: false } };
        }
        const m = (method || 'GET').toLowerCase();
        if (!ALLOWED_METHODS.has(m)) {
            return { error: { code: 'FORBIDDEN', message: 'Method not allowed', retryable: false } };
        }
        // Strip auth header (tokens are handled server-side from store)
        const authData = store.get('auth_data');
        const accessToken = authData?.tokens?.accessToken;
        const safeHeaders = {
            'Content-Type': 'application/json',
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        };
        try {
            const { default: fetch } = await Promise.resolve().then(() => __importStar(require('node-fetch')));
            const url = `${backendUrl}${path}`;
            const res = await fetch(url, {
                method: m.toUpperCase(),
                headers: safeHeaders,
                body: ['post', 'put', 'patch'].includes(m) ? JSON.stringify(body) : undefined,
            });
            if (!res.ok) {
                const errData = await res.json().catch(() => ({ message: res.statusText }));
                return { error: { code: `HTTP_${res.status}`, message: errData.message, retryable: res.status >= 500 } };
            }
            return await res.json();
        }
        catch (err) {
            return { error: { code: 'NETWORK_ERROR', message: err.message, retryable: true } };
        }
    });
}
//# sourceMappingURL=api.js.map