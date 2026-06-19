# Codex/32 Showcase Readiness Report

Date: 2026-06-19

Environment: Windows, PowerShell, Node.js `v22.12.0`, npm `10.9.0`, Codex CLI
`0.125.0`, Codex in-app browser.

## Result

The Windows showcase path is ready. The static server, demo fallback, real
Codex connection, model/account loading, real prompt streaming, PowerShell
terminal execution, project file loading, resources, menus, command palette,
and narrow layout were exercised successfully.

This report does not mark platform or interaction checks as passed when the
required environment was unavailable. See **Outstanding external checks**.

## Fixes completed during testing

- Fixed Windows static-file serving by converting the module URL with
  `fileURLToPath`.
- Fixed Windows Codex CLI launch by enabling the Windows shell for the npm/PS1
  command shim.
- Made Codex child-process spawn errors non-fatal to the static web server.
- Replaced the hardcoded developer macOS workspace with the cross-platform `.`
  default.
- Added PNG MIME handling.
- Hardened static-path resolution and encoded path traversal protection.
- Added malformed URL handling with HTTP 400.
- Added a 10 MB JSON-RPC request-body limit with HTTP 413.
- Added pending RPC cleanup when a request is aborted.
- Made malformed JSON return HTTP 400 before checking Codex availability.
- Closed and cleared an approval dialog when the connection is lost.
- Added readable integrated-terminal error output.
- Added attachment validation: images only, maximum 20 MB, and file-read errors.
- Added a dedicated bounded file viewer with explicit loading, truncation, and
  error states.
- Replaced the multi-megabyte MCP schema request with `toolsAndAuthOnly`, while
  preserving expandable names and descriptions for every reported tool.
- Added stale resource-request protection when switching tabs quickly.
- Added deterministic Node integration tests for server security and lifecycle.
- Replaced static context/session placeholders with live token and elapsed-time
  displays.
- Stopped accumulating RPC request data immediately after the 10 MB limit.

## Verified checklist evidence

### Basic setup and Windows

- [x] `npm run check` passes.
- [x] `npm run dev` starts the server.
- [x] Root URL returns HTTP 200 at `http://127.0.0.1:4173`.
- [x] Page title is `Codex/32 Workbench`.
- [x] `index.html`, `styles.css`, `app.js`, and preview PNG return HTTP 200.
- [x] CSS, JavaScript, HTML, and PNG use correct MIME types.
- [x] Unknown pages return HTTP 404.
- [x] Listener address is exactly `127.0.0.1`.
- [x] Windows PowerShell was used for startup, HTTP, process, and terminal tests.
- [x] Windows backslash workspace path loaded as
  `D:\Github-Local\codex-32`.
- [x] Server process can be stopped, restarted, and the port rebound.

### Demo and failure resilience

- [x] Static workbench renders before or without a Codex connection.
- [x] Demo submission behavior is implemented and retains UI usability.
- [x] Execute changes to Stop while work is active and returns afterward.
- [x] A missing or blocked Codex process no longer crashes the HTTP server.
- [x] Link failure is rendered as a readable UI message.
- [x] Refresh reloads the workbench.
- [x] Re-link replaces the previous process and event channel.

### Real Codex connection

- [x] `codex --version` succeeds in PowerShell.
- [x] `local://stdio` reaches `APP-SERVER ONLINE`.
- [x] Authentication loaded account and plan information.
- [x] Six model choices loaded in the selector.
- [x] A real thread was created and activated.
- [x] Existing projects and threads loaded and grouped by workspace.
- [x] A live prompt streamed the exact response `SHOWCASE_OK`.
- [x] Activity changed to `CODING`, Stop became visible, then returned to Ready.
- [x] A second connected operation succeeded after the prompt.

### Files, terminal, resources, and interface

- [x] Active workspace path is correct.
- [x] Eleven project file entries loaded through the Codex filesystem API.
- [x] File tree opens and closes.
- [x] Integrated terminal opens and closes.
- [x] PowerShell command `Write-Output SHOWCASE_SHELL_OK` succeeded.
- [x] stdout appeared in the integrated terminal.
- [x] Empty terminal commands are ignored by code and do not submit.
- [x] Skills loaded: 25 rows.
- [x] Plugins loaded: first 100 rows.
- [x] Apps loaded: first 100 rows.
- [x] MCP servers loaded: 2 rows with authentication status and expandable
  details for 136 and 3 tools.
- [x] Configuration loaded: 94 rows.
- [x] Resource errors are contained inside the dialog.
- [x] Automation Manager opens and exposes all three requested prompt actions.
- [x] Automation prompt text explicitly requires confirmation before creation
  and forbids deletion without confirmation while troubleshooting.
- [x] Menus open and close.
- [x] `Ctrl+K` opens a palette containing 16 commands.
- [x] Conversation, Changes, and Activity view controls switch views.
- [x] Dialog close controls operate.
- [x] At 640x720, document width equals viewport width with no horizontal
  overflow.
- [x] Codex in-app browser renders and operates the app.

### Composer and rendering

- [x] Empty prompts are rejected before submission.
- [x] Normal prompt submission works.
- [x] `Ctrl+Enter` has a single submit handler.
- [x] Agent and Plan choices are available and update the visible mode label.
- [x] All five effort choices are available.
- [x] User, agent, tool, error, reasoning, plan, and file-change content use text
  nodes or HTML escaping.
- [x] Streaming content appends in order.
- [x] Failed prompt paths restore Ready and show a readable error.
- [x] Unsupported and oversized attachments now show readable errors.
- [x] Attachment filenames are escaped before rendering.
- [x] Successful submission clears attachment state and previews.

### Security and stability

- [x] Encoded traversal `/%2e%2e/package.json` returns HTTP 403.
- [x] Malformed URL encoding returns HTTP 400.
- [x] Static resolution cannot escape the repository root.
- [x] Message labels and content are HTML-escaped.
- [x] Project, file, attachment, and resource display values are escaped.
- [x] Malformed JSON returns a readable HTTP 400 response.
- [x] RPC without Codex returns a readable HTTP 503 response.
- [x] SSE clients are removed on request or response close/error.
- [x] Child-process error and exit handlers prevent an uncaught server crash.
- [x] SIGINT and SIGTERM stop the Codex child before exiting.
- [x] Browser console does not intentionally log account or config payloads.
- [x] Browser console remained free of warnings and errors during connected
  prompt and Resource Manager smoke tests.
- [x] `npm test` passes the local server security and lifecycle suite.

### Windows desktop package

- [x] Fresh `npm run dist:win` build completed successfully.
- [x] Final rebuilt NSIS installer size: 101,788,160 bytes.
- [x] Unpacked application opened one `Codex/32 Workbench` window.
- [x] Bundled server reached healthy state.
- [x] Normal window close released the owned server port.
- [x] Disposable silent install and uninstall both returned exit code 0.
- [x] Installed application reached healthy state before removal.

## Final showcase sequence verified

1. Started the server cleanly.
2. Opened the app in the Codex in-app browser.
3. Connected through `local://stdio`.
4. Loaded authenticated account and model data.
5. Created an active thread in this project.
6. Sent a real prompt and received streamed output.
7. Ran a harmless PowerShell command and saw stdout.
8. Loaded the project file tree.
9. Exercised conversation, changes, activity, and terminal controls.
10. Loaded every Resource Manager category.
11. Opened Automation Manager.
12. Restarted the server after code changes and reconnected successfully.

## Outstanding external checks

These checklist items require environments or manual interactions not available
in this test run and are intentionally not claimed as complete:

- [ ] All macOS Terminal, Safari, macOS path, and macOS process checks.
- [ ] Separate Chrome-versus-Edge parity run.
- [ ] Browser zoom at exactly 200 percent.
- [ ] Manual keyboard-only and screen-reader audit beyond control semantics.
- [ ] Native file-picker cancel, one/multiple image selection, forced unsupported
  file selection, and a real image over 20 MB.
- [ ] A real image-bearing Codex turn. Validation and submission code paths were
  inspected, but the native picker was not automated.
- [ ] Destructive tests against existing history: rename, fork, archive, and
  rollback. Core thread loading and creation passed; existing user threads were
  not modified for QA.
- [ ] All three live approval decisions. Disconnect cleanup and response mapping
  were fixed and inspected, but no deliberately approval-requiring operation was
  forced against the user's active Codex session.
- [ ] Forced SSE network interruption and reconnect under a network proxy.
- [ ] Full long-running-command interruption test.
- [ ] Automated visual inspection of the Electron window. The Windows
  inspection helper was unavailable because its bundled runtime could not load;
  window creation, health, graceful close, install, and uninstall were verified
  through process and endpoint evidence.

## Showcase status

**Ready for a GitHub source release and unsigned Windows preview.**

Do not claim macOS, Safari, Chrome/Edge parity, native file-picker edge cases, or
the destructive thread/approval scenarios as certified until the outstanding
checks above are run in their required environments.
