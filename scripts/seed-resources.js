// Seed the Firestore /resources collection.
// Uses Firebase REST APIs directly (Node fetch) to avoid SDK hangs.
//
//   node scripts/seed-resources.js
//
// Reads .env from the project root.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function loadEnv() {
  const raw = readFileSync(resolve(process.cwd(), '.env'), 'utf-8');
  const out = {};
  for (const line of raw.split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

const env = loadEnv();
const API_KEY = env.VITE_FIREBASE_API_KEY;
const PROJECT_ID = env.VITE_FIREBASE_PROJECT_ID;

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@gethelped.app';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

const resources = [
  {
    id: 'r1',
    title: '4-7-8 Breathing Exercise',
    kind: 'exercise',
    summary: 'A simple breathing technique that calms the nervous system in under 2 minutes.',
    body: 'Inhale through your nose for 4 seconds. Hold for 7 seconds. Exhale through your mouth for 8 seconds. Repeat 4 times.',
  },
  {
    id: 'r2',
    title: 'Grounding 5-4-3-2-1',
    kind: 'exercise',
    summary: 'A sensory grounding technique used to reduce acute anxiety.',
    body: 'Name 5 things you can see, 4 you can feel, 3 you can hear, 2 you can smell, 1 you can taste. Bring yourself back to the present moment.',
  },
  {
    id: 'r3',
    title: 'Understanding Anxiety',
    kind: 'article',
    summary: 'What anxiety is, how it shows up in the body, and when to seek help.',
    body: 'Anxiety is a normal response to stress, but it can become persistent. Common signs include racing thoughts, restlessness, sleep changes and avoidance. Lifestyle measures (sleep, exercise, social support) help. If symptoms persist for weeks and impact daily life, please reach out to a licensed professional.',
  },
  {
    id: 'r4',
    title: 'Sleep Hygiene Basics',
    kind: 'article',
    summary: 'Small habits that improve sleep quality, which is foundational for mental health.',
    body: 'Keep a consistent sleep schedule. Avoid screens 30 minutes before bed. Keep the room cool and dark. Use the bed only for sleep. Limit caffeine after noon.',
  },
  {
    id: 'r5',
    title: 'Journaling Prompts for Difficult Days',
    kind: 'exercise',
    summary: 'Five gentle prompts to externalise and process emotions on harder days.',
    body: '1. What feeling is loudest right now? 2. Where do I feel it in my body? 3. What might it be trying to tell me? 4. What is one tiny kindness I can offer myself today? 5. Who is one person I trust I could reach out to?',
  },
];

// Convert a JS object to Firestore REST API document fields format.
function toFirestoreFields(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'string') fields[k] = { stringValue: v };
    else if (typeof v === 'number') fields[k] = Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
    else if (typeof v === 'boolean') fields[k] = { booleanValue: v };
  }
  return fields;
}

async function signIn() {
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD, returnSecureToken: true }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`Sign-in failed (${res.status}): ${json.error?.message || JSON.stringify(json)}`);
  return { idToken: json.idToken, uid: json.localId };
}

async function getUserProfile(idToken, uid) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/users/${uid}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${idToken}` } });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(`Could not read /users/${uid}: ${res.status} ${j.error?.message || ''}`);
  }
  const j = await res.json();
  const role = j.fields?.role?.stringValue;
  return { role };
}

async function writeResource(idToken, r) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/resources?documentId=${r.id}`;
  // Use create-if-not-exists; if it exists already we PATCH below.
  const body = JSON.stringify({ fields: toFirestoreFields(r) });
  let res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body,
  });
  if (res.status === 409) {
    // already exists → patch
    const patchUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/resources/${r.id}`;
    res = await fetch(patchUrl, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      body,
    });
  }
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(`${r.id}: ${res.status} ${j.error?.message || JSON.stringify(j)}`);
  }
}

async function main() {
  console.log(`→ Project: ${PROJECT_ID}`);
  console.log(`→ Signing in as ${ADMIN_EMAIL}…`);
  const { idToken, uid } = await signIn();
  console.log(`✓ Signed in (uid=${uid})`);

  console.log(`→ Verifying admin role…`);
  const profile = await getUserProfile(idToken, uid);
  if (profile.role !== 'admin') {
    console.error(`✗ This user's role is "${profile.role}", not "admin".`);
    console.error(`  Open the Firestore console and change /users/${uid}.role to "admin", then re-run.`);
    process.exit(1);
  }
  console.log(`✓ Confirmed role=admin`);

  console.log(`→ Writing ${resources.length} resource docs…`);
  for (const r of resources) {
    await writeResource(idToken, r);
    console.log(`  ✓ ${r.id}: ${r.title}`);
  }

  console.log(`✓ Done. Open https://get-helped.web.app/login → sign in as a user → Resources tab.`);
}

main().catch((e) => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
