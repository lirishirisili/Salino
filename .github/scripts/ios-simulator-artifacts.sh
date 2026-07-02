#!/usr/bin/env bash
# Build Simulator .app, copy to app-preview, zip for Appetize, run smoke test (Garden Guardians parity).
set -euxo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=ci-env.sh
source "$SCRIPT_DIR/ci-env.sh"

SCRIPTS="$REPO_ROOT/$EXPO_DIR/scripts"
chmod +x "$SCRIPTS/ci-ios-simulator-build.sh" "$SCRIPTS/ci-ios-simulator-smoke-test.sh" "$SCRIPTS/ci-package-appetize-zip.sh"

XCODE_WORKSPACE="$XCODE_WORKSPACE_ABS" \
  XCODE_SCHEME="$XCODE_SCHEME" \
  SIMULATOR_DERIVED_DATA="$SIMULATOR_DERIVED_DATA" \
  "$SCRIPTS/ci-ios-simulator-build.sh"

# Prefer the main app bundle (avoid picking a dependency .app from find).
APP_PATH="$SIMULATOR_DERIVED_DATA/Build/Products/Release-iphonesimulator/${XCODE_SCHEME}.app"
if [ ! -d "$APP_PATH" ]; then
  APP_PATH="$(
    find "$SIMULATOR_DERIVED_DATA/Build/Products" "$SIMULATOR_DERIVED_DATA" \
      -type d -name "${XCODE_SCHEME}.app" -path "*iphonesimulator*" 2>/dev/null \
      | head -1 || true
  )"
fi
if [ ! -d "$APP_PATH" ]; then
  echo "ERROR: Could not find ${XCODE_SCHEME}.app under $SIMULATOR_DERIVED_DATA" >&2
  find "$SIMULATOR_DERIVED_DATA" -name "*.app" >&2 || true
  exit 1
fi

echo "Simulator app: $APP_PATH"
mkdir -p "$APP_PREVIEW_DIR"
APP_NAME=$(basename "$APP_PATH")
rm -rf "$APP_PREVIEW_DIR/$APP_NAME"
cp -R "$APP_PATH" "$APP_PREVIEW_DIR/"
ls -la "$APP_PREVIEW_DIR"

"$SCRIPTS/ci-package-appetize-zip.sh" "$APP_PATH" "$APPETIZE_ZIP"
echo "Appetize: upload ONLY this file → https://appetize.io/ → $APPETIZE_ZIP"

APP_PATH="$APP_PATH" \
  BUNDLE_ID="$BUNDLE_ID" \
  SMOKE_WAIT_SECS="${SMOKE_WAIT_SECS:-45}" \
  "$SCRIPTS/ci-ios-simulator-smoke-test.sh"
