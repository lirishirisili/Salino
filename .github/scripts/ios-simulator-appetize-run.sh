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
rm -rf ReactNativeDependencies-artifacts hermes-engine-artifacts
echo "ENTERPRISE_REPOSITORY=${ENTERPRISE_REPOSITORY:-<unset>}"
pod install --repo-update

if [ -d ReactNativeDependencies-artifacts ]; then
  for f in ReactNativeDependencies-artifacts/*.tar.gz; do
    [ -f "$f" ] || continue
    if ! gzip -t "$f" 2>/dev/null; then
      echo "ERROR: $f is not a valid gzip (likely a Maven/CDN error page)." >&2
      head -c 200 "$f" >&2 || true
      echo >&2
      exit 1
    fi
    echo "OK: $(basename "$f") is valid gzip ($(wc -c < "$f" | tr -d ' ') bytes)"
  done
fi

echo "=== Build Simulator zip for Appetize ==="
bash "$SCRIPT_DIR/ios-simulator-artifacts.sh"

echo "=== Simulator Appetize build finished ==="
ls -la "$APPETIZE_ZIP"
