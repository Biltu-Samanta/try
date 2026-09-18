@echo off
set "REPO_ROOT=%~dp0.."
cd /d "%REPO_ROOT%"
echo Starting NorthEastRiskAI Backend API on port 5050...
python backend\app.py
pause
