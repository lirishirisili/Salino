#!/usr/bin/env bash
# Simulator-only Appetize build (codemagic.yaml ios-simulator-appetize).
set -euxo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=ci-env.sh
source "$SCRIPT_DIR/ci-env.sh"

bash "$SCRIPT_DIR/select-xcode-26.sh"
mkdir -p "$BUILD_DIR" "$APP_PREVIEW_DIR"

echo "=== Install JS dependencies ==="
cd "$REPO_ROOT/$EXPO_DIR"
npm ci

echo "=== Run expo prebuild for iOS ==="
CI=1 npx expo prebuild --platform ios --clean

echo "=== Install CocoaPods ==="
cd "$REPO_ROOT/$EXPO_DIR/ios"
pod install --repo-update

echo "=== Build Simulator zip for Appetize ==="
bash "$SCRIPT_DIR/ios-simulator-artifacts.sh"

echo "=== Simulator Appetize build finished ==="
ls -la "$APPETIZE_ZIP"
