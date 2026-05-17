// Firebase initialization.
// The app supports two backend modes:
//   1. Real Firebase  — set VITE_USE_DEMO=false and provide config in .env
//   2. Demo (default) — uses an in-browser mock backend (./mockBackend.js)
//
// This file simply initializes Firebase when in real mode. The actual
// data-access layer lives in ./api.js which routes to either Firebase
// SDK calls or the mock backend depending on USE_DEMO.

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getDatabase } from 'firebase/database';

export const USE_DEMO =
  String(import.meta.env.VITE_USE_DEMO ?? 'true').toLowerCase() !== 'false';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
};

let app = null;
let auth = null;
let db = null;
let rtdb = null;

if (!USE_DEMO) {
  if (!firebaseConfig.apiKey) {
    console.warn(
      '[GetHelped] VITE_USE_DEMO=false but Firebase config is missing. ' +
        'Falling back to demo mode. Fill .env to enable real Firebase.'
    );
  } else {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    rtdb = getDatabase(app);
  }
}

export { app, auth, db, rtdb };
