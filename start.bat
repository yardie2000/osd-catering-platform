@echo off
REM ============================================================
REM  OSD Catering Platform V4.2 - One-click local launcher
REM  Serves the production build on http://localhost:3000 and
REM  opens your browser. On the first run it installs deps and
REM  builds once; later runs start instantly.
REM
REM  To rebuild after code changes: delete the ".next" folder
REM  (or run "npm run build"), then start again. For live
REM  hot-reload while developing, use dev.bat instead.
REM ============================================================
setlocal
cd /d "%~dp0"
title OSD Catering Platform V4.2

if not exist "node_modules\" (
  echo [1/3] Installing dependencies ^(first run, may take a minute^)...
  call npm install || goto :error
)

if not exist ".next\BUILD_ID" (
  echo [2/3] Building production bundle ^(first run^)...
  call npm run build || goto :error
)

echo [3/3] Starting server on http://localhost:3000 ...
start "" "http://localhost:3000"
call npm run start || goto :error

endlocal
goto :eof

:error
echo.
echo *** Launch failed - see the messages above. ***
pause
endlocal
