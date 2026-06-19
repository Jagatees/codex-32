# Codex/32 Project and Test Guide

## 1. Project summary

Codex/32 Workbench is a retro Windows 95-style browser interface for the local
OpenAI Codex engine. It can run as a visual demonstration without Codex, or it
can connect to a locally installed and authenticated Codex CLI to work with
real projects, threads, files, shell commands, reviews, resources, and
automations.

Current package version: `0.3.2`

Default URL: `http://127.0.0.1:4173`

The server intentionally binds only to `127.0.0.1`, so it is available only on
the same computer and is not exposed to the local network.

## 2. Technology and files

- Runtime: Node.js for the local server and Electron for the optional desktop
  package.
- Frontend: plain HTML, CSS, and JavaScript. There is no frontend framework,
  bundler, build step, or npm dependency.
- Protocol: JSON-RPC messages between the browser and Codex.
- Streaming: Server-Sent Events (SSE) from the local bridge to the browser.
- Codex process: `codex app-server --listen stdio://`.

Important files:

- `index.html`: complete UI structure, controls, forms, and dialogs.
- `styles.css`: retro desktop layout, colors, components, and responsive rules.
- `app.js`: application state, UI events, JSON-RPC client, rendering, and demo
  behavior.
- `server.mjs`: static file server and browser-to-Codex stdio bridge.
- `electron-main.cjs`: secure Electron host and owned-server lifecycle.
- `tests/server.test.mjs`: server integration, security, and shutdown checks.
- `package.json`: package metadata, validation, test, launch, and packaging
  scripts.
- `README.md`: installation and quick-start instructions.
- `codex32-preview.png`: README preview image.

## 3. Running the project

Prerequisites for the UI only:

- Node.js installed.

Additional prerequisites for a real Codex connection:

- Codex CLI installed and available as `codex` on `PATH`.
- Codex CLI authenticated and configured.
- Permission for Node.js to start the Codex child process.

Commands:

```powershell
npm run check
npm test
npm run dev
```

Then open `http://127.0.0.1:4173`.

Optional environment variables:

- `PORT`: changes the HTTP port from `4173`.
- `CODEX_BIN`: supplies a different executable or path for the Codex CLI.

## 4. Runtime architecture

1. `server.mjs` serves `index.html`, `styles.css`, `app.js`, and other static
   files from the repository directory.
2. The browser initially displays the workbench in demo mode.
3. A local connection sends `POST /bridge/start`.
4. The server starts `codex app-server --listen stdio://`.
5. Browser JSON-RPC requests are posted to `POST /bridge/rpc` and written to
   Codex standard input.
6. JSON-RPC responses from Codex standard output are matched to pending HTTP
   requests by message ID.
7. Unsolicited Codex notifications and stderr messages are streamed to the
   browser through `GET /bridge/events` using SSE.
8. Direct WebSocket URLs are also accepted by the frontend for compatible
   non-browser proxies.

## 5. User-facing capabilities

### Connection and session

- Demo mode when no Codex server is connected.
- Local stdio connection through the built-in bridge.
- Direct WebSocket connection option.
- Working-directory selection.
- Connection status and activity indicators.
- Model and account information loaded from Codex.

### Threads and projects

- List and search threads.
- Group threads by project directory.
- Start, resume, fork, rename, and archive a thread.
- Roll back the last turn.
- Start context compaction.
- Display current session, workspace, branch, and activity state.

### Agent conversation

- Submit text instructions.
- Attach multiple images and remove attachments before submission.
- Choose Agent or Plan mode.
- Choose reasoning effort from default, low, medium, high, or xhigh.
- Stream agent text and reasoning summaries.
- Stop an active turn.
- Render tool calls, shell commands, file changes, plans, errors, and token use.
- Respond to command and file-change approval requests.

### Files, changes, and terminal

- Load a project file tree from Codex.
- Open a file by asking Codex to display it.
- Show conversation, changes, and activity views.
- Track changed files and display diffs.
- Run shell commands through the active Codex thread.
- Stream command output into the integrated terminal.
- Start an uncommitted-changes review.

### Resources and automation

- List skills, plugins, apps, MCP servers, and configuration information.
- Open automation helper flows for listing, creating, and troubleshooting
  automations.
- Automation operations are performed by Codex tools rather than duplicated in
  the frontend.

### General interface

- Application menus and toolbar actions.
- Command palette, opened by the status button or `Ctrl+K`.
- Settings for sandbox mode, approval policy, and personality.
- About dialog and live clock.
- Collapsible file tree and terminal.

## 6. Test environments

Test in both of these configurations:

1. Demo configuration: Node.js is available, but Codex is absent, blocked, or
   intentionally not connected.
2. Connected configuration: a supported Codex CLI is installed, authenticated,
   and allowed to launch `app-server`.

Recommended browser coverage:

- Codex in-app browser.
- Current Chrome or Edge.
- At least one narrow window size to check responsive layout.

Recommended operating-system coverage:

- Windows PowerShell, because this repository is currently being run there.
- macOS or Linux if those platforms are intended to be supported.

## 7. Release test checklist

### A. Installation and startup

- [ ] `node --version` and `npm --version` succeed.
- [ ] `npm run check` exits with code 0.
- [ ] `npm run dev` prints `CODEX/32 READY` and the correct URL.
- [ ] The root URL returns HTTP 200.
- [ ] The page title is `Codex/32 Workbench`.
- [ ] HTML, CSS, JavaScript, and the preview image return successfully.
- [ ] An unknown path returns HTTP 404.
- [ ] A path-traversal attempt is rejected and cannot read outside the repo.
- [ ] A second server on the same port fails clearly without corrupting files.
- [ ] Setting `PORT` starts and serves the project on the new port.
- [ ] Stopping the process releases the port.

### B. Demo mode and bridge failure

- [ ] The UI loads and remains usable without Codex installed.
- [ ] Status clearly indicates demo mode or a failed link.
- [ ] Submitting an instruction creates a demo queued response.
- [ ] The Execute button changes to Stop while the demo response is pending.
- [ ] A missing or blocked `codex` executable does not crash the HTTP server.
- [ ] A failed connection displays a useful link error.
- [ ] Retrying Link does not create duplicate SSE streams or freeze the UI.
- [ ] Refreshing the page after a failed link still loads the workbench.

### C. Real Codex connection

- [ ] `codex --version` succeeds in the same shell used to start Node.
- [ ] Codex authentication is valid.
- [ ] Link with `local://stdio` reaches a connected state.
- [ ] The bridge starts only one active Codex child process at a time.
- [ ] Models populate and hidden models are excluded.
- [ ] Account type, email, and plan render correctly when available.
- [ ] Disconnect or child-process exit is reflected in the UI.
- [ ] Restarting the connection rejects old pending requests cleanly.
- [ ] JSON-RPC errors appear as readable messages rather than unhandled errors.
- [ ] Malformed bridge JSON returns HTTP 400.
- [ ] RPC requests without a running Codex process return HTTP 503.
- [ ] SSE reconnect behavior is acceptable after a temporary interruption.

### D. Thread and project management

- [ ] Existing threads load in updated-time order.
- [ ] Threads are grouped under the correct project directory.
- [ ] Project groups expand and collapse.
- [ ] Show-more controls reveal additional projects and chats.
- [ ] Search filters threads after the short debounce.
- [ ] Refresh reloads the thread list.
- [ ] New creates a thread with the selected settings.
- [ ] Selecting a thread resumes it and renders its history once.
- [ ] Fork creates and activates a distinct thread with copied history.
- [ ] Rename updates the sidebar and survives refresh.
- [ ] Archive removes the thread from the active list.
- [ ] Rollback removes exactly one turn and refreshes the transcript.
- [ ] Compact starts compaction and reports that it began.
- [ ] Active, waiting, and completed thread states update correctly.

### E. Composer and agent execution

- [ ] Empty or whitespace-only prompts are ignored.
- [ ] Execute submits a normal text prompt.
- [ ] `Ctrl+Enter` submits the prompt exactly once.
- [ ] Agent and Plan mode labels update.
- [ ] Every effort option is passed correctly.
- [ ] The selected model is passed when non-default.
- [ ] Long text, code blocks, quotes, and special characters render safely.
- [ ] Streaming text appends in order without duplicate content.
- [ ] Reasoning summary streaming renders in the intended style.
- [ ] Stop interrupts the active turn and restores the Execute button.
- [ ] A failed turn displays a readable error and restores ready state.
- [ ] Token usage updates the status bar.
- [ ] A second prompt works after success, failure, and interruption.

### F. Attachments

- [ ] Attach opens the file picker.
- [ ] One supported image previews correctly.
- [ ] Multiple images preview in order.
- [ ] Removing one image removes only that image.
- [ ] Images are included in the submitted turn.
- [ ] Attachment previews clear after submission.
- [ ] Canceling the picker changes nothing.
- [ ] Large images fail gracefully if browser or server limits are reached.
- [ ] Unsupported files are blocked or handled clearly.

### G. Rendering and views

- [ ] Conversation shows user, agent, reasoning, system, and error messages.
- [ ] Activity shows diagnostic and tool activity.
- [ ] Changes shows file-change items and accurate diffs.
- [ ] The change badge matches the number of tracked changes.
- [ ] Switching views does not lose transcript data.
- [ ] Command output streams to both the activity item and terminal.
- [ ] MCP, dynamic-tool, and collaboration-agent calls render without crashes.
- [ ] Plans and plan updates render in a readable form.
- [ ] Unknown future item or notification types do not break the page.
- [ ] Untrusted message text is escaped and cannot inject HTML or scripts.

### H. Files and terminal

- [ ] Files toggles the project tree open and closed.
- [ ] The current workspace path is correct.
- [ ] File entries load for the active project.
- [ ] Selecting a file sends the correct file-reading instruction.
- [ ] Paths containing spaces, Unicode, and backslashes work.
- [ ] Terminal toggles open and closed.
- [ ] A simple command runs in the active thread.
- [ ] stdout and stderr stream and remain readable.
- [ ] Empty terminal commands are ignored.
- [ ] A long-running command can be interrupted through the agent controls.
- [ ] Commands requiring approval show the approval dialog.

### I. Approval handling

- [ ] Command-execution approval shows command and reason.
- [ ] File-change approval shows meaningful operation details.
- [ ] Deny sends `decline` and closes the dialog.
- [ ] Allow once sends `accept` and closes the dialog.
- [ ] Allow session sends `acceptForSession` and closes the dialog.
- [ ] Only the currently pending approval is resolved.
- [ ] Connection loss while approval is open does not leave the UI stuck.

### J. Review and git information

- [ ] Review starts an uncommitted-changes review for the active thread.
- [ ] Review progress and final response appear inline.
- [ ] Current git branch renders correctly.
- [ ] Clean and dirty workspace status is accurate if supplied by Codex.
- [ ] A non-git directory renders a safe fallback.

### K. Resources

- [ ] Skills load and show name plus useful details.
- [ ] Plugins load across all marketplaces.
- [ ] Apps load for the active thread.
- [ ] MCP servers show status and authentication detail.
- [ ] Configuration view shows the current effective settings.
- [ ] Empty resource lists show an understandable empty state.
- [ ] Resource API failures show an error without closing the dialog.
- [ ] Switching resource tabs repeatedly does not duplicate rows.

### L. Automations

- [ ] Automation Manager opens and closes.
- [ ] View automations inserts the correct read-only prompt.
- [ ] Create automation inserts a confirmation-first prompt.
- [ ] Fix automation inserts the troubleshooting prompt.
- [ ] Each action focuses the composer and is ready to submit.
- [ ] Automation prompts do not perform destructive changes without approval.

### M. Menus, dialogs, and command palette

- [ ] File, Edit, View, and Agent menus open in the correct position.
- [ ] Clicking outside closes an open menu.
- [ ] Every menu action matches its toolbar or dialog action.
- [ ] Help opens About and displays the correct version.
- [ ] Settings values affect the next new or resumed thread.
- [ ] Settings Cancel does not apply unintended changes.
- [ ] Connection Cancel leaves the current connection unchanged.
- [ ] `Ctrl+K` opens the command palette.
- [ ] Palette search filters commands.
- [ ] Selecting a palette result runs it once and closes the palette.
- [ ] All dialogs close through their close and Cancel controls.
- [ ] Keyboard focus is visible and logical throughout dialogs.

### N. Layout, accessibility, and compatibility

- [ ] The three-column desktop layout is usable at the normal desktop size.
- [ ] Narrow-window behavior does not overlap or hide essential controls.
- [ ] Long thread names, paths, messages, and account names do not break layout.
- [ ] Page remains usable at 200 percent browser zoom.
- [ ] Controls have meaningful accessible names.
- [ ] Tabs, menus, forms, and dialogs are keyboard operable.
- [ ] Focus returns sensibly after a dialog closes.
- [ ] Status does not rely on color alone.
- [ ] Screen-reader announcements for new transcript content are useful.
- [ ] Chrome, Edge, and the Codex in-app browser show equivalent behavior.
- [ ] Browser refresh does not create broken or duplicated application state.

### O. Security and resilience

- [ ] Static file serving cannot escape the repository root.
- [ ] The HTTP server remains bound to loopback only.
- [ ] Message text, filenames, thread names, and resource data are HTML-escaped.
- [ ] Direct WebSocket destinations are validated or clearly user-controlled.
- [ ] Very large request bodies cannot exhaust memory unnoticed.
- [ ] Aborted RPC requests are removed from the pending-request map.
- [ ] SSE clients are removed after close and do not leak over reconnects.
- [ ] Child-process spawn errors and exits never crash the static server.
- [ ] Codex stderr cannot corrupt the JSON-RPC stdout stream.
- [ ] Server shutdown terminates its child Codex process.
- [ ] Sensitive account or configuration values are not written to browser logs.

## 8. Automated test coverage

`npm test` currently verifies health and static serving, 404 behavior, plain and
encoded traversal protection, malformed URL handling, invalid and unavailable
RPC behavior, the 10 MB request limit, and clean shutdown. Future additions
should include:

1. A fake Codex child-process fixture that emits JSON-RPC responses,
   notifications, stderr, spawn failures, and exits.
2. Browser tests for demo submission, connection failure, dialogs, menus,
   command palette, view switching, attachment removal, and HTML escaping.
3. Connected smoke tests gated behind an environment variable for thread
   creation, prompt execution, shell execution, resource listing, and cleanup.
4. Accessibility checks using an automated scanner plus a short manual
   keyboard and screen-reader pass.

## 9. Known current considerations

- On Windows, filesystem URLs must be converted with `fileURLToPath`; using a
  URL pathname directly causes valid static files to be rejected.
- A Codex child-process spawn failure must remain non-fatal so the static UI can
  continue in demo mode.
- The connected Windows test passed with Codex CLI `0.125.0` and ChatGPT
  authentication.
- The generated `.codex32-server.log` and `.codex32-server-error.log` files are
  local runtime artifacts and should not be committed.

## 10. Definition of done

A release is ready when:

- Syntax checks and all automated tests pass.
- The startup, demo, connected, core thread, prompt, shell, approval, resource,
  and security checks above pass.
- No uncaught browser or Node errors occur during the smoke test.
- The static UI survives Codex connection failure and can retry.
- At least one complete connected workflow succeeds: start or resume a thread,
  send an instruction, receive streamed output, run a harmless shell command,
  inspect a file change or review, and stop the server cleanly.
