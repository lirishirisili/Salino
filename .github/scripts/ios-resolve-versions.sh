#!/usr/bin/env bash
# Resolve CFBundleVersion (build) and CFBundleShortVersionString (marketing) for CI.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=ci-env.sh
source "$SCRIPT_DIR/ci-env.sh"

ci_install_cli_tools
ci_verify_asc_secrets

FLOOR="${IOS_BUILD_NUMBER_FLOOR:-22}"
OFFSET="${IOS_BUILD_NUMBER_OFFSET:-21}"
RUN_NUM="${GITHUB_RUN_NUMBER:-1}"

latest=0
if [ -n "${APP_STORE_APPLE_ID:-}" ]; then
  echo "Querying TestFlight latest build for App Store Connect app id $APP_STORE_APPLE_ID..."
  latest=$(app-store-connect get-latest-testflight-build-number "$APP_STORE_APPLE_ID" 2>/dev/null || echo "0")
  latest="${latest:-0}"
  echo "Latest TestFlight build number: $latest"
fi

candidate=$((RUN_NUM + OFFSET))
if [ "$latest" -gt 0 ]; then
  candidate=$((latest + 1))
fi

BUILD_NUMBER="$candidate"
if [ "$BUILD_NUMBER" -lt "$FLOOR" ]; then
  BUILD_NUMBER="$FLOOR"
fi

export BUILD_NUMBER
echo "Resolved BUILD_NUMBER=$BUILD_NUMBER (floor=$FLOOR, offset fallback=$((RUN_NUM + OFFSET)), tf_latest=$latest)"

MARKETING="${IOS_MARKETING_VERSION:-}"
if [ -z "$MARKETING" ] && [ -f "$REPO_ROOT/$EXPO_DIR/app.json" ]; then
  MARKETING=$(node -e "const j=require(process.argv[1]); console.log(j.expo.version||'')" "$REPO_ROOT/$EXPO_DIR/app.json")
fi

if [ -z "$MARKETING" ]; then
  echo "ERROR: Could not determine marketing version (set IOS_MARKETING_VERSION or expo.version in app.json)" >&2
  exit 1
fi

# App Store rejects CFBundleShortVersionString <= last approved (currently 1.3.17).
export MARKETING_MIN="${IOS_MARKETING_VERSION_MIN:-1.3.19}"
MARKETING=$(node -e "
function parts(s) {
  return String(s).trim().split('.').map((n) => parseInt(n, 10) || 0);
}
function compare(a, b) {
  const pa = parts(a);
  const pb = parts(b);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const da = pa[i] || 0;
    const db = pb[i] || 0;
    if (da > db) return 1;
    if (da < db) return -1;
  }
  return 0;
}
function maxSemver(a, b) {
  return compare(a, b) >= 0 ? a : b;
}
const requested = process.argv[1];
const min = process.env.MARKETING_MIN || '1.3.19';
const resolved = maxSemver(requested, min);
if (compare(requested, min) < 0) {
  console.error(
    'WARN: expo.version ' +
      requested +
      ' is below App Store minimum ' +
      min +
      '; using ' +
      resolved +
      ' for this upload.'
  );
}
console.log(resolved);
" "$MARKETING")

export IOS_MARKETING_VERSION="$MARKETING"
echo "Resolved IOS_MARKETING_VERSION=$IOS_MARKETING_VERSION (min=$MARKETING_MIN)"
