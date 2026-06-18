import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { createInterface } from "node:readline";

const root = new URL(".", import.meta.url).pathname;
const port = Number(process.env.PORT || 4173);
const types = { ".css": "text/css", ".html": "text/html", ".js": "text/javascript", ".svg": "image/svg+xml" };
let codex = null;
let pending = new Map();
const eventStreams = new Set();

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
  const child = spawn(process.env.CODEX_BIN || "codex", ["app-server", "--listen", "stdio://"], { stdio: ["pipe", "pipe", "pipe"] });
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
  child.on("exit", (code) => {
    if (codex !== child) return;
    codex = null;
    broadcast({ method: "bridge/exit", params: { code } });
  });
}

createServer(async (request, response) => {
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
    request.on("data", (chunk) => { body += chunk; });
    request.on("end", () => {
      if (!codex?.stdin.writable) { response.writeHead(503).end(JSON.stringify({ error: { message: "Codex app-server is not running" } })); return; }
      try {
        const message = JSON.parse(body);
        if (message.id === undefined) { codex.stdin.write(`${body}\n`); response.writeHead(202).end("{}"); }
        else { pending.set(message.id, response); codex.stdin.write(`${body}\n`); }
      } catch { response.writeHead(400).end(JSON.stringify({ error: { message: "Invalid JSON-RPC message" } })); }
    });
    return;
  }
  const pathname = request.url === "/" ? "/index.html" : request.url.split("?")[0];
  const file = normalize(join(root, pathname));
  if (!file.startsWith(root)) {
    response.writeHead(403).end("Forbidden");
    return;
  }
  try {
    const contents = await readFile(file);
    response.writeHead(200, { "Content-Type": types[extname(file)] || "application/octet-stream" }).end(contents);
  } catch {
    if (!response.headersSent && !response.writableEnded) response.writeHead(404).end("Not found");
  }
}).listen(port, "127.0.0.1", () => console.log(`CODEX/32 READY: http://127.0.0.1:${port}`));

process.on("SIGINT", () => { stopCodex(); process.exit(0); });
process.on("SIGTERM", () => { stopCodex(); process.exit(0); });
