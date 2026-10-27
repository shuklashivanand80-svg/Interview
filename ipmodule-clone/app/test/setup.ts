import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

// Mock Electron IPC bridge
const mockIpc = {
  invoke: vi.fn(async (channel: string, ...args: any[]) => {
    if (channel === 'window:openOverlay') return true
    if (channel === 'settings:load') return null
    if (channel === 'settings:update') return args[0]
    if (channel === 'history:getAll') return []
    if (channel === 'history:save') return true
    if (channel === 'capture-screenshot') return 'data:image/png;base64,mock'
    if (channel === 'storage:readFile') return { content: 'Mock file content' }
    return null
  }),
  send: vi.fn(),
  on: vi.fn(() => () => {}),
  once: vi.fn(),
  removeListener: vi.fn(),
  removeAllListeners: vi.fn(),
}

Object.defineProperty(window, 'electron', {
  value: { ipcRenderer: mockIpc },
  writable: true,
  configurable: true,
})

// Mock window.scrollIntoView
Element.prototype.scrollIntoView = vi.fn()

// Mock ResizeObserver
class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.ResizeObserver = MockResizeObserver as any

// Mock clipboard
Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: vi.fn(async () => {}),
    readText: vi.fn(async () => ''),
  },
  writable: true,
})
