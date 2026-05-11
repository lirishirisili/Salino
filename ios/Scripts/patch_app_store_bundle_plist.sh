#!/usr/bin/env bash
# App Store Connect / altool validate the app Info.plist inside the IPA. XcodeGen
# sometimes omits CFBundleIconName in the on-disk Info.plist used for Release archive.
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PLIST="${ROOT_DIR}/ios/Resources/Info.plist"

if [[ ! -f "${PLIST}" ]]; then
  echo "ERROR: Expected Info.plist at ${PLIST} (run xcodegen first)"
  exit 1
fi

if /usr/libexec/PlistBuddy -c "Print :CFBundleIconName" "${PLIST}" &>/dev/null; then
  /usr/libexec/PlistBuddy -c "Set :CFBundleIconName AppIcon" "${PLIST}"
else
  /usr/libexec/PlistBuddy -c "Add :CFBundleIconName string AppIcon" "${PLIST}"
fi

echo "CFBundleIconName in Info.plist:"
/usr/libexec/PlistBuddy -c "Print :CFBundleIconName" "${PLIST}"
