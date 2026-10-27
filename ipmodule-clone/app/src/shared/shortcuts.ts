// Shared shortcut definitions — matches the original app exactly
export interface ShortcutDef {
  action: string
  key: string
  label: string
  section: string
  displayKeys: string[]
  hidden?: boolean
  appStartup?: boolean
}

export const SHORTCUT_DEFS: ShortcutDef[] = [
  { action: 'minimize',              key: 'ctrl+alt+h',          label: 'Hide/show overlay',          section: 'Window Management',       displayKeys: ['Ctrl', 'Alt', 'H'], appStartup: true },
  { action: 'moveWindowLeft',        key: 'ctrl+alt+left',       label: 'Move window left',            section: 'Window Management',       displayKeys: ['Ctrl', 'Alt', '←'] },
  { action: 'moveWindowRight',       key: 'ctrl+alt+right',      label: 'Move window right',           section: 'Window Management',       displayKeys: ['Ctrl', 'Alt', '→'] },
  { action: 'moveWindowUp',          key: 'ctrl+alt+up',         label: 'Move window up',              section: 'Window Management',       displayKeys: ['Ctrl', 'Alt', '↑'] },
  { action: 'moveWindowDown',        key: 'ctrl+alt+down',       label: 'Move window down',            section: 'Window Management',       displayKeys: ['Ctrl', 'Alt', '↓'] },
  { action: 'toggleUserAudio',       key: 'ctrl+alt+u',          label: 'Toggle your audio',           section: 'Audio',                   displayKeys: ['Ctrl', 'Alt', 'U'] },
  { action: 'toggleInterviewerAudio',key: 'ctrl+alt+i',          label: 'Toggle interviewer audio',    section: 'Audio',                   displayKeys: ['Ctrl', 'Alt', 'I'] },
  { action: 'toggleContext',         key: 'ctrl+m',              label: 'Toggle overlay visibility',   section: 'Window Management',       displayKeys: ['Ctrl', 'M'], appStartup: true },
  { action: 'submitMessageCtrl',     key: 'ctrl+enter',          label: 'Submit message',              section: 'Utility',                 displayKeys: ['Ctrl', 'Enter'], hidden: true },
  { action: 'analyzeScreenCtrl',     key: 'ctrl+shift+enter',    label: 'Analyze screen / Screenshot', section: 'AI Actions',              displayKeys: ['Ctrl', 'Shift', 'Enter'] },
  { action: 'captureScreenshot',     key: 'ctrl+shift+s',        label: 'Capture screenshot to input', section: 'AI Actions',              displayKeys: ['Ctrl', 'Shift', 'S'] },
  { action: 'autoAnswerCtrl',        key: 'ctrl+shift+a',        label: 'Toggle auto-answer',          section: 'AI Actions',              displayKeys: ['Ctrl', 'Shift', 'A'] },
  { action: 'regenerateResponseCtrl',key: 'ctrl+shift+r',        label: 'Regenerate response',         section: 'AI Actions',              displayKeys: ['Ctrl', 'Shift', 'R'] },
  { action: 'newChatCtrl',           key: 'ctrl+shift+n',        label: 'New chat',                    section: 'Navigation & History',    displayKeys: ['Ctrl', 'Shift', 'N'] },
  { action: 'switchConversation1',   key: 'ctrl+shift+1',        label: 'Switch to conversation 1',    section: 'Navigation & History',    displayKeys: ['Ctrl', 'Shift', '1'] },
  { action: 'switchConversation2',   key: 'ctrl+shift+2',        label: 'Switch to conversation 2',    section: 'Navigation & History',    displayKeys: ['Ctrl', 'Shift', '2'] },
  { action: 'switchConversation3',   key: 'ctrl+shift+3',        label: 'Switch to conversation 3',    section: 'Navigation & History',    displayKeys: ['Ctrl', 'Shift', '3'] },
  { action: 'switchConversation4',   key: 'ctrl+shift+4',        label: 'Switch to conversation 4',    section: 'Navigation & History',    displayKeys: ['Ctrl', 'Shift', '4'] },
  { action: 'switchToConciseCtrl',   key: 'ctrl+1',              label: 'Switch to Concise mode',      section: 'Response Mode',           displayKeys: ['Ctrl', '1'] },
  { action: 'switchToExplainCtrl',   key: 'ctrl+2',              label: 'Switch to Explain mode',      section: 'Response Mode',           displayKeys: ['Ctrl', '2'] },
  { action: 'switchToStoryCtrl',     key: 'ctrl+3',              label: 'Switch to Story mode',        section: 'Response Mode',           displayKeys: ['Ctrl', '3'] },
]
