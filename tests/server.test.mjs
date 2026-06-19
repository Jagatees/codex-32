import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer, request } from "node:http";
import { once } from "node:events";
import test from "node:test";

function getFreePort() {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const { port } = probe.address();
      probe.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

function httpRequest(port, path, { body, method = "GET" } = {}) {
  return new Promise((resolve, reject) => {
    const req = request({ host: "127.0.0.1", port, path, method }, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => resolve({ body: Buffer.concat(chunks).toString(), status: response.statusCode }));
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

async function waitForReady(child, port) {
  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk; });
  child.stderr.on("data", (chunk) => { output += chunk; });
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (output.includes("CODEX/32 READY")) return;
    if (child.exitCode != null) throw new Error(`Server exited early:\n${output}`);
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Server did not become ready on port ${port}:\n${output}`);
}

test("local server security and lifecycle", { timeout: 30_000 }, async () => {
  const port = await getFreePort();
  const child = spawn(process.execPath, ["server.mjs"], {
    cwd: new URL("..", import.meta.url),
    env: { ...process.env, CODEX32_NO_OPEN: "1", CODEX_BIN: "codex32-test-command-not-found", PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"],
  });

  try {
    await waitForReady(child, port);

    const health = await httpRequest(port, "/health");
    assert.equal(health.status, 200);
    assert.equal(JSON.parse(health.body).ok, true);

    assert.equal((await httpRequest(port, "/")).status, 200);
    assert.equal((await httpRequest(port, "/missing-page")).status, 404);
    assert.equal((await httpRequest(port, "/../package.json")).status, 403);
    assert.equal((await httpRequest(port, "/%2e%2e/package.json")).status, 403);
    assert.equal((await httpRequest(port, "/%ZZ")).status, 400);

    const invalidRpc = await httpRequest(port, "/bridge/rpc", { body: "not json", method: "POST" });
    assert.equal(invalidRpc.status, 400);

    const unavailableRpc = await httpRequest(port, "/bridge/rpc", { body: JSON.stringify({ id: 1, method: "model/list", params: {} }), method: "POST" });
    assert.equal(unavailableRpc.status, 503);

    const oversizedRpc = await httpRequest(port, "/bridge/rpc", { body: "x".repeat(10 * 1024 * 1024 + 1), method: "POST" });
    assert.equal(oversizedRpc.status, 413);
  } finally {
    child.kill("SIGTERM");
    if (child.exitCode == null) await once(child, "exit");
  }

  await assert.rejects(httpRequest(port, "/health"));
});
