Write-Host "========================================" -ForegroundColor Cyan
Write-Host "         Starting PrintEase Dev         " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$PHP = "C:\laragon\bin\php\php-8.3.36-Win32-vs16-x64\php.exe"
if (-not (Test-Path $PHP)) {
    $PHP = "php"
}

Write-Host "[1/3] Starting Backend (Laravel) at http://127.0.0.1:8000 ..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\..\backend'; & '$PHP' artisan serve --host=127.0.0.1 --port=8000"

Start-Sleep -Seconds 2

Write-Host "[2/3] Starting Frontend (React + Vite) at http://localhost:5173 ..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\..\frontend'; npm run dev"

Start-Sleep -Seconds 2

Write-Host "[3/3] Starting Desktop Agent (Electron) ..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\..\desktop'; npm start"

Write-Host "`nAll 3 PrintEase services launched in their own terminal windows!" -ForegroundColor Yellow
Write-Host "Backend API:  http://127.0.0.1:8000"
Write-Host "Frontend Web: http://localhost:5173"
Write-Host "Desktop Agent: Electron window opened"
