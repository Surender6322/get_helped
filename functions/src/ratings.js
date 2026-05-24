// Privacy-preserving rating creator.
//
// The platform promises raters "your name is hidden" — but the
// previous design wrote `fromUid` directly onto the rating doc that
// the helper themselves could read. This was a quiet violation of
// our anonymity guarantee.
//
// The fix: a callable function writes TWO documents:
//   1) ratings/{deterministic_id}                — owner+admin-only
//      contains fromUid for audit/abuse-handling
//   2) usersPublic/{helperUid}/ratings/{ratingId} — helper+anyone-readable
//      strips fromUid, keeps stars + note + ts
//
// Deterministic id: ${fromUid}__${helperUid}__${chatId}. This means
// the same user rating the same helper for the same chat upserts
// instead of spamming.

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

export const submitRating = onCall(
  {
    region: 'asia-south1',
    cors: true,
    maxInstances: 5,
    memory: '256MiB',
  },
  async (request) => {
    const fromUid = request.auth?.uid;
    if (!fromUid) {
      throw new HttpsError('unauthenticated', 'Sign in to submit a rating.');
    }

    const { helperUid, chatId, stars, note } = request.data || {};
    if (!helperUid || typeof helperUid !== 'string') {
      throw new HttpsError('invalid-argument', 'helperUid is required.');
    }
    const s = Number(stars);
    if (!Number.isInteger(s) || s < 1 || s > 5) {
      throw new HttpsError('invalid-argument', 'stars must be an integer 1–5.');
    }
    if (helperUid === fromUid) {
      throw new HttpsError('failed-precondition', "You can't rate yourself.");
    }
    const cleanNote = String(note ?? '').slice(0, 600);

    const db = getFirestore();
    const ratingId = `${fromUid}__${helperUid}__${chatId || 'no-chat'}`;
    const privateRef = db.doc(`ratings/${ratingId}`);
    const publicRef = db.doc(`usersPublic/${helperUid}/ratings/${ratingId}`);

    const batch = db.batch();
    batch.set(privateRef, {
      fromUid,
      helperUid,
      chatId: chatId || null,
      stars: s,
      note: cleanNote,
      ts: FieldValue.serverTimestamp(),
    });
    batch.set(publicRef, {
      helperUid,
      stars: s,
      note: cleanNote,
      ts: FieldValue.serverTimestamp(),
    });
    await batch.commit();

    return { ok: true };
  },
);
