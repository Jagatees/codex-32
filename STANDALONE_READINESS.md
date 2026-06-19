# Standalone Launcher Readiness

## Completed

- `npm start` performs startup checks, starts the local server, opens the
  browser, prints the URL, and remains attached until stopped.
- `npm run dev` remains available for server-only development startup.
- `Start Codex32.cmd` provides a Windows double-click launcher.
- `Start Codex32.command` provides a macOS double-click launcher.
- Windows, macOS, and Linux browser-opening commands are supported.
- Node.js, Codex CLI, and Codex authentication checks are printed at startup.
- Missing or unauthenticated Codex is a warning and preserves demo mode.
- Port conflicts exit clearly instead of producing an unhandled stack trace.
- `/health` reports local startup status and dependency checks.
- SIGINT and SIGTERM close the Codex child process and HTTP server.
- The server remains bound only to `127.0.0.1`.

## Verified on Windows

- Node.js `v22.12.0`, npm `10.9.0`, and Codex CLI `0.125.0` detected.
- Authentication detected as `Logged in using ChatGPT`.
- One-command server reached Ready and returned HTTP 200 health status.
- A duplicate server exited with code 1 and a readable port message.
- SIGTERM stopped the launcher process and released its test port.
- Real Codex mode and demo fallback were already verified in the showcase test.

## Native packaging exploration

Electron packaging is now implemented. The desktop host bundles the UI and Node
runtime, starts the local server, opens a dedicated application window, reuses
an existing healthy server, and stops a server that it owns when quitting.

Completed Windows packaging evidence:

- NSIS installer built at `dist/Codex 32 Workbench Setup 0.3.2.exe`.
- Unpacked desktop application starts its bundled server and reports healthy.
- Normal window close releases the owned port.
- Silent disposable install completed with exit code 0.
- Installed application opened and passed its health check.
- Installed application close released its port.
- Silent uninstall completed with exit code 0 and removed the install folder.
- Codex CLI remains external so the app reuses user authentication and updates.

## Still requires platform release testing

- Double-click and close behavior on a fresh macOS machine.
- Browser opening through `open` on macOS and `xdg-open` on Linux.
- macOS executable permission and Gatekeeper behavior for downloaded archives.
- Signed public Windows and macOS packages. The local Windows build is
  installable but is not code-signed with a publisher certificate.
- macOS DMG/ZIP build, signing, notarization, installation, and uninstall.
- Fresh-machine tests where Node.js, npm, Codex CLI, or authentication are
  intentionally absent.

These checks cannot be certified from the current Windows machine. The launcher
code and friendly fallback paths are present, but platform claims should be made
only after running the corresponding release matrix.
