#!/usr/bin/env bash
# Build Release iOS Simulator .app with embedded JS (Appetize / Codemagic App Preview).
# Requires: XCODE_WORKSPACE, XCODE_SCHEME, SIMULATOR_DERIVED_DATA (absolute or repo-relative).
set -euo pipefail

: "${XCODE_WORKSPACE:?XCODE_WORKSPACE is required}"
: "${XCODE_SCHEME:?XCODE_SCHEME is required}"
: "${SIMULATOR_DERIVED_DATA:?SIMULATOR_DERIVED_DATA is required}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MOBILE_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$MOBILE_ROOT/.." && pwd)"

if [[ "$XCODE_WORKSPACE" != /* ]]; then
  XCODE_WORKSPACE="$REPO_ROOT/$XCODE_WORKSPACE"
fi
if [[ "$SIMULATOR_DERIVED_DATA" != /* ]]; then
  SIMULATOR_DERIVED_DATA="$REPO_ROOT/$SIMULATOR_DERIVED_DATA"
fi

if [ ! -d "$XCODE_WORKSPACE" ]; then
  FALLBACK="$MOBILE_ROOT/ios/$(basename "$XCODE_WORKSPACE")"
  if [ -d "$FALLBACK" ]; then
    XCODE_WORKSPACE="$FALLBACK"
  else
    echo "ERROR: Workspace not found: $XCODE_WORKSPACE" >&2
    exit 1
  fi
fi

export CI=1
echo "Building Simulator .app (Release, embedded bundle)..."
echo "XCODE_WORKSPACE=$XCODE_WORKSPACE"
# Universal Simulator binary (arm64 + x86_64) — required for Appetize cloud devices.
xcodebuild build \
  -workspace "$XCODE_WORKSPACE" \
  -scheme "$XCODE_SCHEME" \
  -configuration Release \
  -sdk iphonesimulator \
  -derivedDataPath "$SIMULATOR_DERIVED_DATA" \
  CODE_SIGN_IDENTITY="" \
  CODE_SIGNING_REQUIRED=NO \
  CODE_SIGNING_ALLOWED=NO \
  ONLY_ACTIVE_ARCH=NO \
  ARCHS="arm64 x86_64" \
  VALID_ARCHS="arm64 x86_64" \
  EXCLUDED_ARCHS=

APP_PATH="$(
  find "$SIMULATOR_DERIVED_DATA/Build/Products" "$SIMULATOR_DERIVED_DATA" \
    -type d -name "*.app" -path "*iphonesimulator*" 2>/dev/null \
    | head -1 || true
)"
if [ -z "$APP_PATH" ]; then
  echo "ERROR: Could not find Simulator .app bundle" >&2
  find "$SIMULATOR_DERIVED_DATA" -name "*.app" >&2 || true
  exit 1
fi

if ! find "$APP_PATH" \( -name '*.jsbundle' -o -name '*.hbc' \) -print -quit | grep -q .; then
  echo "ERROR: No embedded JS bundle in $APP_PATH (Appetize cannot reach Metro)" >&2
  find "$APP_PATH" -maxdepth 3 -type f >&2 | head -40 || true
  exit 1
fi

echo "Simulator app ready: $APP_PATH"
/usr/libexec/PlistBuddy -c "Print :CFBundleShortVersionString" "$APP_PATH/Info.plist" || true
/usr/libexec/PlistBuddy -c "Print :CFBundleVersion" "$APP_PATH/Info.plist" || true
