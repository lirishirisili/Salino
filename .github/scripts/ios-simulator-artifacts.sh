#!/usr/bin/env bash
# Build iOS Simulator zip for Appetize (codemagic.yaml ios-testflight step).
set -euxo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=ci-env.sh
source "$SCRIPT_DIR/ci-env.sh"

xcodebuild build \
  -workspace "$XCODE_WORKSPACE_ABS" \
  -scheme "$XCODE_SCHEME" \
  -configuration Release \
  -sdk iphonesimulator \
  -derivedDataPath "$SIMULATOR_DERIVED_DATA" \
  CODE_SIGNING_ALLOWED=NO \
  ONLY_ACTIVE_ARCH=NO

APP_PATH=$(
  find "$SIMULATOR_DERIVED_DATA" -type d -name "*.app" -path "*iphonesimulator*" \
    | head -1
)
if [ -z "$APP_PATH" ]; then
  echo "ERROR: Could not find Simulator .app bundle" >&2
  find "$SIMULATOR_DERIVED_DATA" -name "*.app" >&2 || true
  exit 1
fi

echo "Packaging for Appetize: $APP_PATH"
APP_NAME=$(basename "$APP_PATH")
cd "$(dirname "$APP_PATH")"
rm -f "$APPETIZE_ZIP"
zip -ry "$APPETIZE_ZIP" "$APP_NAME"
ls -la "$APPETIZE_ZIP"
