@echo off
REM Double-click this file to start the relay.
REM Requires "f1-udp-relay-win-x64.exe" and ".env" in the same folder.

setlocal
cd /d "%~dp0"

if not exist ".env" (
  echo [start-relay] Missing .env file. Copy .env.example to .env and edit it.
  pause
  exit /b 1
)

if not exist "f1-udp-relay-win-x64.exe" (
  echo [start-relay] Missing f1-udp-relay-win-x64.exe in this folder.
  pause
  exit /b 1
)

f1-udp-relay-win-x64.exe
pause
