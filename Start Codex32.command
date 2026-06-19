#!/bin/sh
cd "$(dirname "$0")" || exit 1

echo "Checking Codex/32 requirements..."
if ! command -v node >/dev/null 2>&1; then
  echo ""
  echo "ERROR: Node.js is not installed or is not on PATH."
  echo "Install Node.js from https://nodejs.org/ and run this launcher again."
  printf "Press Return to close..."
  read answer
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "WARNING: npm is not on PATH. Starting directly with Node.js."
fi

if ! command -v codex >/dev/null 2>&1; then
  echo "WARNING: Codex CLI is not installed. Codex/32 will run in demo mode."
  echo "Install Codex CLI later to enable the real agent."
else
  codex --version
  codex login status || echo "WARNING: Run 'codex login' to enable the real agent."
fi

echo ""
echo "Starting Codex/32..."
echo "Keep this window open. Press Control+C to stop the server."
echo ""
node server.mjs --open
status=$?

if [ "$status" -ne 0 ]; then
  echo ""
  echo "Codex/32 stopped with an error. Review the message above."
  printf "Press Return to close..."
  read answer
fi
exit "$status"
