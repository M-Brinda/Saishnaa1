@echo off
echo ===================================================
echo Starting Saishnaa Website Debugger...
echo ===================================================
set "PATH=%~dp0node-portable;%PATH%"
echo.
echo Running server on port 8085 (to avoid port 8080 conflicts)...
set PORT=8085
node --preserve-symlinks --preserve-symlinks-main server.js
echo.
echo.
echo Server has stopped or crashed.
pause
