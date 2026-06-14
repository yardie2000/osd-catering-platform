@echo off
REM ============================================================
REM  OSD Catering Platform V4.2 - Stop the local server
REM  Frees http://localhost:3000 by stopping whatever is
REM  listening there (next dev OR next start). Run this when you
REM  see: "EADDRINUSE: address already in use :::3000", then
REM  start again with start.bat or dev.bat.
REM ============================================================
setlocal
set "PORT=3000"
set "FOUND="

for /f "tokens=5" %%a in ('netstat -ano ^| findstr LISTENING ^| findstr /c:":%PORT% "') do (
  if not "%%a"=="0" (
    set "FOUND=1"
    echo Stopping process PID %%a on port %PORT% ...
    taskkill /F /PID %%a
  )
)

if not defined FOUND echo No server is listening on port %PORT% - nothing to stop.

echo.
echo Done. You can now run start.bat or dev.bat.
endlocal
pause
