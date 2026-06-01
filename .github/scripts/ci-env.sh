#!/usr/bin/env bash
# Shared CI environment for GitHub Actions (parity with codemagic.yaml ios-testflight).
set -euo pipefail

REPO_ROOT="${GITHUB_WORKSPACE:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
export REPO_ROOT

export EXPO_DIR="${EXPO_DIR:-mobile}"
export XCODE_PROJECT="${XCODE_PROJECT:-$EXPO_DIR/ios/Haserli.xcodeproj}"
export XCODE_WORKSPACE="${XCODE_WORKSPACE:-$EXPO_DIR/ios/Haserli.xcworkspace}"
export XCODE_SCHEME="${XCODE_SCHEME:-Haserli}"
export BUNDLE_ID="${BUNDLE_ID:-com.salino.sali}"
export BUILD_DIR="${BUILD_DIR:-$REPO_ROOT/build}"
export BUILD_NUMBER="${BUILD_NUMBER:-${GITHUB_RUN_NUMBER:-1}}"
export SIMULATOR_DERIVED_DATA="${SIMULATOR_DERIVED_DATA:-$BUILD_DIR/DerivedDataSimulator}"
export APPETIZE_ZIP="${APPETIZE_ZIP:-$BUILD_DIR/Haserli-simulator-appetize.zip}"
export APP_PREVIEW_DIR="${APP_PREVIEW_DIR:-$BUILD_DIR/app-preview}"
export ASC_KEY_FILE="${ASC_KEY_FILE:-/tmp/AuthKey.p8}"

# Codemagic CLI tools (venv — avoids macOS PEP 668 on GitHub runners).
export CI_VENV="${CI_VENV:-$REPO_ROOT/.ci-venv}"
export PATH="$CI_VENV/bin:$PATH"

ci_abs_path() {
  local p="$1"
  if [[ "$p" != /* ]]; then
    echo "$REPO_ROOT/$p"
  else
    echo "$p"
  fi
}

export XCODE_PROJECT_ABS="$(ci_abs_path "$XCODE_PROJECT")"
export XCODE_WORKSPACE_ABS="$(ci_abs_path "$XCODE_WORKSPACE")"

ci_write_asc_key_file() {
  : "${APP_STORE_CONNECT_PRIVATE_KEY:?APP_STORE_CONNECT_PRIVATE_KEY is required}"
  printf '%s\n' "$APP_STORE_CONNECT_PRIVATE_KEY" > "$ASC_KEY_FILE"
}

ci_verify_asc_secrets() {
  for v in APP_STORE_CONNECT_ISSUER_ID APP_STORE_CONNECT_KEY_IDENTIFIER APP_STORE_CONNECT_PRIVATE_KEY; do
    if [ -z "${!v:-}" ]; then
      echo "ERROR: $v is empty." >&2
      exit 1
    fi
  done
  ci_write_asc_key_file
  local key_lines
  key_lines=$(wc -l < "$ASC_KEY_FILE" | tr -d ' ')
  echo "Issuer ID length: ${#APP_STORE_CONNECT_ISSUER_ID}, Key ID: $APP_STORE_CONNECT_KEY_IDENTIFIER, .p8 lines: $key_lines"
  if [ "$key_lines" -lt 4 ]; then
    echo "ERROR: Private key looks like one line (broken paste)." >&2
    exit 1
  fi
  if ! grep -q 'BEGIN PRIVATE KEY' "$ASC_KEY_FILE"; then
    echo "ERROR: Missing -----BEGIN PRIVATE KEY----- in .p8 file." >&2
    exit 1
  fi
}

ci_install_cli_tools() {
  if [ -x "$CI_VENV/bin/app-store-connect" ]; then
    echo "Codemagic CLI tools already installed in $CI_VENV"
    return 0
  fi
  python3 -m venv "$CI_VENV"
  "$CI_VENV/bin/pip" install --upgrade pip
  "$CI_VENV/bin/pip" install codemagic-cli-tools
  command -v app-store-connect >/dev/null
  command -v keychain >/dev/null
  command -v xcode-project >/dev/null
  echo "Codemagic CLI tools installed."
}
