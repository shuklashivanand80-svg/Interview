# Content Protection — Windows Limitations

## What setContentProtection(true) Does

Electron's BrowserWindow.setContentProtection(true) calls the Windows API
SetWindowDisplayAffinity(hwnd, WDA_EXCLUDEFROMCAPTURE) on Windows 10 2004+.

When active, the window's content is excluded from:
- Windows Game Bar / Xbox Game DVR captures
- Windows + PrintScreen (DWM screenshot path)
- Windows + Shift + S (Snipping Tool via DWM path on supported builds)
- Some OBS configurations using DXGI screen capture

## What Is NOT Blocked

Physical cameras pointed at the screen are **never** blocked by software.
Remote desktop / VNC software operates at the GPU/driver level — not blocked.
Hardware capture cards are not blocked.
Some OBS configurations (Window Capture mode) may bypass the flag.
Screen recorders using legacy BitBlt or GDI methods may bypass the flag.
Older Windows builds (before 10 2004 / build 19041) do not support the flag.

## Fallback Behavior

If setContentProtection(true) throws (unsupported OS, sandboxed environment):
- The error is caught silently (	ry { ... } catch { /* no-op */ })
- The window renders and operates normally
- No content protection is applied — users are not affected
- A console.warn is NOT emitted to avoid misleading users about protection

## Summary

Content protection is a best-effort privacy hint to the OS.
Do not rely on it as a security boundary or make privacy claims based solely on it.
