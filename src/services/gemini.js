// Client wrapper for the AI Companion. Calls the Cloudflare Worker
// proxy at VITE_AI_PROXY_URL — the Gemini API key NEVER reaches the
// browser bundle.
//
// Why a Cloudflare Worker (and not a Cloud Function)?
//   The Firebase project sits on the Spark plan, which doesn't include
//   Cloud Functions. Cloudflare Workers gives the same "key off the
//   client" property on a free tier with no credit card. See worker/
//   for the deployment guide.
//
// Auth flow:
//   client → fetch(VITE_AI_PROXY_URL/chat,
//                   Authorization: Bearer <Firebase ID token>) → Worker
//   Worker verifies the token's JWT signature against Firebase JWKS,
//   extracts the uid, rate-limits per uid, and forwards to Gemini.

import { auth } from './firebase.js';

const PROXY_URL = (import.meta.env.VITE_AI_PROXY_URL || '').replace(/\/$/, '');

export const isCompanionConfigured = () => !!PROXY_URL && !!auth;

export async function chatWithCompanion({ history, message, signal }) {
  if (!PROXY_URL) {
    throw new Error(
      'AI Companion is not configured on this deployment. The site owner needs to deploy the Worker (see worker/README.md).',
    );
  }
  if (!auth?.currentUser) {
    throw new Error('Sign in to use the AI Companion.');
  }
  const token = await auth.currentUser.getIdToken();
  const res = await fetch(`${PROXY_URL}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ history, message }),
    signal,
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(errBody.error || `Companion request failed (${res.status}).`);
  }
  return res.json();
}
