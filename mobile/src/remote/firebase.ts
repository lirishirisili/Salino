import { initializeApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: 'AIzaSyBGooYTdkIJsxI-aPqK96xEO4YdL84P1lw',
  authDomain: 'salino-aaf86.firebaseapp.com',
  projectId: 'salino-aaf86',
  storageBucket: 'salino-aaf86.firebasestorage.app',
  messagingSenderId: '937718857697',
  appId: '1:937718857697:web:3105ed221a87f3fef3dca0',
  measurementId: 'G-DE7XS9TJZ9',
};

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
