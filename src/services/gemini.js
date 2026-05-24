// Client wrapper for the AI Companion. Calls the `companionChat` Cloud
// Function — Gemini API key NEVER reaches the browser bundle.
//
// (Phase 2 hardening: previously Gemini was called directly from the
// browser, which leaked `VITE_GEMINI_API_KEY` into `dist/assets/*.js`.
// That key has been rotated. The new key is stored as a Cloud Functions
// secret: `firebase functions:secrets:set GEMINI_API_KEY`.)

import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase.js';

// Whether the Companion is *available* on this deployment. We can't
// directly verify the server-side secret is set, but if Functions
// initialised, we assume yes. (The function will return a
// `failed-precondition` error if the secret is missing.)
export const isCompanionConfigured = () => !!functions;

export async function chatWithCompanion({ history, message, signal }) {
  if (!functions) {
    throw new Error('Functions not initialized — Companion unavailable.');
  }
  const call = httpsCallable(functions, 'companionChat');
  const res = await call({ history, message }, { signal });
  // Server returns { reply, classification, synthetic? }
  return res.data;
}
