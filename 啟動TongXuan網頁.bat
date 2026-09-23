@echo off
setlocal
set "ROOT=%~dp0"

where python >nul 2>nul
if errorlevel 1 (
  echo Python was not found in PATH. Backend cannot start.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo Node.js and npm were not found in PATH.
  echo Install Node.js LTS, then run this launcher again.
  pause
  exit /b 1
)

echo Starting TongXuan Backend at http://127.0.0.1:8000
start "TongXuan Backend" /min cmd /k "cd /d ""%ROOT%backend"" && python -m uvicorn app.main:app --host 127.0.0.1 --port 8000"

cd /d "%ROOT%frontend"

if not exist "node_modules" (
  echo Installing frontend dependencies for the first run...
  call npm.cmd install
  if errorlevel 1 (
    echo Dependency installation failed.
    pause
    exit /b 1
  )
)

echo Starting TongXuan Chinese at http://127.0.0.1:5173
echo Backend API: http://127.0.0.1:8000
echo The browser will not be opened automatically.
echo Keep this window and the minimized Backend window open while using the app.
echo Press Ctrl+C to stop the frontend. Close the Backend window to stop the API.
call npm.cmd run dev -- --host 127.0.0.1 --port 5173
if errorlevel 1 (
  echo The web server stopped with an error.
  pause
)
endlocal
