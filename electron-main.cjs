const { app, BrowserWindow, dialog } = require("electron");
const { spawn } = require("node:child_process");
const http = require("node:http");
const path = require("node:path");

const host = "127.0.0.1";
const port = Number(process.env.PORT || 4173);
const url = `http://${host}:${port}`;
let mainWindow;
let serverProcess;
let ownsServer = false;

function healthCheck() {
  return new Promise((resolve) => {
    const request = http.get(`${url}/health`, { timeout: 750 }, (response) => {
      response.resume();
      resolve(response.statusCode === 200);
    });
    request.on("timeout", () => { request.destroy(); resolve(false); });
    request.on("error", () => resolve(false));
  });
}

async function waitForServer(timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await healthCheck()) return true;
    if (serverProcess?.exitCode != null) return false;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  return false;
}

async function ensureServer() {
  if (await healthCheck()) return;
  const serverRoot = app.isPackaged ? path.join(process.resourcesPath, "app.asar.unpacked") : __dirname;
  const serverPath = path.join(serverRoot, "server.mjs");
  serverProcess = spawn(process.execPath, [serverPath], {
    cwd: serverRoot,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", CODEX32_NO_OPEN: "1", PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  ownsServer = true;
  serverProcess.stdout.on("data", (chunk) => console.log(String(chunk).trimEnd()));
  serverProcess.stderr.on("data", (chunk) => console.error(String(chunk).trimEnd()));
  if (!await waitForServer()) throw new Error(`The local server could not start at ${url}. The port may already be used by another application.`);
}

async function createWindow() {
  await ensureServer();
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 650,
    minHeight: 560,
    backgroundColor: "#008080",
    title: "Codex/32 Workbench",
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  await mainWindow.loadURL(url);
}

function stopOwnedServer() {
  if (!ownsServer || !serverProcess || serverProcess.exitCode != null) return;
  serverProcess.kill("SIGTERM");
  serverProcess = null;
  ownsServer = false;
}

app.whenReady().then(createWindow).catch((error) => {
  dialog.showErrorBox("Codex/32 could not start", `${error.message}\n\nRun npm start for detailed setup information.`);
  app.quit();
});

app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
app.on("before-quit", stopOwnedServer);
