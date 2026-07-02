#!/usr/bin/env bash
# Zip a Simulator .app for Appetize.io — .app must be at the root of the archive.
# Usage: ci-package-appetize-zip.sh <path-to-.app> <output.zip>
set -euo pipefail

APP_PATH="${1:?path to .app required}"
APPETIZE_ZIP="${2:?output .zip path required}"

if [ ! -d "$APP_PATH" ]; then
  echo "ERROR: Not a directory: $APP_PATH" >&2
  exit 1
fi

APP_NAME=$(basename "$APP_PATH")
if [[ "$APP_NAME" != *.app ]]; then
  echo "ERROR: Expected a .app bundle, got: $APP_NAME" >&2
  exit 1
fi

STAGING=$(mktemp -d)
trap 'rm -rf "$STAGING"' EXIT

echo "Staging $APP_NAME for Appetize zip..."
ditto "$APP_PATH" "$STAGING/$APP_NAME"

mkdir -p "$(dirname "$APPETIZE_ZIP")"
rm -f "$APPETIZE_ZIP"
APPETIZE_ZIP_ABS="$(cd "$(dirname "$APPETIZE_ZIP")" && pwd)/$(basename "$APPETIZE_ZIP")"

echo "Creating $APPETIZE_ZIP_ABS ..."
(
  cd "$STAGING"
  zip -ry "$APPETIZE_ZIP_ABS" "$APP_NAME"
)

echo "Zip contents (must show ${APP_NAME}/ at root):"
# head closes the pipe early; ignore SIGPIPE (exit 141) under pipefail
unzip -Z1 "$APPETIZE_ZIP_ABS" | head -25 || true

zip_entries="$(unzip -Z1 "$APPETIZE_ZIP_ABS")"
if [ -z "$zip_entries" ]; then
  echo "ERROR: Empty zip archive" >&2
  exit 1
fi

if ! printf '%s\n' "$zip_entries" | grep -q "^${APP_NAME}/"; then
  echo "ERROR: ${APP_NAME}/ not found at zip root (Appetize: No .app folder found)" >&2
  printf '%s\n' "$zip_entries" | head -10 >&2 || true
  exit 1
fi

while IFS= read -r entry; do
  [ -z "$entry" ] && continue
  case "$entry" in
    "${APP_NAME}"|"${APP_NAME}"/*) ;;
    *)
      echo "ERROR: Unexpected zip entry outside ${APP_NAME}/: $entry" >&2
      exit 1
      ;;
  esac
done <<< "$zip_entries"

if printf '%s\n' "$zip_entries" | grep -qE '^Payload/'; then
  echo "ERROR: Zip looks like an IPA (Payload/...) — use the Simulator zip artifact, not the .ipa" >&2
  exit 1
fi

MAIN_BIN="${APP_NAME%.app}"
if [ -f "$APP_PATH/$MAIN_BIN" ]; then
  echo "Binary architectures:"
  file "$APP_PATH/$MAIN_BIN" || true
fi

ls -la "$APPETIZE_ZIP_ABS"
echo "OK: Appetize zip ready — upload this file only (not the whole GitHub Actions artifacts bundle)."
