const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const state = {
  socket: null, events: null, transport: null, connected: false, threadId: null, turnId: null,
  requestId: 1, pending: new Map(), streams: new Map(), threads: [], changes: new Map(),
  approval: null, textAction: null, currentView: "chat", cwd: "", account: null,
  turnHadAgent: false, attachments: [],
  expandedProjects: new Set(), projectLimits: new Map(), chatLimit: 8,
  resourceLoadId: 0,
  sessionStartedAt: Date.now(),
};

const commands = [
  ["New thread", "new-thread"], ["Refresh threads", "refresh-threads"], ["Fork current thread", "fork-thread"],
  ["Rename thread", "rename-thread"], ["Archive thread", "archive-thread"], ["Review uncommitted changes", "review"],
  ["Interrupt active turn", "interrupt"], ["Rollback last turn", "rollback"], ["Compact context", "compact"],
  ["Show project files", "toggle-tree"], ["Show terminal", "toggle-terminal"], ["Open resource manager", "resources"],
  ["Manage automations", "automations"], ["Open settings", "settings"], ["Open project", "open-project"], ["Connection properties", "connect"],
];
const menus = {
  file: [["Open Project...", "open-project"], ["New Thread", "new-thread"], ["Fork Thread", "fork-thread"], ["Rename Thread...", "rename-thread"], ["Archive Thread", "archive-thread"], ["Connection...", "connect"]],
  edit: [["Cut", "cut"], ["Copy", "copy"], ["Paste", "paste"], ["Select All", "select-all"]],
  view: [["Conversation", "view-chat"], ["Changes", "view-changes"], ["Activity", "view-diagnostics"], ["Project Files", "toggle-tree"], ["Integrated Terminal", "toggle-terminal"], ["Automations", "automations"], ["Resources", "resources"]],
  agent: [["Execute", "focus-prompt"], ["Interrupt", "interrupt"], ["Review Changes", "review"], ["Rollback Turn", "rollback"], ["Compact Context", "compact"], ["Settings", "settings"]],
};

function timestamp() { return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }); }
function escapeText(text = "") { const node = document.createElement("div"); node.textContent = String(text); return node.innerHTML; }
function errorMessage(error) {
  if (!error) return "Unknown app-server error";
  if (typeof error === "string") { try { return errorMessage(JSON.parse(error)); } catch { return error; } }
  return error.message || error.error?.message || JSON.stringify(error);
}
function setActivity(label, busy = false) { $("#activity-label").textContent = label; $(".activity").classList.toggle("busy", busy); $(".stop-button").hidden = !busy; $(".send-button").hidden = busy; }
function setConnection(label, kind = "amber") { $("#connection-label").textContent = label; $("#connection-led").className = `led ${kind}`; }
function logActivity(text) { addMessage("diagnostic", "EVENT LOG", text); }
function setButtonBusy(button, busy) {
  if (!button) return;
  button.classList.toggle("is-loading", busy); button.disabled = busy;
  if (busy) button.setAttribute("aria-busy", "true"); else button.removeAttribute("aria-busy");
}

function request(method, params = {}) {
  if (!state.connected) return Promise.reject(new Error("Not connected"));
  const id = state.requestId++; const message = { method, id, params };
  if (state.transport === "bridge") return fetch("/bridge/rpc", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(message) })
    .then((response) => response.json()).then((reply) => { if (reply.error) throw new Error(reply.error.message); return reply.result; });
  state.socket.send(JSON.stringify(message));
  return new Promise((resolve, reject) => state.pending.set(id, { resolve, reject }));
}
function notify(method, params = {}) {
  const body = JSON.stringify({ method, params });
  if (state.transport === "bridge") return fetch("/bridge/rpc", { method: "POST", headers: { "Content-Type": "application/json" }, body });
  state.socket.send(body);
}

async function connect() {
  setButtonBusy($("#connect-submit"), true);
  if (state.socket) { state.socket.onclose = null; state.socket.close(); }
  if (state.events) { state.events.onerror = null; state.events.close(); }
  setConnection("CONNECTING...", "amber"); setActivity("LINKING", true);
  if ($("#server-url").value.trim() === "local://stdio") return connectBridge();
  state.transport = "websocket"; state.socket = new WebSocket($("#server-url").value.trim());
  state.socket.onopen = () => initializeConnection();
  state.socket.onmessage = ({ data }) => handleMessage(JSON.parse(data));
  state.socket.onerror = () => connectionFailed(new Error("WebSocket connection failed"));
  state.socket.onclose = disconnect;
}
async function connectBridge() {
  state.transport = "bridge";
  const started = await fetch("/bridge/start", { method: "POST" });
  if (!started.ok) return connectionFailed(new Error("Local bridge failed to start"));
  const events = new EventSource("/bridge/events"); state.events = events; events.onmessage = (event) => handleMessage(JSON.parse(event.data));
  events.onerror = () => { if (state.events === events && state.connected) connectionFailed(new Error("Local event channel closed")); };
  return initializeConnection();
}
async function initializeConnection() {
  state.connected = true;
  try {
    await request("initialize", { clientInfo: { name: "codex_32bit", title: "Codex/32 Workbench", version: "0.3.2" }, capabilities: { experimentalApi: true } });
    await notify("initialized"); setConnection("APP-SERVER ONLINE", "green"); setActivity("READY");
    addMessage("system", "LINK MANAGER", "Codex app-server connected. Loading desktop services...");
    await loadDesktop(); setButtonBusy($("#connect-submit"), false);
  } catch (error) { connectionFailed(error); }
}
function disconnect() {
  state.connected = false; state.threadId = null; state.approval = null;
  if ($("#approval-dialog").open) $("#approval-dialog").close();
  setConnection("DEMO MODE", "amber"); setActivity("READY"); setButtonBusy($("#connect-submit"), false);
  $("#context-meter").style.width = "0%"; $("#context-label").textContent = "AWAITING DATA";
}
function connectionFailed(error) { disconnect(); setConnection("LINK FAILED", "red"); addMessage("system", "LINK ERROR", error.message); }

async function loadDesktop() {
  const [models, account] = await Promise.allSettled([request("model/list", { limit: 50 }), request("account/read", { refreshToken: false })]);
  if (models.status === "fulfilled") renderModels(models.value.data);
  if (account.status === "fulfilled") renderAccount(account.value.account);
  await Promise.allSettled([loadThreads(), loadProjectFiles()]);
  if (!state.threadId) await startThread();
}
function renderModels(models) {
  const select = $("#model"); select.innerHTML = '<option value="">Configured default</option>';
  models.filter((model) => !model.hidden).forEach((model) => select.add(new Option(model.displayName, model.model)));
  $("#status-model").textContent = `MODEL: ${select.selectedOptions[0]?.textContent || "DEFAULT"}`;
}
function renderAccount(account) {
  state.account = account; const label = !account ? "AUTHENTICATION REQUIRED" : account.type === "chatgpt" ? `${account.email}\n${account.planType || "CHATGPT"}` : account.type.toUpperCase();
  $("#account-card").textContent = label;
}

async function loadThreads(searchTerm = $("#thread-search").value.trim()) {
  if (!state.connected) return;
  const response = await request("thread/list", { limit: 200, sortKey: "updated_at", sortDirection: "desc", searchTerm: searchTerm || undefined });
  state.threads = response.data; renderThreads();
}
function statusType(thread) { return thread.status?.type || "notLoaded"; }
function projectName(cwd) { return cwd?.split(/[\\/]/).filter(Boolean).pop() || "Unknown Project"; }
function relativeTime(seconds) {
  const elapsed = Math.max(0, Date.now() / 1000 - seconds); const units = [[60, "s"], [60, "m"], [24, "h"], [7, "d"], [4.35, "w"], [12, "mo"]];
  let value = elapsed;
  for (const [size, suffix] of units) { if (value < size) return `${Math.max(1, Math.floor(value))}${suffix}`; value /= size; }
  return `${Math.floor(value)}y`;
}
function threadButton(thread, nested = false) {
  const title = thread.name || thread.preview || "Untitled session"; const active = thread.id === state.threadId;
  return `<button class="thread${nested ? " nested-thread" : ""}${active ? " selected" : ""}" data-thread-id="${thread.id}"><span class="thread-led ${statusType(thread)}"></span><span><b>${escapeText(title.slice(0, 52))}</b></span><time>${active ? "NOW" : relativeTime(thread.updatedAt)}</time></button>`;
}
function renderThreads() {
  const groups = new Map();
  state.threads.forEach((thread) => { const cwd = thread.cwd || ""; if (!groups.has(cwd)) groups.set(cwd, []); groups.get(cwd).push(thread); });
  if (state.cwd && !state.expandedProjects.size) state.expandedProjects.add(state.cwd);
  const projects = [...groups.entries()].sort((a, b) => b[1][0].updatedAt - a[1][0].updatedAt);
  $("#project-list").innerHTML = projects.length ? projects.map(([cwd, threads]) => {
    const expanded = state.expandedProjects.has(cwd); const limit = state.projectLimits.get(cwd) || 5;
    return `<section class="project-group"><button class="project-row${cwd === state.cwd ? " current" : ""}" data-project-cwd="${escapeText(cwd)}"><span class="folder-glyph">▰</span><b>${escapeText(projectName(cwd))}</b><span>${expanded ? "▾" : "▸"}</span></button>${expanded ? `<div class="project-threads">${threads.slice(0, limit).map((thread) => threadButton(thread, true)).join("")}${threads.length > limit ? `<button class="show-more" data-show-project="${escapeText(cwd)}">Show more</button>` : ""}</div>` : ""}</section>`;
  }).join("") : '<div class="empty-state">NO PROJECTS FOUND</div>';
  const otherChats = state.threads.filter((thread) => thread.cwd !== state.cwd);
  $("#chat-list").innerHTML = otherChats.length ? otherChats.slice(0, state.chatLimit).map((thread) => threadButton(thread)).join("") + (otherChats.length > state.chatLimit ? '<button class="show-more" data-show-chats>Show more</button>' : "") : '<div class="empty-state">NO OTHER CHATS</div>';
}
async function startThread() {
  if (!state.connected) return;
  clearTranscript(); state.changes.clear(); updateChangeCount();
  const response = await request("thread/start", threadSettings()); activateThread(response.thread, response);
  await loadThreads();
}
async function resumeThread(threadId) {
  if (!state.connected || threadId === state.threadId) return;
  setActivity("LOADING", true); clearTranscript(); state.changes.clear();
  try { const response = await request("thread/resume", { threadId, ...threadSettings() }); activateThread(response.thread, response); renderHistory(response.thread.turns); await loadThreads(); }
  catch (error) { addMessage("system", "SESSION ERROR", error.message); setActivity("READY"); }
}
function activateThread(thread, response = {}) {
  state.threadId = thread.id; state.turnId = null; state.cwd = response.cwd || thread.cwd || state.cwd; $("#session-id").textContent = thread.id.slice(0, 12).toUpperCase();
  state.sessionStartedAt = Date.now();
  state.expandedProjects.add(state.cwd);
  $("#workspace-path").textContent = state.cwd; $("#git-branch").textContent = thread.gitInfo?.branch || "NO BRANCH";
  $("#cwd").value = state.cwd; syncThreadActivity(thread); renderThreads(); loadProjectFiles();
}
function threadSettings() {
  return { cwd: $("#cwd").value || state.cwd || undefined, model: $("#model").value || undefined, approvalPolicy: $("#approval-policy").value, sandbox: $("#sandbox").value, personality: $("#personality").value || undefined };
}
function renderHistory(turns = []) { turns.forEach((turn) => turn.items?.forEach(renderItem)); updateChangeCount(); applyView(); }

function syncThreadActivity(thread) {
  const activeTurn = [...(thread.turns || [])].reverse().find((turn) => turn.status === "inProgress");
  const status = statusType(thread);
  if (activeTurn) state.turnId = activeTurn.id;
  if (status === "systemError") { state.turnId = null; return setActivity("ERROR"); }
  if (status !== "active" && !activeTurn) { state.turnId = null; return setActivity("READY"); }
  const waiting = thread.status?.activeFlags?.some((flag) => ["waitingOnApproval", "waitingOnUserInput"].includes(flag));
  setActivity(waiting ? "WAITING" : "CODING", !waiting);
}

async function loadProjectFiles() {
  const cwd = $("#cwd").value || state.cwd; if (!state.connected || !cwd) return;
  try {
    const response = await request("fs/readDirectory", { path: cwd }); const entries = response.entries.sort((a, b) => Number(b.isDirectory) - Number(a.isDirectory) || a.fileName.localeCompare(b.fileName)).slice(0, 40);
    $(".tree").innerHTML = `<button class="tree-row open">▾ <span class="folder">▰</span> ${escapeText(cwd.split("/").pop() || cwd)}</button>` + entries.map((entry, i) => `<button class="tree-row child" ${entry.isFile ? `data-file="${escapeText(`${cwd}/${entry.fileName}`)}"` : ""}>${i === entries.length - 1 ? "└" : "├"}─ <span>${entry.isDirectory ? "▰" : "▧"}</span> ${escapeText(entry.fileName)}</button>`).join("");
  } catch { /* filesystem RPC may be disabled by policy */ }
}

function clearTranscript() { $("#transcript").innerHTML = ""; state.streams.clear(); }
function addMessage(kind, label, text, id, view) {
  const article = document.createElement("article"); article.className = `message ${kind}-message`; if (id) article.dataset.itemId = id;
  if (state.turnId) article.dataset.turnId = state.turnId;
  const initials = { user: "YOU", tool: "EXE", system: "SYS", reasoning: "THK", plan: "PLN", change: "DIF", diagnostic: "LOG" }[kind] || "CDX";
  article.innerHTML = `<div class="message-gutter">${initials}<br>${timestamp()}</div><div class="message-body"><div class="message-label">${escapeText(label)}</div><p>${escapeText(text)}</p></div>`;
  article.dataset.view = view || (kind === "change" ? "changes" : ["tool", "reasoning", "diagnostic"].includes(kind) ? "diagnostics" : "chat");
  $("#transcript").append(article); applyView(); article.scrollIntoView({ block: "end" }); return $("p", article);
}
function renderItem(item) {
  if (!item || $(`[data-item-id="${CSS.escape(item.id)}"]`)) return;
  if (item.type === "userMessage") return addMessage("user", "OPERATOR", item.content?.filter((c) => c.type === "text").map((c) => c.text).join("\n") || "Attached input", item.id);
  if (item.type === "agentMessage") return addMessage("agent", "CODEX AGENT", item.text, item.id, item.phase === "commentary" ? "diagnostics" : "chat");
  if (item.type === "reasoning") return addMessage("reasoning", "REASONING SUMMARY", item.summary?.join("\n") || "Thinking...", item.id);
  if (item.type === "plan") return addMessage("plan", "EXECUTION PLAN", item.text, item.id);
  if (item.type === "commandExecution") return addToolItem(item);
  if (item.type === "fileChange") return addFileChange(item);
  if (["mcpToolCall", "dynamicToolCall", "collabAgentToolCall"].includes(item.type)) return addMessage("tool", `${item.type.toUpperCase()} // ${item.tool || "AGENT"}`, JSON.stringify(item.arguments || item.prompt || item.status, null, 2), item.id);
  if (item.type === "webSearch") return addMessage("tool", "WEB SEARCH", item.query, item.id);
  if (["enteredReviewMode", "exitedReviewMode"].includes(item.type)) return addMessage("system", "CODE REVIEW", item.review || item.type, item.id);
}
function addToolItem(item) {
  const text = `${item.command || "Workspace operation"}${item.cwd ? `\nDIR: ${item.cwd}` : ""}`; const node = addMessage("tool", "COMMAND PROCESSOR", text, item.id);
  if (item.aggregatedOutput) node.textContent += `\n\n${item.aggregatedOutput}`;
  $("#terminal-output").textContent += `\nC:\\> ${item.command || text}`; return node;
}
function addFileChange(item) {
  item.changes?.forEach((change) => state.changes.set(change.path, change)); updateChangeCount();
  return addMessage("change", "FILE CHANGE", item.changes?.map((change) => `${change.kind}: ${change.path}\n${change.diff || ""}`).join("\n\n") || "Applying patch...", item.id);
}
function completeItem(item) {
  if (item.type === "agentMessage") state.turnHadAgent = true;
  const node = $(`[data-item-id="${CSS.escape(item.id)}"] p`); if (!node) return renderItem(item);
  if (item.type === "agentMessage") node.textContent = item.text;
  if (item.type === "commandExecution" && item.aggregatedOutput) node.textContent = `${item.command}\n\n${item.aggregatedOutput}\n[exit ${item.exitCode ?? "?"}]`;
  if (item.type === "fileChange") { item.changes?.forEach((change) => state.changes.set(change.path, change)); updateChangeCount(); }
  if (item.type === "agentMessage") {
    const article = node.closest("article"); const turnId = article.dataset.turnId;
    const matches = $$(".agent-message").filter((message) => message.dataset.turnId === turnId && $("p", message)?.textContent === item.text);
    matches.slice(0, -1).forEach((message) => message.remove());
  }
}
function updateChangeCount() { $("#change-count").textContent = state.changes.size; }

function handleMessage(message) {
  if (message.id !== undefined) { const pending = state.pending.get(message.id); if (!pending) return; state.pending.delete(message.id); message.error ? pending.reject(new Error(message.error.message)) : pending.resolve(message.result); return; }
  const p = message.params || {};
  const isCurrentThread = !p.threadId || p.threadId === state.threadId;
  if (message.method === "turn/started" && isCurrentThread) { state.turnId = p.turn.id; state.turnHadAgent = false; setActivity("CODING", true); }
  if (message.method === "item/started" && isCurrentThread) renderItem(p.item);
  if (message.method === "item/completed" && isCurrentThread) completeItem(p.item);
  if (message.method === "item/agentMessage/delta" && isCurrentThread) { state.turnHadAgent = true; appendDelta(p.itemId, p.delta, "agent", "CODEX AGENT"); }
  if (message.method === "item/reasoning/summaryTextDelta" && isCurrentThread) appendDelta(p.itemId, p.delta, "reasoning", "REASONING SUMMARY");
  if (message.method === "item/plan/delta" && isCurrentThread) appendDelta(p.itemId, p.delta, "plan", "EXECUTION PLAN");
  if (message.method === "item/commandExecution/outputDelta" && isCurrentThread) { const node = $(`[data-item-id="${CSS.escape(p.itemId)}"] p`); if (node) node.textContent += p.delta; $("#terminal-output").textContent += p.delta; }
  if (message.method === "turn/completed" && isCurrentThread) {
    state.turnId = null; setActivity("READY"); updateTasks("done");
    if (p.turn?.status === "failed" || p.turn?.error) addMessage("system", "TURN FAILED", errorMessage(p.turn.error));
    else if (!state.turnHadAgent && p.turn?.items?.some((item) => item.type === "userMessage")) addMessage("system", "TURN COMPLETE", "Codex completed without an assistant message.");
    loadThreads();
  }
  if (message.method === "thread/status/changed") {
    if (isCurrentThread) syncThreadActivity({ status: p.status, turns: [] });
    loadThreads();
  }
  if (message.method === "error" && isCurrentThread) { setActivity(p.willRetry ? "RETRYING" : "READY", p.willRetry); addMessage("system", "APP-SERVER ERROR", errorMessage(p.error || p.message)); }
  if (message.method === "thread/tokenUsage/updated" && isCurrentThread) renderUsage(p.tokenUsage);
  if (message.method === "thread/name/updated" || message.method === "thread/archived") loadThreads();
  if (["item/commandExecution/requestApproval", "item/fileChange/requestApproval"].includes(message.method)) showApproval(message);
  if (message.method === "bridge/exit") connectionFailed(new Error(`Codex exited (${p.code ?? "unknown"})`));
}
function appendDelta(id, delta, kind, label) { let node = state.streams.get(id); if (!node) { node = addMessage(kind, label, "", id); state.streams.set(id, node); } node.textContent += delta; node.closest("article").scrollIntoView({ block: "end" }); }
function renderUsage(usage) {
  const total = usage?.total?.totalTokens ?? usage?.totalTokens ?? usage?.total_tokens;
  if (total == null) return;
  $("#status-context").textContent = `TOKENS: ${Number(total).toLocaleString()}`;
  const windowSize = usage?.modelContextWindow ?? usage?.model_context_window ?? usage?.contextWindow;
  if (windowSize) {
    const percent = Math.min(100, Math.round(Number(total) / Number(windowSize) * 100));
    $("#context-meter").style.width = `${percent}%`; $("#context-label").textContent = `${percent}% USED`;
  } else { $("#context-label").textContent = `${Number(total).toLocaleString()} TOKENS`; }
}

function updateSessionTimer() {
  const seconds = Math.max(0, Math.floor((Date.now() - state.sessionStartedAt) / 1000));
  const hours = String(Math.floor(seconds / 3600)).padStart(2, "0");
  const minutes = String(Math.floor(seconds % 3600 / 60)).padStart(2, "0");
  const remainder = String(seconds % 60).padStart(2, "0");
  $("#session-timer").textContent = `${hours}:${minutes}:${remainder}`;
  $("#session-meter").style.width = `${Math.min(100, seconds / 36)}%`;
}

function showApproval(message) { state.approval = message; $("#approval-command").textContent = message.params.command || message.params.reason || "Apply workspace file changes"; $("#approval-reason").textContent = message.params.reason || "This operation requires confirmation."; $("#approval-dialog").showModal(); }
async function resolveApproval(decision) { if (!state.approval) return; await sendServerResponse(state.approval.id, { decision }); state.approval = null; $("#approval-dialog").close(); }
async function sendServerResponse(id, result) { const body = JSON.stringify({ id, result }); if (state.transport === "bridge") return fetch("/bridge/rpc", { method: "POST", headers: { "Content-Type": "application/json" }, body }); state.socket.send(body); }

async function submitPrompt(event) {
  event.preventDefault(); const input = $("#prompt"); let text = input.value.trim(); if (!text) return;
  input.value = ""; if ($("#mode").value === "plan") text = `Create a concise implementation plan first, then wait for confirmation before editing.\n\n${text}`;
  updateTasks("active"); setActivity("CODING", true);
  if (!state.connected) { addMessage("user", "OPERATOR", text); return demoResponse(text); }
  try {
    if (!state.threadId) await startThread(); const turnInput = [{ type: "text", text, text_elements: [] }, ...state.attachments.map((file) => ({ type: "image", url: file.url }))];
    const params = { threadId: state.threadId, input: turnInput }; state.attachments = []; renderAttachments();
    if ($("#model").value) params.model = $("#model").value; if ($("#effort").value) params.effort = $("#effort").value;
    await request("turn/start", params);
  } catch (error) { addMessage("system", "EXECUTION ERROR", error.message); setActivity("READY"); }
}
function demoResponse(text) { setTimeout(() => { addMessage("tool", "DEMO PROCESSOR", `Queued: ${text}\nConnect through Link to execute.`); setActivity("READY"); }, 500); }
function updateTasks(mode) { $("#task-list").innerHTML = mode === "done" ? '<li class="done"><span>✓</span> Instruction complete</li><li class="active"><span>►</span> Await instruction</li>' : '<li class="done"><span>✓</span> Input accepted</li><li class="active"><span>►</span> Agent working</li><li><span>□</span> Verify result</li>'; }

async function runThreadAction(name) {
  if (!state.threadId) return addMessage("system", "SESSION MANAGER", "Select or create a thread first.");
  try {
    if (name === "fork-thread") { const response = await request("thread/fork", { threadId: state.threadId, ...threadSettings() }); clearTranscript(); activateThread(response.thread, response); renderHistory(response.thread.turns); }
    if (name === "archive-thread") { await request("thread/archive", { threadId: state.threadId }); state.threadId = null; clearTranscript(); await loadThreads(); }
    if (name === "review") { await request("review/start", { threadId: state.threadId, target: { type: "uncommittedChanges" }, delivery: "inline" }); setActivity("REVIEWING", true); }
    if (name === "interrupt" && state.turnId) await request("turn/interrupt", { threadId: state.threadId, turnId: state.turnId });
    if (name === "rollback") { const response = await request("thread/rollback", { threadId: state.threadId, numTurns: 1 }); clearTranscript(); renderHistory(response.thread.turns); $("#settings-dialog").close(); }
    if (name === "compact") { await request("thread/compact/start", { threadId: state.threadId }); $("#settings-dialog").close(); addMessage("system", "CONTEXT MANAGER", "Compaction started."); }
    if (name === "rename-thread") promptText("RENAME THREAD", "Thread name", state.threads.find((t) => t.id === state.threadId)?.name || "", async (value) => { await request("thread/name/set", { threadId: state.threadId, name: value }); await loadThreads(); });
  } catch (error) { addMessage("system", "OPERATION ERROR", error.message); setActivity("READY"); }
}

async function runShell(event) {
  event.preventDefault(); const input = $("#terminal-input"); const command = input.value.trim();
  if (!command || !state.threadId) return;
  input.value = ""; $("#terminal-output").textContent += `\nC:\\> ${command}\n`;
  try { await request("thread/shellCommand", { threadId: state.threadId, command }); }
  catch (error) { $("#terminal-output").textContent += `ERROR: ${errorMessage(error)}\n`; }
}
function tabButtons() { return $$('.document-tabs [data-view]'); }
function switchView(view) {
  state.currentView = view; tabButtons().forEach((button) => button.classList.toggle("selected", button.dataset.view === view));
  const viewingFile = view === "file"; $("#transcript").hidden = viewingFile; $("#file-viewer").hidden = !viewingFile; $("#composer").hidden = viewingFile;
  applyView(); $("#transcript").scrollTop = 0;
}
function applyView() {
  if (state.currentView === "file") return;
  const messages = $$("#transcript .message");
  let visibleCount = 0;
  messages.forEach((message) => {
    message.hidden = (message.dataset.view || "chat") !== state.currentView;
    if (!message.hidden) visibleCount += 1;
  });
  $("#view-empty-state")?.remove();
  if (!visibleCount) {
    const labels = { chat: "NO CONVERSATION YET", changes: "NO FILE CHANGES", diagnostics: "NO ACTIVITY EVENTS" };
    const empty = document.createElement("div"); empty.id = "view-empty-state"; empty.className = "empty-state view-empty-state"; empty.textContent = labels[state.currentView];
    $("#transcript").append(empty);
  }
}

async function loadResources(kind) {
  const loadId = ++state.resourceLoadId;
  const list = $("#resource-list"); list.innerHTML = '<div class="empty-state">SCANNING...</div>'; $$('[data-resource]').forEach((button) => button.classList.toggle("selected", button.dataset.resource === kind));
  try {
    let rows = [];
    if (kind === "skills") { const result = await request("skills/list", { cwds: [state.cwd], forceReload: false }); rows = result.data.flatMap((entry) => entry.skills || entry); }
    if (kind === "plugins") { const result = await request("plugin/list", { cwds: [state.cwd] }); rows = result.marketplaces.flatMap((market) => market.plugins || market.entries || [market]); }
    if (kind === "apps") { const result = await request("app/list", { limit: 100, threadId: state.threadId, forceRefetch: false }); rows = result.data; }
    if (kind === "mcp") { const result = await request("mcpServerStatus/list", { detail: "toolsAndAuthOnly", threadId: state.threadId }); rows = result.data.map((server) => ({ ...server, resourceType: "mcp" })); }
    if (kind === "config") { const result = await request("config/read", { includeLayers: false }); rows = Object.entries(result.config).map(([name, value]) => ({ name, description: typeof value === "object" ? JSON.stringify(value) : String(value) })); }
    if (loadId !== state.resourceLoadId) return;
    list.innerHTML = rows.length ? rows.slice(0, 100).map(resourceRow).join("") : '<div class="empty-state">NO ITEMS FOUND</div>';
  } catch (error) { if (loadId === state.resourceLoadId) list.innerHTML = `<div class="empty-state error">${escapeText(error.message)}</div>`; }
}
function resourceRow(item) {
  const name = item.name || item.id || item.serverName || item.displayName || "Resource";
  if (item.resourceType === "mcp") {
    const tools = Object.values(item.tools || {});
    const toolRows = tools.map((tool) => `<li><b>${escapeText(tool.title || tool.name)}</b>${tool.description ? `<span>${escapeText(tool.description)}</span>` : ""}</li>`).join("");
    return `<div class="resource-row mcp-resource"><span class="resource-icon">▣</span><div><b>${escapeText(name)}</b><small>AUTH: ${escapeText(item.authStatus || "unknown")} | ${tools.length} TOOLS</small><details><summary>Show tool details</summary><ul>${toolRows || "<li>No tools reported</li>"}</ul></details></div></div>`;
  }
  const detail = item.description || item.status || item.path || item.authStatus || "Available";
  return `<div class="resource-row"><span class="resource-icon">▣</span><div><b>${escapeText(name)}</b><small>${escapeText(typeof detail === "string" ? detail : JSON.stringify(detail))}</small></div></div>`;
}

const automationPrompts = {
  list: "Use the automation tools to list my current automations. Show each schedule, project folder, enabled state, model, and next run time. Do not change anything.",
  create: "Help me create a Codex automation for this project. Briefly explain how automations work, then ask only for the task and schedule details you cannot infer. Before creating it, summarize the exact prompt, schedule, project folder, model, and enabled state for confirmation.",
  troubleshoot: "Use the automation tools to inspect my automations and help me fix one that is not running or producing the expected result. Start by listing them and their latest status. Do not delete anything without confirmation.",
};
async function openAutomationManager(kind) {
  $("#automations-dialog").close();
  try {
    await startThread();
    $("#prompt").value = automationPrompts[kind];
    $("#composer").requestSubmit();
  } catch (error) { addMessage("system", "AUTOMATION ERROR", error.message); }
}

function addAttachments(files) {
  [...files].forEach((file) => {
    if (!file.type.startsWith("image/")) return addMessage("system", "ATTACHMENT ERROR", `${file.name} is not an image.`);
    if (file.size > 20 * 1024 * 1024) return addMessage("system", "ATTACHMENT ERROR", `${file.name} is larger than 20 MB.`);
    const reader = new FileReader(); reader.onerror = () => addMessage("system", "ATTACHMENT ERROR", `Could not read ${file.name}.`);
    reader.onload = () => { state.attachments.push({ name: file.name, url: reader.result }); renderAttachments(); };
    reader.readAsDataURL(file);
  });
}
function renderAttachments() {
  const strip = $("#attachment-strip"); strip.hidden = !state.attachments.length;
  strip.innerHTML = state.attachments.map((file, index) => `<span>▧ ${escapeText(file.name)} <button type="button" data-remove-attachment="${index}">×</button></span>`).join("");
}
async function openFile(path, row) {
  $$(".tree [data-file]").forEach((item) => item.classList.toggle("selected", item === row));
  setButtonBusy(row, true); $("#file-viewer-path").textContent = path; $("#file-viewer-content").textContent = "Loading file..."; switchView("file");
  try {
    const response = await request("fs/readFile", { path }); const bytes = Uint8Array.from(atob(response.dataBase64), (char) => char.charCodeAt(0));
    const content = new TextDecoder().decode(bytes); const limit = 250000;
    $("#file-viewer-content").textContent = content.slice(0, limit) + (content.length > limit ? "\n\n[File truncated after 250,000 characters]" : "");
  } catch (error) { $("#file-viewer-content").textContent = `Could not open file.\n\n${errorMessage(error)}`; }
  finally { setButtonBusy(row, false); }
}

function promptText(title, label, value, callback) { state.textAction = callback; $("#text-dialog-title").textContent = title; $("#text-label").firstChild.textContent = label; $("#text-value").value = value; $("#text-dialog").showModal(); $("#text-value").focus(); }
function openPalette(filter = "") { $("#palette-dialog").showModal(); $("#palette-search").value = filter; renderPalette(filter); $("#palette-search").focus(); }
function renderPalette(filter) { const matches = commands.filter(([label]) => label.toLowerCase().includes(filter.toLowerCase())); $("#palette-list").innerHTML = matches.map(([label, name]) => `<button data-action="${name}">${escapeText(label)}</button>`).join(""); }

async function action(name) {
  if (["fork-thread", "archive-thread", "review", "interrupt", "rollback", "compact", "rename-thread"].includes(name)) return runThreadAction(name);
  if (name === "connect") $("#connect-dialog").showModal();
  if (name === "about") $("#about-dialog").showModal();
  if (name === "settings") $("#settings-dialog").showModal();
  if (name === "automations") $("#automations-dialog").showModal();
  if (name === "resources") { $("#resources-dialog").showModal(); loadResources("skills"); }
  if (name === "palette") openPalette();
  if (name === "open-project") promptText("OPEN PROJECT", "Project folder", state.cwd, async (value) => { state.cwd = value; $("#cwd").value = value; state.expandedProjects.add(value); await startThread(); await loadProjectFiles(); });
  if (name === "attach") $("#attachment-input").click();
  if (name === "new-thread") await startThread();
  if (name === "refresh-threads") await loadThreads();
  if (name === "toggle-tree") $("#project-files").toggleAttribute("hidden");
  if (name === "toggle-terminal") $("#terminal").toggleAttribute("hidden");
  if (name === "focus-prompt") $("#prompt").focus();
  if (name.startsWith("view-")) switchView(name.slice(5));
  if (name === "select-all") { $("#prompt").focus(); $("#prompt").select(); }
  if (name === "copy") document.execCommand("copy"); if (name === "cut") document.execCommand("cut"); if (name === "paste") navigator.clipboard?.readText().then((text) => { $("#prompt").value += text; });
}

$$('[data-menu]').forEach((button) => button.addEventListener("click", (event) => { event.stopPropagation(); const popup = $("#menu-popup"); popup.innerHTML = menus[button.dataset.menu].map(([label, name]) => `<button data-action="${name}" role="menuitem">${label}</button>`).join(""); popup.style.left = `${button.offsetLeft}px`; popup.classList.toggle("hidden", button.classList.contains("active")); $$('[data-menu]').forEach((item) => item.classList.toggle("active", item === button && !popup.classList.contains("hidden"))); }));
document.addEventListener("click", (event) => { const button = event.target.closest("[data-action]"); if (button) { action(button.dataset.action); if (button.closest("#palette-dialog")) $("#palette-dialog").close(); } $("#menu-popup").classList.add("hidden"); $$('[data-menu]').forEach((item) => item.classList.remove("active")); });
$("#explorer").addEventListener("click", (event) => {
  const thread = event.target.closest("[data-thread-id]"); if (thread) return resumeThread(thread.dataset.threadId);
  const project = event.target.closest("[data-project-cwd]"); if (project) { const cwd = project.dataset.projectCwd; state.expandedProjects.has(cwd) ? state.expandedProjects.delete(cwd) : state.expandedProjects.add(cwd); renderThreads(); return; }
  const moreProject = event.target.closest("[data-show-project]"); if (moreProject) { const cwd = moreProject.dataset.showProject; state.projectLimits.set(cwd, (state.projectLimits.get(cwd) || 5) + 10); renderThreads(); return; }
  if (event.target.closest("[data-show-chats]")) { state.chatLimit += 10; renderThreads(); }
});
$(".tree").addEventListener("click", (event) => { const file = event.target.closest("[data-file]"); if (file) openFile(file.dataset.file, file); });
$("#attachment-strip").addEventListener("click", (event) => { const button = event.target.closest("[data-remove-attachment]"); if (button) { state.attachments.splice(Number(button.dataset.removeAttachment), 1); renderAttachments(); } });
$("#attachment-input").addEventListener("change", (event) => { addAttachments(event.target.files); event.target.value = ""; });
$$('[data-close]').forEach((button) => button.addEventListener("click", () => $(`#${button.dataset.close}`).close()));
$$('[data-approval]').forEach((button) => button.addEventListener("click", () => resolveApproval(button.dataset.approval)));
tabButtons().forEach((button) => button.addEventListener("click", () => switchView(button.dataset.view)));
$$('[data-resource]').forEach((button) => button.addEventListener("click", () => loadResources(button.dataset.resource)));
$$('[data-automation]').forEach((button) => button.addEventListener("click", () => openAutomationManager(button.dataset.automation)));
$("#connection-form").addEventListener("submit", (event) => { if (event.submitter?.value === "connect") connect(); });
$("#settings-form").addEventListener("submit", () => { $("#sandbox-label").textContent = $("#sandbox").selectedOptions[0].textContent.toUpperCase(); $("#approval-label").textContent = $("#approval-policy").selectedOptions[0].textContent.toUpperCase(); });
$("#text-form").addEventListener("submit", (event) => { if (event.submitter?.value === "confirm" && state.textAction && $("#text-value").value.trim()) state.textAction($("#text-value").value.trim()); state.textAction = null; });
$("#composer").addEventListener("submit", submitPrompt); $("#terminal-form").addEventListener("submit", runShell);
$("#prompt").addEventListener("keydown", (event) => { if (event.key === "Enter" && event.ctrlKey) $("#composer").requestSubmit(); });
$("#thread-search").addEventListener("input", () => { clearTimeout(state.searchTimer); state.searchTimer = setTimeout(() => loadThreads(), 250); });
$("#palette-search").addEventListener("input", (event) => renderPalette(event.target.value));
$("#model").addEventListener("change", () => { $("#status-model").textContent = `MODEL: ${$("#model").selectedOptions[0].textContent.toUpperCase()}`; });
$("#mode").addEventListener("change", () => { $("#composer-mode").textContent = `${$("#mode").selectedOptions[0].textContent.toUpperCase()} MODE`; });
document.addEventListener("keydown", (event) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); openPalette(); } });
state.cwd = decodeURIComponent(location.hash.slice(1)) || "."; $("#cwd").value = state.cwd;
setInterval(() => { $("#clock").textContent = timestamp(); updateSessionTimer(); }, 1000); $("#clock").textContent = timestamp(); updateSessionTimer();
connect();
