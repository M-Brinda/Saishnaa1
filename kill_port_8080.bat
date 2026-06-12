@echo off
echo Searching for process using port 8080...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8080 ^| findstr LISTENING') do (
    echo Found process with PID %%a listening on port 8080.
    echo Killing process...
    taskkill /F /PID %%a
)
echo Done. You can now start the server using run.bat.
pause
