<# 
  build-native-debug.ps1
  Builds the Android Native (Jetpack Compose) app as a debug APK.
  Output: app/build/outputs/apk/debug/app-debug.apk
#>

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Salino - Native Android Debug Build  " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Navigate to project root (where the native app's gradlew lives)
$projectRoot = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path "$projectRoot\gradlew.bat")) {
    $projectRoot = $PSScriptRoot
}
Push-Location $projectRoot

try {
    Write-Host "[1/3] Cleaning previous build..." -ForegroundColor Yellow
    & .\gradlew.bat clean 2>&1 | Out-Null

    Write-Host "[2/3] Building debug APK..." -ForegroundColor Yellow
    & .\gradlew.bat :app:assembleDebug --stacktrace

    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "BUILD FAILED" -ForegroundColor Red
        exit 1
    }

    $apkPath = "app\build\outputs\apk\debug\app-debug.apk"
    if (Test-Path $apkPath) {
        $fullPath = (Resolve-Path $apkPath).Path
        $size = [math]::Round((Get-Item $apkPath).Length / 1MB, 2)
        Write-Host ""
        Write-Host "[3/3] BUILD SUCCESS" -ForegroundColor Green
        Write-Host "  APK: $fullPath" -ForegroundColor White
        Write-Host "  Size: ${size} MB" -ForegroundColor White
        Write-Host ""
    } else {
        Write-Host ""
        Write-Host "BUILD FAILED - APK not found" -ForegroundColor Red
        exit 1
    }
} finally {
    Pop-Location
}
