#!/usr/bin/env bash
# Install and launch the built simulator app; verify it stays alive (CI / Appetize sanity check).
set -euo pipefail

: "${APP_PATH:?APP_PATH is required}"

BUNDLE_ID="${BUNDLE_ID:-com.salino.sali}"
SIMULATOR_NAME="${SIMULATOR_NAME:-iPhone 17 Pro}"
APP_BINARY_NAME="${APP_BINARY_NAME:-Haserli}"
LOG_DIR="${LOG_DIR:-/tmp/xcodebuild_logs}"
LOG_FILE="$LOG_DIR/ios-simulator-smoke.log"
WAIT_SECS="${SMOKE_WAIT_SECS:-45}"

mkdir -p "$LOG_DIR"

if [ ! -d "$APP_PATH" ]; then
  echo "ERROR: APP_PATH does not exist: $APP_PATH" >&2
  exit 1
fi

echo "Smoke test app: $APP_PATH"
echo "Smoke test bundle id: $BUNDLE_ID"

pick_device() {
  xcrun simctl list devices available \
    | grep -F "$SIMULATOR_NAME" \
    | grep -E "Booted|Shutdown" \
    | { head -1 || true; } \
    | sed -E 's/.*\(([0-9A-F-]+)\).*/\1/' || true
}

DEVICE_ID="$(pick_device)"
if [ -z "$DEVICE_ID" ]; then
  DEVICE_ID=$(
    xcrun simctl list devices available \
      | grep -E "Booted|Shutdown" \
      | { head -1 || true; } \
      | sed -E 's/.*\(([0-9A-F-]+)\).*/\1/' || true
  )
fi

if [ -z "$DEVICE_ID" ]; then
  echo "ERROR: No available iOS simulator found." >&2
  xcrun simctl list devices >&2 || true
  exit 1
fi

echo "Using simulator: $DEVICE_ID"
xcrun simctl boot "$DEVICE_ID" 2>/dev/null || true
xcrun simctl bootstatus "$DEVICE_ID" -b
xcrun simctl install "$DEVICE_ID" "$APP_PATH"

set +e
xcrun simctl spawn "$DEVICE_ID" log stream \
  --style compact \
  --predicate "process == '$APP_BINARY_NAME' OR eventMessage CONTAINS '$BUNDLE_ID' OR eventMessage CONTAINS 'Terminating app'" \
  > "$LOG_FILE" 2>&1 &
LOG_PID=$!
set -e

cleanup() {
  kill "$LOG_PID" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "Launching $BUNDLE_ID ..."
xcrun simctl launch "$DEVICE_ID" "$BUNDLE_ID" || true

app_is_running() {
  if xcrun simctl spawn "$DEVICE_ID" ps -ax 2>/dev/null | grep -F "$APP_BINARY_NAME" | grep -v grep >/dev/null; then
    return 0
  fi
  if xcrun simctl listapps "$DEVICE_ID" 2>/dev/null | grep -F "$BUNDLE_ID" >/dev/null; then
    return 0
  fi
  if grep -F "running-active" "$LOG_FILE" 2>/dev/null | grep -F "$BUNDLE_ID" >/dev/null; then
    return 0
  fi
  if grep -F "Terminating app" "$LOG_FILE" 2>/dev/null | grep -F "$BUNDLE_ID" >/dev/null; then
    return 1
  fi
  return 1
}

echo "Waiting up to ${WAIT_SECS}s for app to stay alive ..."
elapsed=0
while [ "$elapsed" -lt "$WAIT_SECS" ]; do
  if app_is_running; then
    echo "OK: App stayed alive after simulator launch (${elapsed}s)."
    exit 0
  fi
  sleep 3
  elapsed=$((elapsed + 3))
done

echo "ERROR: App did not appear running within ${WAIT_SECS}s." >&2
tail -n 40 "$LOG_FILE" >&2 || true
exit 1
