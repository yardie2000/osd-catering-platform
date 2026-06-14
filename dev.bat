@echo off
REM ============================================================
REM  OSD Catering Platform V4.2 - Development launcher
REM  Starts the Next.js dev server (hot reload) on
REM  http://localhost:3000 and opens your browser.
REM  Use this while editing code; use start.bat for a
REM  production-style run.
REM ============================================================
setlocal
cd /d "%~dp0"
title OSD Catering Platform V4.2 (dev)

if not exist "node_modules\" (
  echo Installing dependencies ^(first run^)...
  call npm install || goto :error
)

echo Starting dev server on http://localhost:3000 ...
start "" "http://localhost:3000"
call npm run dev || goto :error

endlocal
goto :eof

:error
echo.
echo *** Launch failed - see the messages above. ***
pause
endlocal
