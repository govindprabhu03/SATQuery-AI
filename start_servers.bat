@echo off
setlocal
set ROOT=%~dp0

echo Starting SatQuery AI backend (port 8001)...
start "SatQuery Backend" cmd /k "cd /d "%ROOT%backend" && venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8001"

echo Starting SatQuery AI frontend (port 5174)...
start "SatQuery Frontend" cmd /k "cd /d "%ROOT%frontend" && npm run dev"

echo.
echo Both servers are starting in separate windows.
echo Backend:  http://localhost:8001/health
echo Frontend: http://localhost:5174
echo.
echo Waiting a few seconds before opening the app in your browser...
timeout /t 6 /nobreak >nul
start "" "http://localhost:5174"

endlocal
