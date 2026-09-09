@echo off
echo =======================================================
echo   Starting Manipur Road Risk Analyzer Dashboard
echo =======================================================
echo.

cd /d "%~dp0road-risk-ml"

echo Checking and installing required packages...
python -m pip install flask flask-cors --quiet

echo.
echo Starting Server at http://localhost:5050 ...
echo Press Ctrl+C to stop the server.
echo.

start http://localhost:5050
python frontend\api\app.py
pause
