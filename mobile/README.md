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

```bash
# iOS
eas build --platform ios

# Android
eas build --platform android
```

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
