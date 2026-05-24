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
import { getFunctions } from 'firebase/functions';
import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
} from 'firebase/app-check';

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

// Cloud Functions region — must match what's configured in functions/src/*.
// We use asia-south1 (Mumbai) because the user base is India-first.
const FUNCTIONS_REGION = 'asia-south1';

// App Check site key (reCAPTCHA Enterprise). Optional in dev — set to
// enable App Check enforcement for hosted production.
//
// To enable:
//   1. Firebase Console → App Check → Web app → reCAPTCHA Enterprise
//   2. Create the reCAPTCHA Enterprise site key in Cloud Console
//   3. Put the site key in .env as VITE_APP_CHECK_SITE_KEY
//   4. Enforce App Check on each product (Firestore, RTDB, Functions, Auth)
//
// Without a site key, App Check is initialized in "skip" mode (no token).
const APP_CHECK_SITE_KEY = import.meta.env.VITE_APP_CHECK_SITE_KEY || '';

let app = null;
let auth = null;
let db = null;
let rtdb = null;
let functions = null;

if (!USE_DEMO) {
  if (!firebaseConfig.apiKey) {
    console.warn(
      '[GetHelped] VITE_USE_DEMO=false but Firebase config is missing. ' +
        'Falling back to demo mode. Fill .env to enable real Firebase.'
    );
  } else {
    app = initializeApp(firebaseConfig);

    // Initialize App Check first if a site key is configured. This makes
    // any subsequent SDK calls (Firestore, RTDB, Functions) pass an App
    // Check token, so the enforcement layer can reject calls from outside
    // our own pages.
    if (APP_CHECK_SITE_KEY) {
      try {
        initializeAppCheck(app, {
          provider: new ReCaptchaEnterpriseProvider(APP_CHECK_SITE_KEY),
          isTokenAutoRefreshEnabled: true,
        });
      } catch (e) {
        // Non-fatal — without App Check the app still works, just less hardened.
        console.warn('[GetHelped] App Check init failed:', e?.message || e);
      }
    }

    auth = getAuth(app);
    db = getFirestore(app);
    rtdb = getDatabase(app);
    functions = getFunctions(app, FUNCTIONS_REGION);
  }
}

export { app, auth, db, rtdb, functions };
