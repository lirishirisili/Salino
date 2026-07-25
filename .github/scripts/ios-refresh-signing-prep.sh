#!/usr/bin/env bash
# Refresh App ID, purge stale profiles & orphan distribution certs.
# Must enable Push Notifications BEFORE creating a new App Store profile —
# otherwise archive fails with missing aps-environment.
set -euxo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=ci-env.sh
source "$SCRIPT_DIR/ci-env.sh"

: "${BUNDLE_ID:?BUNDLE_ID is required}"

ci_write_asc_key_file

BUNDLE_ID_RESOURCE=$(
  app-store-connect bundle-ids list \
    --issuer-id "$APP_STORE_CONNECT_ISSUER_ID" \
    --key-id "$APP_STORE_CONNECT_KEY_IDENTIFIER" \
    --private-key @file:"$ASC_KEY_FILE" \
    --bundle-id-identifier "$BUNDLE_ID" \
    --strict-match-identifier \
    --json \
  | jq -r '.[0].id // empty'
) || true

if [ -z "$BUNDLE_ID_RESOURCE" ]; then
  echo "Skip purge: Bundle ID resource not resolved (fetch-signing-files will create it)."
  exit 0
fi

echo "Resolved Bundle ID resource: $BUNDLE_ID_RESOURCE"

echo "--- Capabilities currently enabled on $BUNDLE_ID BEFORE ---"
app-store-connect bundle-ids capabilities "$BUNDLE_ID_RESOURCE" --json \
  | tee /tmp/caps_before.json
echo "---"

# Enable one capability at a time. Combining them can abort early (e.g. Sign In
# with Apple 409) and skip Push entirely — which caused the previous CI failure.
enable_one_capability() {
  local cap="$1"
  local out code
  set +e
  out=$(
    app-store-connect bundle-ids enable-capabilities \
      "$BUNDLE_ID_RESOURCE" \
      --capability "$cap" \
      --log-api-calls --verbose \
      2>&1
  )
  code=$?
  set -e
  echo "$out"
  if [ "$code" -eq 0 ]; then
    echo "OK: enable-capabilities succeeded for: $cap"
    return 0
  fi
  # Already enabled / already configured is fine.
  if echo "$out" | grep -qiE 'already|exists|ENTITY_ERROR|409|at least one configuration'; then
    echo "OK: capability already present / configured: $cap (cli exit $code)"
    return 0
  fi
  echo "ERROR: failed to enable capability: $cap (exit $code)" >&2
  return "$code"
}

echo "=== Enable Push Notifications (required for expo-notifications / FCM) ==="
enable_one_capability "Push Notifications"

echo "=== Enable Sign In with Apple ==="
enable_one_capability "Sign In with Apple"

echo "--- Capabilities currently enabled on $BUNDLE_ID AFTER ---"
app-store-connect bundle-ids capabilities "$BUNDLE_ID_RESOURCE" --json \
  | tee /tmp/caps_after.json
echo "---"

if ! grep -qE 'APPLE_ID_AUTH|SIGN_IN_WITH_APPLE' /tmp/caps_after.json; then
  echo "ERROR: Sign in with Apple is NOT enabled on $BUNDLE_ID." >&2
  exit 1
fi
echo "OK: Sign in with Apple is enabled on $BUNDLE_ID."

if ! grep -qE '"capabilityType"[[:space:]]*:[[:space:]]*"PUSH_NOTIFICATIONS"' /tmp/caps_after.json; then
  echo "ERROR: Push Notifications is NOT enabled on $BUNDLE_ID." >&2
  echo "       Manual fix (required once):" >&2
  echo "       1) https://developer.apple.com/account/resources/identifiers/list" >&2
  echo "       2) Open App ID com.salino.sali" >&2
  echo "       3) Enable Push Notifications → Save" >&2
  echo "       4) Re-run this workflow" >&2
  exit 1
fi
echo "OK: Push Notifications is enabled on $BUNDLE_ID."

# Profiles created before Push was enabled lack aps-environment — delete them all
# so fetch-signing-files creates a fresh App Store profile with Push.
set +o pipefail
app-store-connect bundle-ids profiles \
  --bundle-ids "$BUNDLE_ID_RESOURCE" \
  --type IOS_APP_STORE \
  --json 2>/dev/null \
  | jq -r '.[]?.id // empty' 2>/dev/null \
  | while read -r PROFILE_ID; do
      [ -z "$PROFILE_ID" ] && continue
      echo "Deleting stale IOS_APP_STORE profile: $PROFILE_ID"
      app-store-connect profiles delete "$PROFILE_ID" --ignore-not-found || true
    done

for CERT_TYPE in DISTRIBUTION IOS_DISTRIBUTION; do
  app-store-connect certificates list \
    --type "$CERT_TYPE" \
    --json 2>/dev/null \
    | jq -r '.[]?.id // empty' 2>/dev/null \
    | while read -r CERT_ID; do
        [ -z "$CERT_ID" ] && continue
        echo "Revoking orphan $CERT_TYPE certificate: $CERT_ID"
        app-store-connect certificates delete "$CERT_ID" --ignore-not-found || true
      done
done
set -o pipefail

# Brief settle time so Apple's profile service sees the updated App ID capabilities.
sleep 5

echo "Signing prep finished."
