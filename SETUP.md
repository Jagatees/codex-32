# Codex/32 Setup Guide

This guide covers installation for regular users and contributors. Choose only
the section that matches how you want to run Codex/32.

For the shortest path: install Node.js, clone the repository, run `npm start`,
and leave that terminal open. The browser opens automatically. Codex CLI is
only required when you want the real coding agent instead of demo mode.

## What You Need

### Demo mode

- Windows, macOS, or Linux
- Node.js when running from source
- No Codex account or CLI is required

### Real-agent mode

- Everything required for demo mode
- OpenAI Codex CLI installed and available on `PATH`
- A completed Codex login

The Windows desktop installer bundles its own Node.js runtime. Source launchers
require a normal Node.js installation.

## Windows Installer

This is the simplest Windows setup.

1. Run `Codex 32 Workbench Setup 0.3.2.exe`.
2. Choose an installation folder.
3. Leave the desktop and Start menu shortcut options enabled.
4. Launch **Codex 32 Workbench**.
5. Click **Link**.
6. Keep the transport set to `local://stdio`.

Closing the desktop application stops the local server it started. If another
healthy Codex/32 server already owns port 4173, the desktop app reuses it rather
than starting a duplicate.

## Windows From Source

Install these first:

1. [Git](https://git-scm.com/)
2. [Node.js](https://nodejs.org/), including npm
3. Codex CLI if you want real-agent mode

Then use PowerShell:

```powershell
git clone https://github.com/Jagatees/codex-32.git
Set-Location codex-32
npm start
```

Or double-click `Start Codex32.cmd`. Keep its window open while using the app.
Close it or press `Ctrl+C` to stop the server.

Expected ready message:

```text
CODEX/32 READY: http://127.0.0.1:4173
```

## macOS From Source

Install Git and Node.js, then run:

```sh
git clone https://github.com/Jagatees/codex-32.git
cd codex-32
npm start
```

To use the double-click launcher, first make it executable if needed:

```sh
chmod +x "Start Codex32.command"
```

Then double-click `Start Codex32.command` in Finder. Keep the Terminal window
open. Press `Control+C` or close that Terminal window when finished.

If Gatekeeper blocks a downloaded launcher, open **System Settings > Privacy &
Security** and approve only the launcher you downloaded from the trusted
project release.

## Linux From Source

Install Git, Node.js, npm, and `xdg-open`, then run:

```sh
git clone https://github.com/Jagatees/codex-32.git
cd codex-32
npm start
```

If the browser does not open automatically, open
`http://127.0.0.1:4173` manually. The URL is always printed in the terminal.

## Install and Authenticate Codex CLI

Follow the current Codex CLI installation instructions for your platform. Once
installed, verify it in the same terminal used to start Codex/32:

```sh
codex --version
codex login status
```

If authentication is missing:

```sh
codex login
```

After login, restart Codex/32 or click **Link** again. You do not need to open
the Codex desktop app separately.

## First Connection

1. Open Codex/32.
2. Click **Link** in the toolbar.
3. Keep `local://stdio` selected.
4. Confirm the project path points to the folder you want Codex to use.
5. Click **Connect**.
6. Wait for the status bar to show `APP-SERVER ONLINE`.

The model selector, account card, projects, and threads load after connection.
Slow operations show a spinner and temporarily disable their clicked control.

## Open a Project

1. Click **Open...** in the Projects panel.
2. Enter the full project folder path.
3. Wait for the new thread and file list to load.
4. Click **Files** if the Project Files section is hidden.
5. Click a file to open it in the dedicated **File** tab.

Examples:

```text
C:\Users\name\Projects\my-app
/Users/name/Projects/my-app
/home/name/projects/my-app
```

## Development and Desktop Builds

Install dependencies before Electron development or packaging:

```sh
npm install
```

Then use:

```sh
npm run desktop
npm run check
npm test
```

Build installers on their target operating system:

```powershell
npm run dist:win
```

```sh
npm run dist:mac
```

Windows output is written under `dist/`. macOS signing and notarization require
Apple Developer credentials and must be configured on macOS.

## Change the Port

Default port: `4173`.

PowerShell:

```powershell
$env:PORT=4180
npm start
```

Command Prompt:

```bat
set PORT=4180
npm start
```

macOS or Linux:

```sh
PORT=4180 npm start
```

## Troubleshooting

### Node.js is missing

Install Node.js from `https://nodejs.org/`, close and reopen the terminal, then
verify:

```sh
node --version
npm --version
```

### `codex` is not recognized

Codex/32 will still work in demo mode. To enable real-agent mode, install Codex
CLI, reopen the terminal, and verify `codex --version`.

### Codex is not authenticated

Run:

```sh
codex login
codex login status
```

Then click **Link** again.

### Port 4173 is already in use

The desktop app reuses an existing healthy Codex/32 server. The source launcher
prints a clear error when another application owns that port. Close the other
application or use a different `PORT` as shown above.

PowerShell inspection command:

```powershell
Get-NetTCPConnection -LocalPort 4173 -State Listen
```

### Browser did not open

Open `http://127.0.0.1:4173` manually. If that page does not load, check the
launcher window for a startup or port error.

### Link failed but the interface is open

1. Check `codex --version`.
2. Check `codex login status`.
3. Confirm the Link transport is `local://stdio`.
4. Restart Codex/32 and try Link again.

The static interface remains available in demo mode after a link failure.

### Health check

Open `http://127.0.0.1:4173/health`. A healthy response reports:

- `ok: true`
- host `127.0.0.1`
- the active port
- Node.js version
- Codex CLI status
- authentication status

## Safe Shutdown

- Browser/source mode: press `Ctrl+C` in the launcher terminal.
- Windows double-click launcher: close its Command Prompt window.
- macOS double-click launcher: press `Control+C` or close its Terminal window.
- Electron desktop: close the application window.

Wait for the process to close before launching it again. The desktop app and
server include duplicate-port protection, so a second server is not silently
started on the same address.
