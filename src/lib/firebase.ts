'use client';

import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut as fbSignOut, onAuthStateChanged, type User } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase (prevent re-init in HMR)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);

const googleProvider = new GoogleAuthProvider();

export async function signInWithGoogle() {
  return signInWithPopup(auth, googleProvider);
}

export async function signOut() {
  return fbSignOut(auth);
}

export { auth, onAuthStateChanged };
export type { User };
