@echo off
setlocal
cd /d "%~dp0"
title Codex/32 Launcher

echo Checking Codex/32 requirements...
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo ERROR: Node.js is not installed or is not on PATH.
  echo Install Node.js from https://nodejs.org/ and run this launcher again.
  echo.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo WARNING: npm is not on PATH. Starting directly with Node.js.
)

where codex >nul 2>nul
if errorlevel 1 (
  echo WARNING: Codex CLI is not installed. Codex/32 will run in demo mode.
  echo Install Codex CLI later to enable the real agent.
) else (
  codex --version
  codex login status
  if errorlevel 1 echo WARNING: Run "codex login" to enable the real agent.
)

echo.
echo Starting Codex/32...
echo Keep this window open. Press Ctrl+C to stop the server.
echo.
node server.mjs --open

if errorlevel 1 (
  echo.
  echo Codex/32 stopped with an error. Review the message above.
  pause
)
endlocal
