# Signed release AAB for Google Play (Haserli / com.salino.sali).
# Output: mobile/android/app/release/app-release.aab
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$androidSdk = "$env:LOCALAPPDATA\Android\Sdk"
if (-not $env:ANDROID_HOME -and (Test-Path $androidSdk)) {
  $env:ANDROID_HOME = $androidSdk
  $env:ANDROID_SDK_ROOT = $androidSdk
}

$studioJbr = "C:\Program Files\Android\Android Studio\jbr"
if (-not $env:JAVA_HOME -and (Test-Path $studioJbr)) {
  $env:JAVA_HOME = $studioJbr
}

$localProps = Join-Path $root "android\local.properties"
if ((Test-Path (Join-Path $root "android")) -and -not (Test-Path $localProps) -and $env:ANDROID_HOME) {
  $escapedSdk = $env:ANDROID_HOME.Replace('\', '\\')
  "sdk.dir=$escapedSdk" | Set-Content -Path $localProps -Encoding ASCII
}

Write-Host "Syncing native Android project (expo prebuild)..." -ForegroundColor Cyan
npx expo prebuild --platform android --no-install

$keystoreSrc = Join-Path $PSScriptRoot "android\keystore.properties"
$keystoreDst = Join-Path $root "android\keystore.properties"
if (-not (Test-Path $keystoreSrc)) {
  Write-Host "ERROR: Missing scripts/android/keystore.properties" -ForegroundColor Red
  exit 1
}
Copy-Item $keystoreSrc $keystoreDst -Force
Write-Host "Applied Play Store signing config from scripts/android/keystore.properties" -ForegroundColor Cyan

$appGradle = Join-Path $root "android\app\build.gradle"
$gradleText = Get-Content $appGradle -Raw
if ($gradleText -notmatch 'keystorePropertiesFile') {
  $gradleText = $gradleText -replace '(def jscFlavor = [^\r\n]+)', @'
$1

def keystorePropertiesFile = rootProject.file("keystore.properties")
def keystoreProperties = new Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}
'@
  $gradleText = $gradleText -replace '(?s)(signingConfigs \{.*?debug \{.*?\}\s*)(\})', @'
$1
        release {
            if (keystorePropertiesFile.exists()) {
                keyAlias keystoreProperties['keyAlias']
                keyPassword keystoreProperties['keyPassword']
                storeFile file(keystoreProperties['storeFile'])
                storePassword keystoreProperties['storePassword']
            }
        }
$2
'@
  $gradleText = $gradleText -replace "signingConfig signingConfigs.debug\r?\n(\s*def enableShrinkResources)", "signingConfig signingConfigs.release`r`n`$1"
  Set-Content -Path $appGradle -Value $gradleText -NoNewline
  Write-Host "Restored release signingConfigs in android/app/build.gradle" -ForegroundColor Cyan
} elseif ($gradleText -match 'release \{[\s\S]*?signingConfig signingConfigs\.debug') {
  $gradleText = $gradleText -replace '(release \{[\s\S]*?)signingConfig signingConfigs\.debug', '$1signingConfig signingConfigs.release'
  Set-Content -Path $appGradle -Value $gradleText -NoNewline
  Write-Host "Switched release signingConfig to upload keystore" -ForegroundColor Cyan
}

$env:NODE_ENV = "production"
$env:NODE_OPTIONS = "--max-old-space-size=8192"
Write-Host "Building RELEASE AAB..." -ForegroundColor Cyan
Set-Location android

& .\gradlew.bat --stop 2>$null
& .\gradlew.bat bundleRelease `
  -x lintVitalAnalyzeRelease -x lintVitalReportRelease -x lintVitalRelease `
  "-PreactNativeArchitectures=arm64-v8a,x86_64"

$aab = "app\build\outputs\bundle\release\app-release.aab"
if (Test-Path $aab) {
  $destDir = Join-Path $root "android\app\release"
  New-Item -ItemType Directory -Force -Path $destDir | Out-Null
  $version = (Get-Content (Join-Path $root "app.json") -Raw | ConvertFrom-Json).expo.version
  $dest = Join-Path $destDir "Haserli-$version-rn-release.aab"
  Copy-Item $aab $dest -Force
  Copy-Item $aab (Join-Path $destDir "app-release.aab") -Force
  $repoRelease = Join-Path (Split-Path -Parent $root) "app\release"
  New-Item -ItemType Directory -Force -Path $repoRelease | Out-Null
  Copy-Item $dest (Join-Path $repoRelease "Haserli-$version-rn-release.aab") -Force
  $item = Get-Item $dest
  $sizeMb = [math]::Round($item.Length / 1MB, 1)
  Write-Host ""
  Write-Host "Release AAB ready ($sizeMb MB): $($item.FullName)" -ForegroundColor Green
} else {
  Write-Host "Build finished but AAB not found at $aab" -ForegroundColor Red
  exit 1
}
