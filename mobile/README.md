# Haserli - React Native Expo Mobile App

Cross-platform mobile app for the Haserli shared shopping list, built with React Native + Expo.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure Firebase:
   - Update `src/remote/firebase.ts` with your actual Firebase config
   - Place `GoogleService-Info.plist` in `assets/` for iOS
   - Place `google-services.json` in `assets/` for Android

3. Configure EAS:
   - Run `eas login`
   - Run `eas build:configure`
   - Update `app.json` with your EAS project ID

## Development

```bash
npx expo start
```

## Build for Production

This is the single source of truth for both Android and iOS — there is no
separate native iOS / Android project anymore.

### Android

Local build (no Mac required):

```bash
cd mobile/android
./gradlew assembleRelease -x lintVitalAnalyzeRelease -x lintVitalReportRelease -x lintVitalRelease
```

Output: `mobile/android/app/build/outputs/apk/release/app-release.apk`.

Or via EAS Build cloud:

```bash
npx eas build --platform android --profile production
```

### iOS

iOS builds run on Codemagic — no Mac required locally. Configuration lives in
the repo root `codemagic.yaml` (workflow `ios-testflight`). One click in the
Codemagic UI runs `expo prebuild`, installs pods, archives, exports the IPA,
and uploads it to App Store Connect (TestFlight).

Required Codemagic Environment groups (one-time setup, already configured for
this project):

- `app-store-connect` — App Store Connect API key:
  `APP_STORE_CONNECT_PRIVATE_KEY`, `_KEY_IDENTIFIER`, `_ISSUER_ID`.
- `ios-code-signing` — Apple Distribution certificate password (if the cert
  is password-protected; new certs created by Codemagic CLI are not).

To run a build:

1. Codemagic → Applications → Salino → **Start new build** → workflow
   **iOS — Expo TestFlight** → **Start**.
2. ~15–20 min later the IPA is uploaded to App Store Connect.
3. Wait ~10–30 min for ASC processing, then add testers under TestFlight.

EAS Build is also still configured via `eas.json` if you ever want to use it
(`npx eas build --platform ios --profile production`), but Codemagic is the
canonical path for this project.

## Architecture

- **Expo Router** — File-based routing in `app/`
- **Zustand** — State management (hooks/stores)
- **React Native Paper** — Material Design 3 components
- **Firebase** — Auth + Firestore (real-time sync)
- **i18next** — 7 languages with full RTL support
- **Repository Pattern** — Data layer abstraction

## Project Structure

```
mobile/
├── app/                    # Expo Router screens
│   ├── _layout.tsx         # Root layout (providers)
│   ├── index.tsx           # Splash/redirect logic
│   ├── auth.tsx            # Authentication screen
│   ├── household-setup.tsx # Create/join household
│   └── (main)/            # Tab-based main navigation
│       ├── shopping-list   # Main shopping list
│       ├── add-item        # Add new item form
│       ├── edit-item       # Edit existing item
│       ├── supermarket-mode# In-store shopping mode
│       ├── history         # Purchase history
│       ├── activity        # Household activity feed
│       └── settings        # App settings
├── src/
│   ├── components/        # Reusable UI components
│   ├── hooks/             # Zustand stores (viewmodels)
│   ├── i18n/              # Translations (7 languages)
│   ├── local/             # AsyncStorage persistence
│   ├── models/            # TypeScript types & enums
│   ├── remote/            # Firebase/Firestore service
│   ├── repositories/      # Data layer (local + remote)
│   ├── services/          # Business logic (detection, suggestions)
│   ├── theme/             # Colors, typography, spacing
│   └── utils/             # Text normalization, helpers
├── assets/                # Images, fonts, Firebase configs
├── app.json               # Expo configuration
├── eas.json               # EAS Build configuration
└── package.json           # Dependencies
```

## Features (matching Android 1:1)

- Google Sign-In + Email/Password auth
- Household create/join with invite codes
- Real-time synced shopping list
- Category auto-detection (multi-language)
- Duplicate detection with merge suggestions
- Smart suggestions (recurring, frequent, recent)
- Supermarket mode with filters (All/Urgent/Mine/Pharmacy)
- Recurring items with auto-scheduling
- Household activity feed
- Purchase history
- 7 languages: EN, HE, AR, FR, ES, RU, AM
- Full RTL support for Hebrew and Arabic
- Offline-first with Firestore sync
