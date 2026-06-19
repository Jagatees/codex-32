# Codex/32 Workbench

<p align="center">
  <img src="codex32-preview.png" alt="Codex/32 Workbench retro interface" width="90%" />
</p>

**Codex, but it looks like 1995.**

Codex/32 is a local desktop-style interface for the OpenAI Codex coding agent.
It supports real Codex threads, files, terminal commands, changes, reviews,
automations, apps, plugins, skills, and MCP servers.

> Version 0.3.2 | Local address: `http://127.0.0.1:4173`

## Start Here

### Most users: run from source

Install [Node.js](https://nodejs.org/), then run these commands in a terminal:

```sh
git clone https://github.com/Jagatees/codex-32.git
cd codex-32
npm start
```

Your browser opens automatically at `http://127.0.0.1:4173`. Keep the terminal
window open while using Codex/32, and press `Ctrl+C` there when finished.

Codex/32 starts in demo mode if the Codex CLI is unavailable. To use the real
agent, install and sign in to the Codex CLI, then click **Link** and keep
`local://stdio` selected.

### Windows installer

Download `Codex 32 Workbench Setup 0.3.2.exe` from the GitHub Releases page when
an installer asset is available. The current installer is an unsigned preview,
so Windows may show an unknown-publisher warning. Only run artifacts downloaded
from this repository's official release page.

## Choose Your Setup

| User | Recommended option | Requirements |
| --- | --- | --- |
| Windows user | Install `Codex 32 Workbench Setup 0.3.2.exe` | Codex CLI only for real-agent mode |
| Windows source user | Double-click `Start Codex32.cmd` | Node.js; Codex CLI optional |
| macOS source user | Double-click `Start Codex32.command` | Node.js; Codex CLI optional |
| Linux or terminal user | Run `npm start` | Node.js and npm; Codex CLI optional |
| Contributor | Run `npm install`, then `npm run dev` | Node.js, npm, and Git |

See [SETUP.md](SETUP.md) for complete Windows, macOS, Linux, authentication,
port, and troubleshooting instructions.

## Setup Details

### Windows installer

1. Download or build `Codex 32 Workbench Setup 0.3.2.exe`.
2. Run the installer.
3. Open **Codex 32 Workbench** from the desktop or Start menu.
4. Click **Link** and keep `local://stdio` to use the real Codex agent.

The installed desktop app includes its own Node.js runtime. Codex CLI remains
optional: without it, the interface still works in demo mode.

### From source on any platform

The **Start Here** commands above need Node.js but do not require `npm install`.
Run `npm install` only for Electron desktop development, tests, or installer
builds.

## Enable Real Codex

Codex/32 does not require the Codex desktop app to be open. It launches the
installed Codex CLI through its local bridge.

Verify the CLI and login once:

```sh
codex --version
codex login status
```

If login is required:

```sh
codex login
```

Then open Codex/32, click **Link**, and use `local://stdio`. Your existing Codex
configuration and authentication are reused.

## Features

- Retro Windows-style workbench with responsive layout
- Demo mode when Codex CLI is missing or unavailable
- Automatic local Codex app-server bridge
- Thread search, resume, fork, archive, rename, rollback, and compaction
- Project file tree and a dedicated File tab for reading file contents
- Integrated terminal and streamed command output
- Conversation, File, Changes, and Activity tabs
- Loading indicators for slower files, resources, connections, and threads
- Models, account status, approvals, settings, and token usage
- Automations, apps, plugins, skills, MCP, and configuration browsing
- Image attachments, tool rendering, plans, diffs, and code review

## Commands

```sh
npm start       # Start server and open the default browser
npm run dev     # Start server without opening a browser
npm run desktop # Open the Electron desktop application
npm run check   # Validate JavaScript syntax
npm test        # Run server security and lifecycle tests
npm run dist:win # Build the Windows NSIS installer on Windows
npm run dist:mac # Build macOS DMG and ZIP artifacts on macOS
```

Electron development and packaging require dependencies first:

```sh
npm install
```

## Local and Private

The server binds only to `127.0.0.1`, so other computers cannot connect to it.
The browser communicates with Codex through local JSON-RPC and Server-Sent
Events. Codex owns authentication, threads, automation schedules, and tool
behavior.

Check startup health at
[`http://127.0.0.1:4173/health`](http://127.0.0.1:4173/health).

## Documentation

- [Setup and troubleshooting](SETUP.md)
- [Project and QA test guide](PROJECT_TEST_GUIDE.md)
- [Standalone launcher readiness](STANDALONE_READINESS.md)
- [Public release status](PUBLIC_RELEASE_STATUS.md)
- [Showcase test results](SHOWCASE_READINESS_REPORT.md)

## Current Release Notes

- The Windows installer has passed install, launch, close, port cleanup, reopen,
  and uninstall tests on Windows.
- macOS packaging is configured but still requires building, signing,
  notarization, and fresh-machine testing on macOS.
- Local Windows artifacts are not publisher-signed, so SmartScreen may display
  an unknown-publisher warning until release signing is configured.

## License

Apache-2.0, matching the upstream Codex project.
