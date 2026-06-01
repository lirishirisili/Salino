#!/usr/bin/env bash
# Resolve CFBundleVersion (build) and optional CFBundleShortVersionString for CI.
# Avoids resetting to 1 when GitHub Actions starts (GITHUB_RUN_NUMBER begins at 1).
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

export IOS_MARKETING_VERSION="$MARKETING"
echo "Resolved IOS_MARKETING_VERSION=$IOS_MARKETING_VERSION"
