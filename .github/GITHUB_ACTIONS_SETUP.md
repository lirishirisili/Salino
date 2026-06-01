# GitHub Actions CI/CD — Salino / Haserli (iOS)

GitHub Actions mirrors **`codemagic.yaml` → `ios-testflight`** step-for-step (Expo prebuild, Sign in with Apple prep, signing, archive, IPA, Appetize zip, TestFlight).

## Workflows

| File | Trigger | Output |
|------|---------|--------|
| `ios-testflight.yml` | push to `main`, `master`, `release/**` | IPA → TestFlight + `Haserli-simulator-appetize.zip` |
| `ios-simulator-appetize.yml` | manual only | Appetize zip only (no signing) |

## Pipeline (same order as Codemagic)

Single script: `.github/scripts/ios-testflight-run.sh`

1. `npm ci` (in `mobile/`)
2. `expo prebuild --platform ios --clean`
3. `pod install --repo-update`
4. Resolve build number (TestFlight latest + 1, minimum **22**) + marketing version from `app.json`
5. `agvtool` for `CFBundleShortVersionString` + `CFBundleVersion`
6. Refresh App ID (Sign in with Apple) + purge profiles/certs
7. `fetch-signing-files` + keychain + `xcode-project use-profiles`
8. `xcodebuild archive` + export IPA
9. Simulator build + Appetize zip
10. `ios-publish-testflight.sh` → TestFlight

Shared env: `.github/scripts/ci-env.sh`  
CLI tools: `codemagic-cli-tools` in `.ci-venv` (macOS PEP 668 safe).

## Secrets (required before the first run)

Secrets are **not** stored in git. Add them in the GitHub UI (same values as Codemagic group `app-store-connect`):

**[Repository → Settings → Secrets and variables → Actions → New repository secret](https://github.com/lironsh11/Salino/settings/secrets/actions)**

After saving all three, re-run: **Actions → iOS — Expo TestFlight → Run workflow**, or push any commit to `main`.

Add these **Repository secrets**:

| Secret | Description |
|--------|-------------|
| `APP_STORE_CONNECT_ISSUER_ID` | Issuer ID from App Store Connect → Users and Access → Integrations → API |
| `APP_STORE_CONNECT_KEY_IDENTIFIER` | Key ID (10 chars, e.g. from `AuthKey_XXXXXXXXXX.p8` filename) |
| `APP_STORE_CONNECT_PRIVATE_KEY` | **Full** contents of the `.p8` file — multiline, including `-----BEGIN PRIVATE KEY-----` / `-----END PRIVATE KEY-----` |

No other secrets are required for the automatic signing path (fresh distribution cert + profile each run, same as Codemagic).

### Variables (optional but recommended)

**Settings → Secrets and variables → Actions → Variables**

| Variable | Value | Purpose |
|----------|--------|---------|
| `APP_STORE_APPLE_ID` | 10-digit App Store Connect app id | Read latest TestFlight build from Apple (General → App Information → Apple ID). Ensures build numbers never go backwards after Codemagic. |
| `IOS_MARKETING_VERSION` | e.g. `1.3.18` | Override `expo.version` in `mobile/app.json` for this CI run only. If unset, uses `app.json` (currently `1.3.17`). |

Build number logic (`.github/scripts/ios-resolve-versions.sh`):

- If `APP_STORE_APPLE_ID` is set: `max(TestFlight latest + 1, 22)`
- Else: `max(GITHUB_RUN_NUMBER + 21, 22)` → first workflow run is **22**, then 23, 24, …

When App Store Connect closes a version train (e.g. **1.3.17** already approved), bump `expo.version` in `mobile/app.json` (e.g. **1.3.18**) before the next upload. Build number can stay on the same train only while Apple still accepts new builds for that marketing version.

### Common mistakes

- **`.p8 lines: 1`** — secret was pasted as one line. Re-paste with real line breaks or use GitHub’s multiline secret editor.
- **401 / invalid credentials** — Key ID must match the `.p8` file (wrong `AuthKey_*.p8` for the Key ID).
- **Sign in with Apple missing** — enable on `com.salino.sali` in Apple Developer, then re-run.

## Runner

`macos-26` + **Xcode 26** (`select-xcode-26.sh`). Required for App Store / TestFlight uploads that need the current iOS SDK (same rationale as Garden Guardians GHA).

## Billing

Private repo: macOS minutes use a ~10× multiplier on GitHub-hosted runners (~15–25 min per iOS job).

## Codemagic vs GitHub Actions

You can keep Codemagic as backup or switch triggers. Both use the same App Store Connect API key and the same logical pipeline; only the runner and secret store differ.

See also `mobile/README.md` and root `codemagic.yaml`.
