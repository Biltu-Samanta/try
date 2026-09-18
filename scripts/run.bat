@echo off
setlocal enabledelayedexpansion

echo =======================================================
echo   Starting NorthEastRiskAI Full-Stack Platform
echo =======================================================
echo.

set "PATH=%PATH%;C:\Program Files\nodejs;C:\Program Files (x86)\nodejs"

set "REPO_ROOT=%~dp0.."
cd /d "%REPO_ROOT%"

echo [1/2] Checking Python backend dependencies...
python -m pip install -r requirements.txt --quiet

echo.
echo Starting Backend API Server (Port 5050)...
start "NorthEastRiskAI - Backend API (Port 5050)" cmd /k "cd /d "%REPO_ROOT%" && python backend\app.py"

echo.
echo [2/2] Launching Frontend Dashboard...
start "NorthEastRiskAI - Frontend UI" cmd /k "set "PATH=%%PATH%%;C:\Program Files\nodejs;C:\Program Files (x86)\nodejs" && cd /d "%REPO_ROOT%\frontend" && if not exist node_modules (echo Installing frontend packages, please wait... && npm install) && echo Starting Vite dev server... && npm run dev"

echo.
echo =======================================================
echo All services launched!
echo - Backend API   : http://localhost:5050/api/health
echo - Frontend App  : Check Frontend window (typically http://localhost:3000)
echo =======================================================
echo.
pause
