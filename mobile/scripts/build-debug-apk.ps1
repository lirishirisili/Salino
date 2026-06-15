# Build a standalone debug APK (JS bundle embedded, no Metro required).
# Run from PowerShell *outside* Cursor sandbox if you hit "Filename longer than 260 characters".
$ErrorActionPreference = "Stop"
$MobileRoot = Split-Path $PSScriptRoot -Parent
$AndroidDir = Join-Path $MobileRoot "android"
$GradleHome = "C:\g"
if (-not (Test-Path $GradleHome)) { New-Item -ItemType Directory -Path $GradleHome -Force | Out-Null }
$env:GRADLE_USER_HOME = $GradleHome
Set-Location $AndroidDir
Write-Host "GRADLE_USER_HOME=$GradleHome"
Write-Host "Building debug APK..."
& .\gradlew.bat --stop 2>$null
Get-ChildItem -Path (Join-Path $MobileRoot "node_modules") -Recurse -Directory -Filter ".cxx" -ErrorAction SilentlyContinue |
    Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
& .\gradlew.bat assembleDebug --no-daemon -g $GradleHome
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
$apk = Get-ChildItem -Path "app\build\outputs\apk\debug\*.apk" -ErrorAction SilentlyContinue | Select-Object -First 1
if ($apk) {
    Write-Host ""
    Write-Host "APK ready:" -ForegroundColor Green
    Write-Host $apk.FullName
} else {
    Write-Host "Build finished but APK not found under app\build\outputs\apk\debug\" -ForegroundColor Yellow
}
