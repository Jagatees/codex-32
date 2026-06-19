import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { extname, isAbsolute, relative, resolve } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const port = Number(process.env.PORT || 4173);
const host = "127.0.0.1";
const url = `http://${host}:${port}`;
const shouldOpen = process.argv.includes("--open") && process.env.CODEX32_NO_OPEN !== "1";
const types = { ".css": "text/css", ".html": "text/html", ".js": "text/javascript", ".png": "image/png", ".svg": "image/svg+xml" };
let codex = null;
let pending = new Map();
const eventStreams = new Set();
const checks = { node: process.version, codex: "checking", authentication: "checking" };

function runCheck(command, args) {
  return new Promise((resolveCheck) => {
    const child = spawn(command, args, { shell: process.platform === "win32", stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    child.stdout.on("data", (chunk) => { output += chunk; });
    child.stderr.on("data", (chunk) => { output += chunk; });
    child.on("error", () => resolveCheck(null));
    child.on("exit", (code) => resolveCheck(code === 0 ? output.trim() : null));
  });
}

async function runStartupChecks() {
  checks.codex = await runCheck(process.env.CODEX_BIN || "codex", ["--version"]) || "not installed";
  checks.authentication = checks.codex === "not installed"
    ? "unavailable"
    : await runCheck(process.env.CODEX_BIN || "codex", ["login", "status"]) || "login required";
  console.log(`Node: ${checks.node}`);
  console.log(`Codex: ${checks.codex}`);
  console.log(`Authentication: ${checks.authentication}`);
  if (checks.codex === "not installed") console.log("Codex CLI was not found. The workbench will remain usable in demo mode.");
  else if (checks.authentication === "login required") console.log("Run 'codex login' to enable the real local agent. Demo mode is still available.");
}

function openBrowser(target) {
  const commands = {
    win32: ["cmd", ["/c", "start", "", target]],
    darwin: ["open", [target]],
    linux: ["xdg-open", [target]],
  };
  const [command, args] = commands[process.platform] || commands.linux;
  const opener = spawn(command, args, { detached: true, stdio: "ignore" });
  opener.on("error", () => console.log(`Could not open a browser automatically. Open ${target}`));
  opener.unref();
}

function broadcast(message) {
  const packet = `data: ${JSON.stringify(message)}\n\n`;
  eventStreams.forEach((stream) => stream.write(packet));
}

function stopCodex() {
  codex?.kill();
  codex = null;
  pending.forEach((response) => {
    if (!response.headersSent && !response.writableEnded) response.writeHead(503).end(JSON.stringify({ error: { message: "Codex app-server restarted" } }));
  });
  pending = new Map();
}

function startCodex() {
  stopCodex();
  const child = spawn(process.env.CODEX_BIN || "codex", ["app-server", "--listen", "stdio://"], {
    shell: process.platform === "win32",
    stdio: ["pipe", "pipe", "pipe"],
  });
  codex = child;
  createInterface({ input: child.stdout }).on("line", (line) => {
    try {
      const message = JSON.parse(line);
      const response = message.id === undefined ? null : pending.get(message.id);
      if (response) {
        pending.delete(message.id);
        if (!response.headersSent && !response.writableEnded) response.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify(message));
      } else broadcast(message);
    } catch { /* tracing belongs on stderr; ignore malformed stdout lines */ }
  });
  createInterface({ input: child.stderr }).on("line", (line) => broadcast({ method: "bridge/log", params: { line } }));
  child.on("error", (error) => {
    if (codex !== child) return;
    codex = null;
    broadcast({ method: "bridge/error", params: { message: error.message } });
  });
  child.on("exit", (code) => {
    if (codex !== child) return;
    codex = null;
    broadcast({ method: "bridge/exit", params: { code } });
  });
}

const server = createServer(async (request, response) => {
  if (request.url === "/health") {
    response.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" }).end(JSON.stringify({ ok: true, host, port, checks }));
    return;
  }
  if (request.url === "/bridge/start" && request.method === "POST") {
    startCodex();
    response.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ ok: true }));
    return;
  }
  if (request.url === "/bridge/events") {
    response.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive" });
    response.write(": CODEX/32 event channel\n\n");
    eventStreams.add(response);
    const removeStream = () => eventStreams.delete(response);
    request.on("close", removeStream);
    response.on("close", removeStream);
    response.on("error", removeStream);
    return;
  }
  if (request.url === "/bridge/rpc" && request.method === "POST") {
    let body = "";
    let tooLarge = false;
    request.on("data", (chunk) => {
      if (tooLarge) return;
      body += chunk;
      if (Buffer.byteLength(body) > 10 * 1024 * 1024) {
        tooLarge = true; body = "";
        response.writeHead(413).end(JSON.stringify({ error: { message: "Request body too large" } }));
      }
    });
    request.on("end", () => {
      if (tooLarge || response.writableEnded) return;
      try {
        const message = JSON.parse(body);
        if (!codex?.stdin.writable) { response.writeHead(503).end(JSON.stringify({ error: { message: "Codex app-server is not running" } })); return; }
        if (message.id === undefined) { codex.stdin.write(`${body}\n`); response.writeHead(202).end("{}"); }
        else {
          pending.set(message.id, response);
          request.on("aborted", () => pending.delete(message.id));
          codex.stdin.write(`${body}\n`);
        }
      } catch { response.writeHead(400).end(JSON.stringify({ error: { message: "Invalid JSON-RPC message" } })); }
    });
    return;
  }
  let pathname;
  try { pathname = decodeURIComponent(request.url === "/" ? "/index.html" : request.url.split("?")[0]); }
  catch { response.writeHead(400).end("Bad request"); return; }
  const file = resolve(root, `.${pathname}`);
  const outsideRoot = relative(root, file);
  if (outsideRoot.startsWith("..") || isAbsolute(outsideRoot)) {
    response.writeHead(403).end("Forbidden");
    return;
  }
  try {
    const contents = await readFile(file);
    response.writeHead(200, { "Content-Type": types[extname(file)] || "application/octet-stream" }).end(contents);
  } catch {
    if (!response.headersSent && !response.writableEnded) response.writeHead(404).end("Not found");
  }
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") console.error(`Cannot start Codex/32: ${url} is already in use. Close the other server or set a different PORT.`);
  else console.error(`Cannot start Codex/32: ${error.message}`);
  process.exitCode = 1;
});

await runStartupChecks();
server.listen(port, host, () => {
  console.log(`CODEX/32 READY: ${url}`);
  console.log("Keep this window open while using Codex/32. Press Ctrl+C to stop.");
  if (shouldOpen) openBrowser(url);
});

function shutdown() {
  stopCodex();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 2000).unref();
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
