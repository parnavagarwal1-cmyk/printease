@echo off
title PrintEase Dev Runner
echo ========================================
echo         Starting PrintEase Dev
echo ========================================

set PHP="C:\laragon\bin\php\php-8.3.36-Win32-vs16-x64\php.exe"
if not exist %PHP% set PHP=php

echo [1/3] Starting Backend (Laravel) at http://127.0.0.1:8000 ...
start "PrintEase Backend (Laravel)" cmd /k "cd /d %~dp0backend && %PHP% artisan serve --host=127.0.0.1 --port=8000"

timeout /t 2 >nul

echo [2/3] Starting Frontend (React + Vite) at http://localhost:5173 ...
start "PrintEase Frontend (Vite)" cmd /k "cd /d %~dp0frontend && npm run dev"

timeout /t 2 >nul

echo [3/3] Starting Desktop Agent (Electron) ...
start "PrintEase Desktop Agent" cmd /k "cd /d %~dp0desktop && npm start"

echo.
echo All 3 PrintEase services launched in their own CMD windows!
echo Backend API:  http://127.0.0.1:8000
echo Frontend Web: http://localhost:5173
echo Desktop:      Electron Window
