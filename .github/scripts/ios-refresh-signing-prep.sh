#!/usr/bin/env bash
# Refresh App ID, purge stale profiles & orphan distribution certs (codemagic.yaml step).
set -euxo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=ci-env.sh
source "$SCRIPT_DIR/ci-env.sh"

: "${BUNDLE_ID:?BUNDLE_ID is required}"

BUNDLE_ID_RESOURCE=$(
  app-store-connect bundle-ids list \
    --bundle-id-identifier "$BUNDLE_ID" \
    --strict-match-identifier \
    --json \
  | jq -r '.[0].id'
)

if [ -z "$BUNDLE_ID_RESOURCE" ] || [ "$BUNDLE_ID_RESOURCE" = "null" ]; then
  echo "ERROR: could not resolve Bundle ID resource for $BUNDLE_ID" >&2
  exit 1
fi
echo "Resolved Bundle ID resource: $BUNDLE_ID_RESOURCE"

echo "--- Capabilities currently enabled on $BUNDLE_ID BEFORE enable call ---"
app-store-connect bundle-ids capabilities "$BUNDLE_ID_RESOURCE" --json \
  | tee /tmp/caps_before.json
echo "---"

set +e
app-store-connect bundle-ids enable-capabilities \
  "$BUNDLE_ID_RESOURCE" \
  --capability "Sign In with Apple" \
  --log-api-calls --verbose \
  2>&1
ENABLE_EXIT=$?
set -e
echo "enable-capabilities exited with status $ENABLE_EXIT"

echo "--- Capabilities currently enabled on $BUNDLE_ID AFTER enable call ---"
app-store-connect bundle-ids capabilities "$BUNDLE_ID_RESOURCE" --json \
  | tee /tmp/caps_after.json
echo "---"

if ! grep -qE 'APPLE_ID_AUTH|SIGN_IN_WITH_APPLE' /tmp/caps_after.json; then
  echo "ERROR: Sign in with Apple is NOT enabled on $BUNDLE_ID." >&2
  echo "       Manual recovery: enable Sign in with Apple on the App ID in Apple Developer." >&2
  exit 1
fi
echo "OK: Sign in with Apple is enabled on $BUNDLE_ID."

app-store-connect bundle-ids profiles \
  --bundle-ids "$BUNDLE_ID_RESOURCE" \
  --type IOS_APP_STORE \
  --json \
  | jq -r '.[].id' \
  | while read -r PROFILE_ID; do
      [ -z "$PROFILE_ID" ] && continue
      echo "Deleting stale IOS_APP_STORE profile: $PROFILE_ID"
      app-store-connect profiles delete "$PROFILE_ID" --ignore-not-found
    done

for CERT_TYPE in DISTRIBUTION IOS_DISTRIBUTION; do
  app-store-connect certificates list \
    --type "$CERT_TYPE" \
    --json \
    | jq -r '.[].id' \
    | while read -r CERT_ID; do
        [ -z "$CERT_ID" ] && continue
        echo "Revoking orphan $CERT_TYPE certificate: $CERT_ID"
        app-store-connect certificates delete "$CERT_ID" --ignore-not-found
      done
done

echo "Signing prep finished."
