@echo off
set "PATH=%PATH%;C:\Program Files\nodejs;C:\Program Files (x86)\nodejs"
set "REPO_ROOT=%~dp0.."
cd /d "%REPO_ROOT%\frontend"
if not exist node_modules (
    echo Installing frontend dependencies...
    npm install
)
echo Starting Vite Dev Server...
npm run dev
pause
