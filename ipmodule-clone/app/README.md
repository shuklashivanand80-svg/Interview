# InterviewPilot Clone

A feature-equivalent clone of `ipmodule-1.5.0-win.exe` (InterviewPilot v1.5.0), reconstructed from the extracted Electron application payload.

## Architecture

| Layer | Technology | Notes |
|---|---|---|
| Runtime | Electron 33 | Transparent overlay window, frameless |
| Frontend | React 18 + TypeScript | HashRouter for Electron compatibility |
| Styling | Tailwind CSS v3 + custom CSS vars | Exact design token system from original |
| Animations | Framer Motion 12 | Same version as original |
| AI Streaming | SSE (fetch ReadableStream) | Connects to api.interviewpilot.in |
| Local storage | electron-store | Settings, auth tokens, session data |
| Build | Vite 6 + electron-builder | Dev: `npm run dev:electron` |

## Setup

```bash
cd app
npm install
npm run dev:electron   # Development mode (opens Electron + Vite)
```

## Project Structure

```
app/
├── src/
│   ├── main/                 # Electron main process
│   │   ├── main.ts           # App lifecycle, BrowserWindow, global shortcuts
│   │   ├── preload.ts        # contextBridge IPC whitelist
│   │   ├── api.ts            # API proxy + auth IPC handlers
│   │   └── storage.ts        # File system IPC handlers
│   ├── renderer/             # React frontend
│   │   ├── main.tsx          # React entry point + routing
│   │   ├── styles.css        # Global CSS + design tokens
│   │   ├── store/            # React context providers
│   │   │   ├── auth.tsx      # Auth (login/logout/register/token refresh)
│   │   │   ├── settings.tsx  # App settings + AI model catalog
│   │   │   └── theme.tsx     # Dark/light/system theme
│   │   ├── services/
│   │   │   └── api.ts        # API client + interview/profile services
│   │   └── views/
│   │       ├── LoginView.tsx         # Login + register screen
│   │       ├── Dashboard.tsx         # Main dashboard shell
│   │       ├── OverlaySession.tsx    # Stealth overlay panel (session mode)
│   │       └── dashboard/
│   │           ├── CreateSessionTab.tsx  # New session configuration
│   │           ├── HistoryTab.tsx        # Past sessions list
│   │           └── SettingsView.tsx      # Settings (General, AI, Keybinds, Plans)
│   └── shared/
│       └── shortcuts.ts      # Keyboard shortcut definitions
├── package.json
├── vite.config.ts
├── tailwind.config.js
└── tsconfig.json
```

## Feature Status

| Feature | Status | Notes |
|---|---|---|
| Dashboard UI (3 tabs) | ✅ Implemented | Session, History, Settings |
| Login / Register | ✅ Implemented | Connects to api.interviewpilot.in |
| Overlay window (stealth) | ✅ Implemented | Transparent, always-on-top |
| AI chat with streaming | ✅ Implemented | SSE streaming + offline fallback |
| Response modes (Concise/Explain/Story) | ✅ Implemented | Fully functional |
| AI model selection | ✅ Implemented | 12 models from original |
| Keyboard shortcuts | ✅ Implemented | 20 shortcuts from original |
| Drag to reposition overlay | ✅ Implemented | Mouse drag support |
| Theme (dark/light/system) | ✅ Implemented | Persisted via IPC |
| Screenshot analyze | ✅ Implemented | Via IPC + API |
| Settings persistence | ✅ Implemented | electron-store |
| Session history | ✅ Implemented | Connects to API |
| Auto-updater | ⚠️ Partial | Update check only, no install |
| Audio capture (STT) | 🔲 Not implemented | Requires Deepgram API key |
| Meeting mode (live transcription) | 🔲 Not implemented | Blocked by audio STT |
| koffi Win32 native mouse | 🔲 Not implemented | Original uses for click-through |
| Tour / onboarding | 🔲 Not implemented | Non-critical |

## Backend API

The original application connects to `https://api.interviewpilot.in/api/v1`.
All API requests are proxied through the Electron main process via `api:request` IPC to avoid CORS.

In offline/dev mode, the overlay automatically falls back to a local response generator.

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| Ctrl+Alt+H | Hide / show overlay |
| Ctrl+M | Toggle overlay visibility |
| Ctrl+Enter | Submit message |
| Ctrl+Shift+Enter | Analyze screen / take screenshot |
| Ctrl+Shift+A | Toggle auto-answer |
| Ctrl+Shift+R | Regenerate response |
| Ctrl+Shift+N | New chat |
| Ctrl+1/2/3 | Switch response mode (Concise/Explain/Story) |
| Ctrl+Alt+←/→/↑/↓ | Move overlay window |

## Recovery Notes

Extracted from: `C:\Users\Asus\Downloads\Ana\ipmodule-1.5.0-win.exe`
- NSIS installer → `$PLUGINSDIR\app-64.7z` (81 MB 7z archive)
- Inner archive → `resources/app.asar` (22.65 MB Electron app)
- asar extracted → 295 TypeScript source files identified from bundle comments

GitHub update feed: `kaku006503-cyber/interviewpilot-desktop-release`
