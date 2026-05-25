// Firebase initialization (Spark-plan compatible).
// The app supports two backend modes:
//   1. Real Firebase  — set VITE_USE_DEMO=false and provide config in .env
//   2. Demo (default) — uses an in-browser mock backend (./mockBackend.js)
//
// Phase 2 architecture note:
//   • The AI Companion no longer calls Gemini from the browser. It
//     calls a Cloudflare Worker proxy at VITE_AI_PROXY_URL — see
//     ../services/gemini.js and the worker/ folder.
//   • Anonymized helper ratings + the /usersPublic projection are
//     written client-side via Firestore writeBatch (see api.js).
//   • App Check (reCAPTCHA Enterprise) is wired here but optional —
//     leave VITE_APP_CHECK_SITE_KEY blank to skip.

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getDatabase } from 'firebase/database';
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

// App Check site key (reCAPTCHA Enterprise). Optional in dev; set this
// to enforce App Check in production. See README.
//   1. Firebase Console → App Check → Web app → reCAPTCHA Enterprise
//   2. Create the reCAPTCHA Enterprise site key in Cloud Console
//   3. Put the site key in .env as VITE_APP_CHECK_SITE_KEY
//   4. Enforce App Check on each product (Firestore, RTDB, Auth)
const APP_CHECK_SITE_KEY = import.meta.env.VITE_APP_CHECK_SITE_KEY || '';

let app = null;
let auth = null;
let db = null;
let rtdb = null;

if (!USE_DEMO) {
  if (!firebaseConfig.apiKey) {
    console.warn(
      '[GetHelped] VITE_USE_DEMO=false but Firebase config is missing. ' +
        'Falling back to demo mode. Fill .env to enable real Firebase.',
    );
  } else {
    app = initializeApp(firebaseConfig);

    if (APP_CHECK_SITE_KEY) {
      try {
        initializeAppCheck(app, {
          provider: new ReCaptchaEnterpriseProvider(APP_CHECK_SITE_KEY),
          isTokenAutoRefreshEnabled: true,
        });
      } catch (e) {
        console.warn('[GetHelped] App Check init failed:', e?.message || e);
      }
    }

    auth = getAuth(app);
    db = getFirestore(app);
    rtdb = getDatabase(app);
  }
}

export { app, auth, db, rtdb };
