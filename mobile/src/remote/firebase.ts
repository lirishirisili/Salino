import { initializeApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
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

export const db = getFirestore(app);

export default app;
