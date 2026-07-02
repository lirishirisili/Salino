#!/usr/bin/env bash
# Full iOS TestFlight pipeline — step order matches codemagic.yaml ios-testflight.
set -euxo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=ci-env.sh
source "$SCRIPT_DIR/ci-env.sh"

bash "$SCRIPT_DIR/select-xcode-26.sh"
ci_install_cli_tools
ci_verify_asc_secrets
export APP_STORE_CONNECT_ISSUER_ID APP_STORE_CONNECT_KEY_IDENTIFIER APP_STORE_CONNECT_PRIVATE_KEY

mkdir -p "$BUILD_DIR" "$APP_PREVIEW_DIR"

echo "=== Install JS dependencies ==="
cd "$REPO_ROOT/$EXPO_DIR"
npm ci

echo "=== Run expo prebuild for iOS ==="
CI=1 npx expo prebuild --platform ios --clean

echo "=== Install CocoaPods ==="
cd "$REPO_ROOT/$EXPO_DIR/ios"
pod install --repo-update

echo "=== Resolve iOS build & marketing version ==="
# shellcheck source=ios-resolve-versions.sh
source "$SCRIPT_DIR/ios-resolve-versions.sh"

echo "=== Set CFBundleShortVersionString ($IOS_MARKETING_VERSION) and CFBundleVersion ($BUILD_NUMBER) ==="
cd "$REPO_ROOT/$EXPO_DIR/ios"
agvtool new-marketing-version "$IOS_MARKETING_VERSION"
agvtool new-version -all "$BUILD_NUMBER"

echo "=== Refresh App ID, purge stale profiles & orphan distribution certs ==="
bash "$SCRIPT_DIR/ios-refresh-signing-prep.sh"

echo "=== Fetch & install code signing files ==="
keychain initialize
openssl genrsa -out /tmp/certificate_key.pem 2048
ls -la /tmp/certificate_key.pem
app-store-connect fetch-signing-files "$BUNDLE_ID" \
  --type IOS_APP_STORE \
  --create \
  --certificate-key @file:/tmp/certificate_key.pem \
  --verbose
keychain add-certificates
xcode-project use-profiles \
  --project "$XCODE_PROJECT_ABS" \
  --export-options-plist "$HOME/export_options.plist" \
  --verbose

if [ ! -f "$HOME/export_options.plist" ]; then
  echo "ERROR: export_options.plist missing after xcode-project use-profiles" >&2
  exit 1
fi

echo "=== Archive ==="
xcodebuild archive \
  -workspace "$XCODE_WORKSPACE_ABS" \
  -scheme "$XCODE_SCHEME" \
  -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath "$BUILD_DIR/build.xcarchive" \
  CODE_SIGN_STYLE=Manual

echo "=== Export IPA ==="
mkdir -p "$BUILD_DIR/ios/ipa"
xcodebuild -exportArchive \
  -archivePath "$BUILD_DIR/build.xcarchive" \
  -exportPath "$BUILD_DIR/ios/ipa" \
  -exportOptionsPlist "$HOME/export_options.plist"

echo "=== Build iOS Simulator zip for Appetize ==="
bash "$SCRIPT_DIR/ios-simulator-artifacts.sh"

echo "=== iOS TestFlight pipeline finished ==="
ls -la "$BUILD_DIR/ios/ipa"/*.ipa
ls -la "$APPETIZE_ZIP"
