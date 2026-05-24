// Opt-in Companion memory.
//
// Stores short, user-authored or LLM-extracted snippets like:
//   { topic: "presentation today", note: "felt nervous; mentioned needing prep" }
// keyed under companionMemory/{uid}/items/{auto}, owner-readable only.
//
// We don't auto-extract via the LLM in this Phase 2 cut — that's a
// privacy decision: we want every memory item to be explicitly
// surfaced and confirmed by the user. The client passes structured
// items in via the callable.
//
// User can fully delete all memories with a single button press.

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const REGION = 'asia-south1';
const COMMON = { region: REGION, cors: true, maxInstances: 5, memory: '256MiB' };

export const saveMemoryItem = onCall(COMMON, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in.');
  const { topic, note } = request.data || {};
  const t = String(topic ?? '').slice(0, 120).trim();
  const n = String(note ?? '').slice(0, 400).trim();
  if (!t) throw new HttpsError('invalid-argument', 'topic is required.');

  const db = getFirestore();
  await db
    .collection('companionMemory')
    .doc(uid)
    .collection('items')
    .add({ topic: t, note: n, ts: FieldValue.serverTimestamp() });

  return { ok: true };
});

export const wipeMemory = onCall(COMMON, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in.');
  const db = getFirestore();
  const ref = db.collection('companionMemory').doc(uid).collection('items');
  const snap = await ref.get();
  let i = 0;
  while (i < snap.docs.length) {
    const batch = db.batch();
    for (const d of snap.docs.slice(i, i + 400)) batch.delete(d.ref);
    await batch.commit();
    i += 400;
  }
  // Also flip the opt-in flag off
  await db.doc(`users/${uid}`).set(
    { companionMemoryEnabled: false },
    { merge: true },
  );
  return { ok: true, deleted: snap.size };
});
