$ErrorActionPreference = "Stop"

Write-Host "Stopping any running PrintEase processes..." -ForegroundColor Yellow
Stop-Process -Name "*PrintEase*" -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

$stagingDir = "$PSScriptRoot\..\temp_agent_stage"
$appAsar = "C:\Users\Parnav Agarwal\AppData\Local\Programs\PrintEase Desktop Agent\resources\app.asar"
$appDir = "C:\Users\Parnav Agarwal\AppData\Local\Programs\PrintEase Desktop Agent\resources\app"

if (Test-Path $stagingDir) {
    Remove-Item -Recurse -Force $stagingDir
}

if (Test-Path $appDir) {
    Remove-Item -Recurse -Force $appDir
}

Write-Host "Staging updated desktop source files..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path $stagingDir | Out-Null
Copy-Item -Recurse "$PSScriptRoot\..\desktop\src", "$PSScriptRoot\..\desktop\package.json" -Destination $stagingDir

Write-Host "Compiling and packing fresh app.asar..." -ForegroundColor Yellow
npx --yes @electron/asar pack $stagingDir $appAsar --unpack "**/bin/**"

# Also ensure SumatraPDF is copied directly to app.asar.unpacked and AppData
$unpackedDir = "C:\Users\Parnav Agarwal\AppData\Local\Programs\PrintEase Desktop Agent\resources\app.asar.unpacked\src\bin"
if (-not (Test-Path $unpackedDir)) { New-Item -ItemType Directory -Force -Path $unpackedDir | Out-Null }
Copy-Item "$PSScriptRoot\..\desktop\src\bin\SumatraPDF.exe" -Destination "$unpackedDir\SumatraPDF.exe" -Force

$appDataBin = "$env:APPDATA\printease-desktop\bin"
if (-not (Test-Path $appDataBin)) { New-Item -ItemType Directory -Force -Path $appDataBin | Out-Null }
Copy-Item "$PSScriptRoot\..\desktop\src\bin\SumatraPDF.exe" -Destination "$appDataBin\SumatraPDF.exe" -Force

Remove-Item -Recurse -Force $stagingDir

Write-Host "✓ PrintEase Desktop Agent successfully updated!" -ForegroundColor Green
Get-Item $appAsar | Select-Object Name, Length, LastWriteTime
