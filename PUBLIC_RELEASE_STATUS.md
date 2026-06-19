# Public Release Status

## Completed

- [x] One-command run with `npm start`.
- [x] Browser automatically opens after the server becomes ready.
- [x] Windows double-click launcher: `Start Codex32.cmd`.
- [x] macOS double-click launcher: `Start Codex32.command`.
- [x] Startup checks for Node.js, npm in launchers, Codex CLI, Codex login, and
  port availability.
- [x] Friendly startup, missing-Codex, authentication, and port errors.
- [x] Demo mode remains available when Codex is absent or unavailable.
- [x] Electron desktop application implemented with `npm run desktop`.
- [x] Windows NSIS installer built.
- [x] Disposable Windows install, open, close, and uninstall test passed.
- [x] Closing the desktop app stops the local server it owns.
- [x] Reopening or launching beside a healthy existing server does not start a
  duplicate server.
- [x] macOS DMG and ZIP build configuration added through `npm run dist:mac`.

## Release artifacts

- Windows installer: `dist/Codex 32 Workbench Setup 0.3.2.exe`
- Windows unpacked application: `dist/win-unpacked/Codex 32 Workbench.exe`

## GitHub launch decision

The source repository and unsigned Windows preview are ready to publish. The
installer is functional but should be labeled as an unsigned preview until a
publisher certificate and production icon are added. Users may see a Windows
SmartScreen unknown-publisher warning.

## Requires macOS infrastructure

- [ ] Build the configured DMG and ZIP on macOS.
- [ ] Add Apple Developer signing and notarization credentials.
- [ ] Test install, first launch, Codex connection, close/reopen, and removal on
  a fresh macOS machine.
- [ ] Verify the `.command` executable bit and Gatekeeper behavior in the final
  downloadable archive.

## Before publishing broadly

- [ ] Add a Windows publisher signing certificate to remove SmartScreen's
  unknown-publisher warning.
- [ ] Replace Electron's default application icon with production `.ico` and
  `.icns` artwork.
- [ ] Run the existing showcase matrix on fresh Windows and macOS virtual
  machines rather than only the current development machine.
