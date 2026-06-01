#!/usr/bin/env bash
# Build Simulator .app, copy to app-preview, zip for Appetize, run smoke test (Garden Guardians parity).
set -euxo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=ci-env.sh
source "$SCRIPT_DIR/ci-env.sh"

SCRIPTS="$REPO_ROOT/$EXPO_DIR/scripts"
chmod +x "$SCRIPTS/ci-ios-simulator-build.sh" "$SCRIPTS/ci-ios-simulator-smoke-test.sh"

XCODE_WORKSPACE="$XCODE_WORKSPACE_ABS" \
  XCODE_SCHEME="$XCODE_SCHEME" \
  SIMULATOR_DERIVED_DATA="$SIMULATOR_DERIVED_DATA" \
  "$SCRIPTS/ci-ios-simulator-build.sh"

APP_PATH=$(
  find "$SIMULATOR_DERIVED_DATA/Build/Products" "$SIMULATOR_DERIVED_DATA" \
    -type d -name "*.app" -path "*iphonesimulator*" 2>/dev/null \
    | head -1
)
test -d "$APP_PATH"

echo "Simulator app: $APP_PATH"
mkdir -p "$APP_PREVIEW_DIR"
APP_NAME=$(basename "$APP_PATH")
rm -rf "$APP_PREVIEW_DIR/$APP_NAME"
cp -R "$APP_PATH" "$APP_PREVIEW_DIR/"
ls -la "$APP_PREVIEW_DIR"

ZIP_DIR="$(dirname "$APP_PATH")"
(
  cd "$ZIP_DIR"
  rm -f "$APPETIZE_ZIP"
  zip -ry "$APPETIZE_ZIP" "$APP_NAME"
)
ls -la "$APPETIZE_ZIP"
echo "Appetize: upload $APPETIZE_ZIP at https://appetize.io/"

APP_PATH="$APP_PATH" \
  BUNDLE_ID="$BUNDLE_ID" \
  SMOKE_WAIT_SECS="${SMOKE_WAIT_SECS:-45}" \
  "$SCRIPTS/ci-ios-simulator-smoke-test.sh"
