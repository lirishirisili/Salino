import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyARN6h3Yv66WJh3WyxGODVJDhCBELk_hyg',
  authDomain: 'salino-aaf86.firebaseapp.com',
  projectId: 'salino-aaf86',
  storageBucket: 'salino-aaf86.firebasestorage.app',
  messagingSenderId: '937718857697',
  appId: '1:937718857697:web:salino-pwa',
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

// Enable offline persistence
enableIndexedDbPersistence(db).catch((err) => {
  if (err.code === 'failed-precondition') {
    console.warn('Firestore persistence failed: multiple tabs open');
  } else if (err.code === 'unimplemented') {
    console.warn('Firestore persistence not available in this browser');
  }
});
