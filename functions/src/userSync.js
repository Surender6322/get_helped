// Mirror the public-safe subset of every user doc into usersPublic/{uid}.
// This lets the rest of the app render display names, presence, and
// helper specializations without exposing email / credentials / role
// audit fields cross-user.
//
// Triggers on every users/{uid} write. Idempotent.

import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';

const PUBLIC_FIELDS = [
  'displayName',
  'role',           // public — clients already gate UI by role
  'verified',       // helper-only meta
  'available',      // helper-only meta
  'helperStatus',   // 'available' | 'recovering' | 'away' (Phase 2 E)
  'lastAvailableAt',
  'tags',           // helper specialization
  'bio',            // helper bio (intentionally public)
];

function project(data) {
  if (!data) return null;
  const out = {};
  for (const k of PUBLIC_FIELDS) if (data[k] !== undefined) out[k] = data[k];
  return out;
}

export const onUserWrite = onDocumentWritten(
  {
    region: 'asia-south1',
    document: 'users/{uid}',
  },
  async (event) => {
    const uid = event.params.uid;
    const after = event.data?.after?.data();
    const db = getFirestore();
    const ref = db.doc(`usersPublic/${uid}`);
    if (!after) {
      // user deleted — nuke the public projection
      await ref.delete().catch(() => undefined);
      return;
    }
    await ref.set(
      {
        ...project(after),
        uid,
        syncedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  },
);

// Admin-only: backfill usersPublic for every existing user. Run once
// after first deployment to populate the projection for users who
// existed before the trigger was wired.
export const backfillUsersPublic = onCall(
  {
    region: 'asia-south1',
    cors: true,
    maxInstances: 1,
    memory: '512MiB',
    timeoutSeconds: 300,
  },
  async (request) => {
    const callerUid = request.auth?.uid;
    if (!callerUid) throw new HttpsError('unauthenticated', 'Sign in.');
    const db = getFirestore();
    const me = await db.doc(`users/${callerUid}`).get();
    if (me.data()?.role !== 'admin') {
      throw new HttpsError('permission-denied', 'Admins only.');
    }

    const snap = await db.collection('users').get();
    const batchSize = 400;
    let written = 0;
    for (let i = 0; i < snap.docs.length; i += batchSize) {
      const batch = db.batch();
      for (const d of snap.docs.slice(i, i + batchSize)) {
        batch.set(
          db.doc(`usersPublic/${d.id}`),
          {
            ...project(d.data()),
            uid: d.id,
            syncedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
        written++;
      }
      await batch.commit();
    }

    return { ok: true, written };
  },
);
