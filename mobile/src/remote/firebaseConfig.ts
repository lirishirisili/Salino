import { Platform } from 'react-native';
import type { FirebaseOptions } from 'firebase/app';

/** Shared across all Firebase apps in project salino-aaf86. */
const shared = {
  authDomain: 'salino-aaf86.firebaseapp.com',
  projectId: 'salino-aaf86',
  storageBucket: 'salino-aaf86.firebasestorage.app',
  messagingSenderId: '937718857697',
} as const;

/** Salino iOS — from GoogleService-Info.plist (not Salino Native Web). */
const iosConfig: FirebaseOptions = {
  ...shared,
  apiKey: 'AIzaSyDz6PtAtn5eojaw1wO-9a8TMRW4dBIiJvo',
  appId: '1:937718857697:ios:1425610fc3c94b65f3dca0',
};

/** com.salino.sali — from google-services.json. */
const androidConfig: FirebaseOptions = {
  ...shared,
  apiKey: 'AIzaSyARN6h3Yv66WJh3WyxGODVJDhCBELk_hyg',
  appId: '1:937718857697:android:de4a8ba93194f01ef3dca0',
};

export const firebaseConfig: FirebaseOptions =
  Platform.OS === 'ios'
    ? iosConfig
    : Platform.OS === 'android'
      ? androidConfig
      : iosConfig;

/** REVERSED_CLIENT_ID — required for Google Sign-In URL scheme on iOS. */
export const iosGoogleUrlScheme =
  'com.googleusercontent.apps.937718857697-6ui8hs9m3vo4sdr2irippl26r39c18sh';
