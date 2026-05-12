#!/usr/bin/env bash
# App Store Connect sometimes validates Payload/*.app/Info.plist and loose PNGs in the
# bundle differently than Xcode's archive step. Patch the exported IPA in-place.
set -euo pipefail

IPA="${1:?usage: patch_ipa_app_store_validation.sh /path/to/Salino.ipa}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ICON_SRC="${ROOT_DIR}/ios/Resources/AppStoreRequiredIcon120.png"

if [[ ! -f "$IPA" ]]; then
  echo "ERROR: IPA not found: $IPA"
  exit 1
fi
if [[ ! -f "$ICON_SRC" ]]; then
  echo "ERROR: Missing $ICON_SRC"
  exit 1
fi

WORKDIR="$(mktemp -d)"
cleanup() { rm -rf "$WORKDIR"; }
trap cleanup EXIT

unzip -q "$IPA" -d "$WORKDIR"
APP="$(find "$WORKDIR/Payload" -maxdepth 1 -name '*.app' | head -1)"
if [[ -z "$APP" ]]; then
  echo "ERROR: No .app under Payload"
  exit 1
fi

PLIST="$APP/Info.plist"
echo "Patching $PLIST"

if /usr/libexec/PlistBuddy -c "Print :CFBundleIconName" "$PLIST" &>/dev/null; then
  /usr/libexec/PlistBuddy -c "Set :CFBundleIconName AppIcon" "$PLIST"
else
  /usr/libexec/PlistBuddy -c "Add :CFBundleIconName string AppIcon" "$PLIST"
fi
/usr/libexec/PlistBuddy -c "Print :CFBundleIconName" "$PLIST"

# Loose PNG at bundle root (some altool checks expect this alongside CFBundleIconName)
cp "$ICON_SRC" "$APP/AppIcon120.png"
ls -la "$APP/AppIcon120.png"

OUT="$(mktemp /tmp/salino-ipa.XXXXXX)"
rm -f "$OUT"
(
  cd "$WORKDIR"
  zip -qr "$OUT" Payload
)
mv "$OUT" "$IPA"
echo "Updated IPA: $IPA"
