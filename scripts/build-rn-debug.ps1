<# 
  build-rn-debug.ps1
  Builds the React Native (Expo) Android app as a debug APK.
  Output: mobile/android/app/build/outputs/apk/debug/app-debug.apk
#>

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Salino - React Native Debug Build    " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Navigate to the mobile project root
$projectRoot = Split-Path -Parent $PSScriptRoot
$mobileRoot = Join-Path $projectRoot "mobile"

if (-not (Test-Path $mobileRoot)) {
    $mobileRoot = Join-Path $PSScriptRoot "mobile"
}

if (-not (Test-Path "$mobileRoot\android\gradlew.bat")) {
    Write-Host "ERROR: Cannot find mobile/android/gradlew.bat" -ForegroundColor Red
    Write-Host "Make sure you run this from the Salino project root or scripts/ folder." -ForegroundColor Red
    exit 1
}

Push-Location $mobileRoot

try {
    # Step 1: Install JS dependencies if needed
    if (-not (Test-Path "node_modules")) {
        Write-Host "[1/4] Installing dependencies..." -ForegroundColor Yellow
        npm install
    } else {
        Write-Host "[1/4] Dependencies OK (node_modules exists)" -ForegroundColor Yellow
    }

    # Step 2: Generate native project files if needed (expo prebuild)
    if (-not (Test-Path "android\gradlew.bat")) {
        Write-Host "[2/4] Running expo prebuild (android folder missing)..." -ForegroundColor Yellow
        npx expo prebuild --platform android --no-install
    } else {
        Write-Host "[2/4] Native project exists (skipping prebuild)" -ForegroundColor Yellow
    }

    # Step 3: Build the debug APK
    Write-Host "[3/4] Building debug APK..." -ForegroundColor Yellow
    Push-Location android
    $env:NODE_ENV = "development"
    $ErrorActionPreference = "Continue"
    & .\gradlew.bat assembleDebug --stacktrace
    $ErrorActionPreference = "Stop"

    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "BUILD FAILED" -ForegroundColor Red
        Pop-Location
        exit 1
    }
    Pop-Location

    # Step 4: Report result
    $apkPath = "android\app\build\outputs\apk\debug\app-debug.apk"
    if (Test-Path $apkPath) {
        $fullPath = (Resolve-Path $apkPath).Path
        $size = [math]::Round((Get-Item $apkPath).Length / 1MB, 2)
        Write-Host ""
        Write-Host "[4/4] BUILD SUCCESS" -ForegroundColor Green
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
