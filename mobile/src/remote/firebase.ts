import { initializeApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { firebaseConfig } from './firebaseConfig';

const app = initializeApp(firebaseConfig);

export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});

// IMPORTANT: On React Native / Android, Firestore's default WebChannel streaming
// transport frequently hangs for tens of seconds on certain networks before
// falling back. Enabling auto-detection lets it switch to long-polling quickly
// when streaming is unavailable, eliminating the "stuck on loading after Google
// sign-in" symptom that goes away only after killing & relaunching the app.
export const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
});

export default app;
