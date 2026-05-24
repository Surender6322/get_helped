// Unified API. All UI code talks to this module — never to Firebase or
// mockBackend directly. This makes swapping the backend a single-flag change.

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  onAuthStateChanged,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  addDoc,
  query,
  where,
  orderBy,
  limit as fbLimit,
  onSnapshot,
  getDocs,
  serverTimestamp,
  deleteDoc,
  arrayUnion,
  arrayRemove,
  increment,
} from 'firebase/firestore';
import {
  ref as rtdbRef,
  onChildAdded,
  push,
  onValue,
  set,
  remove,
  off,
} from 'firebase/database';
import { httpsCallable } from 'firebase/functions';

import { auth, db, rtdb, functions, USE_DEMO } from './firebase.js';
import { mock } from './mockBackend.js';

// Whether we are *effectively* in demo mode (forced demo or missing config).
export const isDemo = USE_DEMO || !auth;

// ----------------- Auth -----------------

export async function register({ email, password, role, displayName, credentials }) {
  if (isDemo) return mock.signUp({ email, password, role, displayName, credentials });
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  const profile = {
    uid: cred.user.uid,
    email,
    role,
    displayName,
    createdAt: serverTimestamp(),
    ...(role === 'helper'
      ? { credentials: credentials || '', bio: '', verified: false, available: false }
      : {}),
  };
  await setDoc(doc(db, 'users', cred.user.uid), profile);
  return profile;
}

export async function login({ email, password }) {
  if (isDemo) return mock.signIn({ email, password });
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const snap = await getDoc(doc(db, 'users', cred.user.uid));
  return snap.exists() ? snap.data() : { uid: cred.user.uid, email };
}

export async function logout() {
  if (isDemo) return mock.signOut();
  return fbSignOut(auth);
}

export function watchAuth(cb) {
  if (isDemo) {
    const unsub = mock.subscribe(() => cb(mock.currentUser()));
    cb(mock.currentUser());
    return unsub;
  }
  return onAuthStateChanged(auth, async (u) => {
    if (!u) return cb(null);
    const snap = await getDoc(doc(db, 'users', u.uid));
    cb(snap.exists() ? snap.data() : { uid: u.uid, email: u.email });
  });
}

// ----------------- Profile -----------------

export async function updateProfile(uid, patch) {
  if (isDemo) return mock.updateProfile(uid, patch);
  await updateDoc(doc(db, 'users', uid), patch);
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.data();
}

function normalizeUser(data) {
  if (!data) return data;
  return {
    ...data,
    lastAvailableAt:
      data.lastAvailableAt?.toMillis?.() ?? data.lastAvailableAt ?? null,
  };
}

export async function getUser(uid) {
  if (isDemo) return mock.getUser(uid);
  // Self-read goes to our own private doc. Cross-user reads prefer
  // usersPublic (post-Phase-2 architecture) and fall back to /users
  // while backfill is pending — once usersPublic is populated and
  // /users reads are locked down, the fallback becomes a no-op.
  const meUid = auth?.currentUser?.uid;
  if (meUid === uid) {
    const snap = await getDoc(doc(db, `users/${uid}`));
    return snap.exists() ? normalizeUser(snap.data()) : null;
  }
  const pubSnap = await getDoc(doc(db, `usersPublic/${uid}`));
  if (pubSnap.exists()) return normalizeUser(pubSnap.data());
  const fallback = await getDoc(doc(db, `users/${uid}`));
  return fallback.exists() ? normalizeUser(fallback.data()) : null;
}

// Live-subscribe to a single user doc. Used in chat to keep partner
// presence (`available`, `lastAvailableAt`) up to date without manual
// reloads. Returns an unsubscribe function.
export function watchUser(uid, cb) {
  if (isDemo) return mock.watchUser(uid, cb);
  const meUid = auth?.currentUser?.uid;
  if (meUid === uid) {
    return onSnapshot(doc(db, `users/${uid}`), (snap) => {
      cb(snap.exists() ? normalizeUser(snap.data()) : null);
    });
  }
  // Cross-user: try usersPublic first, fall back to /users transparently.
  let pubExists = false;
  let unsubFallback = null;
  const unsubPub = onSnapshot(doc(db, `usersPublic/${uid}`), (snap) => {
    if (snap.exists()) {
      pubExists = true;
      if (unsubFallback) {
        unsubFallback();
        unsubFallback = null;
      }
      cb(normalizeUser(snap.data()));
    } else if (!pubExists && !unsubFallback) {
      unsubFallback = onSnapshot(doc(db, `users/${uid}`), (s2) => {
        cb(s2.exists() ? normalizeUser(s2.data()) : null);
      });
    }
  });
  return () => {
    unsubPub();
    if (unsubFallback) unsubFallback();
  };
}

export async function findUserByEmail(email) {
  if (isDemo) return mock.findUserByEmail(email);
  const q = query(collection(db, 'users'), where('email', '==', email));
  const snap = await getDocs(q);
  return snap.empty ? null : snap.docs[0].data();
}

export async function setUserRole(uid, role) {
  if (isDemo) return mock.setUserRole(uid, role);
  await updateDoc(doc(db, 'users', uid), { role });
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.data();
}

// Password change — requires reauth in real Firebase. In demo mode the
// mock backend does an in-memory check.
export async function changePassword({ currentPassword, newPassword }) {
  if (isDemo) return mock.changePassword({ currentPassword, newPassword });
  const u = auth.currentUser;
  if (!u || !u.email) throw new Error('Not signed in.');
  const cred = EmailAuthProvider.credential(u.email, currentPassword);
  try {
    await reauthenticateWithCredential(u, cred);
  } catch (e) {
    if (e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential') {
      throw new Error('Current password is incorrect.');
    }
    throw e;
  }
  await updatePassword(u, newPassword);
}

// ----------------- Helpers -----------------

export function watchHelpers(cb, opts = { verifiedOnly: true, availableOnly: false }) {
  if (isDemo) {
    const send = () => cb(mock.listHelpers(opts));
    const unsub = mock.subscribe(send);
    send();
    return unsub;
  }
  // PHASE 2 NOTE: long-term this should query usersPublic only. We
  // still hit /users while the backfill+rules tighten happens, since
  // older clients & projects without Functions deployed won't have
  // populated usersPublic yet.
  const filters = [where('role', '==', 'helper')];
  if (opts.verifiedOnly) filters.push(where('verified', '==', true));
  if (opts.availableOnly) filters.push(where('available', '==', true));
  const q = query(collection(db, 'users'), ...filters);
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => d.data())));
}

export function watchAllHelpers(cb) {
  if (isDemo) {
    const send = () => cb(mock.listAllHelpers());
    const unsub = mock.subscribe(send);
    send();
    return unsub;
  }
  const q = query(collection(db, 'users'), where('role', '==', 'helper'));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => d.data())));
}

export function watchAdmins(cb) {
  if (isDemo) {
    const send = () => cb(mock.listAdmins());
    const unsub = mock.subscribe(send);
    send();
    return unsub;
  }
  const q = query(collection(db, 'users'), where('role', '==', 'admin'));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => d.data())));
}

// All `role: 'user'` accounts — used by the admin "Users" directory.
export function watchAllUsers(cb) {
  if (isDemo) {
    const send = () => cb(mock.listAllUsers());
    const unsub = mock.subscribe(send);
    send();
    return unsub;
  }
  const q = query(collection(db, 'users'), where('role', '==', 'user'));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => d.data())));
}

// Helper verification has 4 states. We keep both the legacy `verified`
// boolean (used widely across rules / UI) and an explicit
// `verificationStatus` so the admin can distinguish a helper who's never
// applied, one who's pending review, one who's been rejected, and one
// whose verification was revoked.
//
//   verified=false, verificationStatus='pending'  → in admin pending list
//   verified=true,  verificationStatus='verified' → live, in verified list
//   verified=false, verificationStatus='rejected' → not shown anywhere
//   verified=false, verificationStatus='revoked'  → not shown anywhere
//
// `rejected` and `revoked` differ only in label — both let the helper
// re-submit credentials from their profile to re-enter the pending queue.

export async function approveHelper(helperUid) {
  if (isDemo) return mock.setHelperVerificationStatus(helperUid, 'verified');
  return updateDoc(doc(db, 'users', helperUid), {
    verified: true,
    verificationStatus: 'verified',
  });
}

export async function rejectHelper(helperUid) {
  if (isDemo) return mock.setHelperVerificationStatus(helperUid, 'rejected');
  return updateDoc(doc(db, 'users', helperUid), {
    verified: false,
    verificationStatus: 'rejected',
    available: false,
  });
}

export async function revokeHelper(helperUid) {
  if (isDemo) return mock.setHelperVerificationStatus(helperUid, 'revoked');
  return updateDoc(doc(db, 'users', helperUid), {
    verified: false,
    verificationStatus: 'revoked',
    available: false,
  });
}

// Helper resubmits their credentials for verification (from their profile).
export async function resubmitForVerification(helperUid, credentials) {
  if (isDemo) {
    return mock.setHelperVerificationStatus(helperUid, 'pending', { credentials });
  }
  return updateDoc(doc(db, 'users', helperUid), {
    credentials: credentials || '',
    verificationStatus: 'pending',
  });
}

// Legacy alias kept for places that still call setHelperVerification —
// approve/revoke are clearer at the call site, but we don't break the API.
export async function setHelperVerification(helperUid, verified) {
  if (verified) return approveHelper(helperUid);
  return revokeHelper(helperUid);
}

export async function setHelperAvailability(helperUid, available) {
  if (isDemo) return mock.setHelperAvailability(helperUid, available);
  // Always stamp lastAvailableAt on both transitions:
  //   - going available  → "they were last 'available' at this moment" (now)
  //   - going unavailable → "this is when they stopped being available" (now)
  // Either way `now` is correct. Writing on both edges also means existing
  // helpers don't need a special backfill — the next toggle of any kind
  // populates the field.
  return updateDoc(doc(db, 'users', helperUid), {
    available,
    lastAvailableAt: serverTimestamp(),
  });
}

// ----------------- Mood -----------------

export async function addMood({ uid, mood, note }) {
  if (isDemo) return mock.addMood({ uid, mood, note });
  return addDoc(collection(db, 'moods'), {
    uid, mood, note: note || '', ts: serverTimestamp(),
  });
}

// Edit an existing mood entry. Allowed only for the owner; on the
// client side we additionally restrict to "today" entries (UX rule).
export async function updateMood(id, { mood, note }) {
  if (isDemo) return mock.updateMood(id, { mood, note });
  return updateDoc(doc(db, 'moods', id), { mood, note: note || '' });
}

export function watchMoods(uid, cb) {
  if (isDemo) {
    const send = () => cb(mock.listMoods(uid));
    const unsub = mock.subscribe(send);
    send();
    return unsub;
  }
  const q = query(collection(db, 'moods'), where('uid', '==', uid), orderBy('ts', 'desc'));
  return onSnapshot(q, (snap) =>
    cb(
      snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        ts: d.data().ts?.toMillis?.() ?? Date.now(),
      })),
    ),
  );
}

// ----------------- Chats -----------------

export async function startOrGetChat({ userUid, helperUid, anonymous }) {
  if (isDemo) return mock.startOrGetChat({ userUid, helperUid, anonymous });
  // Use deterministic chat id so we don't create duplicates.
  const chatId = `${userUid}__${helperUid}`;
  const ref = doc(db, 'chats', chatId);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      id: chatId,
      userUid,
      helperUid,
      anonymous: !!anonymous,
      lastMessage: '',
      lastTs: serverTimestamp(),
      createdAt: serverTimestamp(),
    });
  } else if (anonymous !== undefined && snap.data().anonymous !== anonymous) {
    await updateDoc(ref, { anonymous: !!anonymous });
  }
  return normalizeChat((await getDoc(ref)).data());
}

// Normalize Firestore Timestamps in a chat doc into JS millis so the UI
// can pass them straight to `new Date(...)` without Invalid Date results.
function normalizeChat(data) {
  if (!data) return data;
  return {
    ...data,
    createdAt: data.createdAt?.toMillis?.() ?? data.createdAt ?? null,
    lastTs: data.lastTs?.toMillis?.() ?? data.lastTs ?? null,
  };
}

export function watchChatsFor(uid, cb) {
  if (isDemo) {
    const send = () => cb(mock.listChatsFor(uid));
    const unsub = mock.subscribe(send);
    send();
    return unsub;
  }
  // We cap each side to a generous limit so a helper with thousands of
  // historical chats doesn't pull them all on first paint. We deliberately
  // *don't* `orderBy('lastTs')` server-side — that silently excludes any
  // chat doc whose lastTs is missing/null (e.g. a brand-new chat where the
  // server timestamp hasn't resolved yet, or legacy docs from older code
  // paths). Sorting client-side handles those gracefully.
  const CHAT_PAGE = 200;
  const q1 = query(
    collection(db, 'chats'),
    where('userUid', '==', uid),
    fbLimit(CHAT_PAGE),
  );
  const q2 = query(
    collection(db, 'chats'),
    where('helperUid', '==', uid),
    fbLimit(CHAT_PAGE),
  );
  let aRows = [], bRows = [];
  const emit = () => {
    const merged = [...aRows, ...bRows].sort(
      (a, b) => (b.lastTs ?? b.createdAt ?? 0) - (a.lastTs ?? a.createdAt ?? 0),
    );
    cb(merged);
  };
  const u1 = onSnapshot(q1, (s) => { aRows = s.docs.map((d) => normalizeChat(d.data())); emit(); });
  const u2 = onSnapshot(q2, (s) => { bRows = s.docs.map((d) => normalizeChat(d.data())); emit(); });
  return () => { u1(); u2(); };
}

// Phase 2 J — RTDB → Firestore migration, in dual-write mode.
//
// Why dual-write: the existing RTDB-backed chat history is the source
// of truth for every existing user. Switching reads to Firestore today
// would lose every prior message. Instead we:
//   • dual-write every NEW message to BOTH RTDB and the new Firestore
//     subcollection chats/{chatId}/messages
//   • keep reads on RTDB for now (until a backfill/dump is run)
//   • a follow-up sprint will run a one-shot migration of historical
//     RTDB messages → Firestore, then flip reads.
//
// This deploy adds the Firestore-side path WITHOUT regressing anyone.

export function watchMessages(chatId, cb) {
  if (isDemo) {
    const send = () => cb(mock.listMessages(chatId));
    const unsub = mock.subscribe(send);
    send();
    return unsub;
  }
  const r = rtdbRef(rtdb, `messages/${chatId}`);
  let buffer = [];
  const handler = onValue(r, (snap) => {
    const val = snap.val() || {};
    buffer = Object.entries(val)
      .map(([id, m]) => ({ id, ...m }))
      .sort((a, b) => a.ts - b.ts);
    cb(buffer);
  });
  return () => off(r, 'value', handler);
}

export async function sendMessage({ chatId, from, text }) {
  if (isDemo) return mock.sendMessage({ chatId, from, text });
  const r = rtdbRef(rtdb, `messages/${chatId}`);
  const newRef = push(r);
  const ts = Date.now();
  // Write to RTDB (current source of truth) and Firestore subcollection
  // in parallel. If Firestore fails we log but don't break the chat —
  // the user's message still goes through via RTDB.
  const rtdbWrite = set(newRef, { from, text, ts });
  const fsWrite = addDoc(collection(db, `chats/${chatId}/messages`), {
    from,
    text,
    ts: serverTimestamp(),
    clientTs: ts,
  }).catch((e) => {
    console.warn('[GetHelped] Firestore mirror write failed (RTDB still authoritative):', e?.message || e);
  });
  await Promise.all([rtdbWrite, fsWrite]);
  await updateDoc(doc(db, 'chats', chatId), {
    lastMessage: text,
    lastTs: serverTimestamp(),
    lastFrom: from,
  });
}

// ----------------- Typing indicator -----------------

// We write the *timestamp* of last activity at /typing/{chatId}/{uid}.
// Subscribers consider the user "typing" if their timestamp is within
// the last 6 seconds. The sender clears the entry on stop or unmount.

export async function setTyping({ chatId, uid, typing }) {
  if (isDemo) return mock.setTyping({ chatId, uid, typing });
  const r = rtdbRef(rtdb, `typing/${chatId}/${uid}`);
  if (typing) await set(r, Date.now());
  else await remove(r);
}

export function watchTyping({ chatId, exceptUid }, cb) {
  if (isDemo) {
    const send = () => cb(mock.listTypingExcept({ chatId, exceptUid }));
    const unsub = mock.subscribe(send);
    send();
    return unsub;
  }
  const r = rtdbRef(rtdb, `typing/${chatId}`);
  const handler = onValue(r, (snap) => {
    const val = snap.val() || {};
    const fresh = Object.entries(val)
      .filter(([uid, ts]) => uid !== exceptUid && Date.now() - ts < 6000)
      .map(([uid]) => uid);
    cb(fresh);
  });
  return () => off(r, 'value', handler);
}

// ----------------- Wall of Support (anonymous community feed) -----------------

export async function createWallPost({ uid, body, kind = 'vent' }) {
  if (isDemo) return mock.createWallPost({ uid, body, kind });
  const ref = await addDoc(collection(db, 'wallPosts'), {
    uid, body, kind,
    hearts: 0,
    heartUids: [],
    ts: serverTimestamp(),
  });
  return ref.id;
}

export function watchWallPosts(cb) {
  if (isDemo) {
    const send = () => cb(mock.listWallPosts());
    const unsub = mock.subscribe(send);
    send();
    return unsub;
  }
  const q = query(collection(db, 'wallPosts'), orderBy('ts', 'desc'));
  return onSnapshot(q, (snap) =>
    cb(
      snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        ts: d.data().ts?.toMillis?.() ?? Date.now(),
      }))
    )
  );
}

export async function toggleHeartWallPost({ postId, uid }) {
  if (isDemo) return mock.toggleHeartWallPost({ postId, uid });
  const ref = doc(db, 'wallPosts', postId);
  // Atomic check-and-toggle: read once to know which side to flip,
  // then commit with arrayUnion/arrayRemove + increment so concurrent
  // hearts from different users never lose a count. (See library
  // toggleLibraryLike for the same pattern.)
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const data = snap.data();
  const has = Array.isArray(data.heartUids) && data.heartUids.includes(uid);
  await updateDoc(ref, {
    heartUids: has ? arrayRemove(uid) : arrayUnion(uid),
    hearts: increment(has ? -1 : 1),
  });
}

export async function addWallReply({ postId, uid, body }) {
  if (isDemo) return mock.addWallReply({ postId, uid, body });
  return addDoc(collection(db, 'wallPosts', postId, 'replies'), {
    uid, body, ts: serverTimestamp(),
  });
}

export function watchWallReplies(postId, cb) {
  if (isDemo) {
    const send = () => cb(mock.listWallReplies(postId));
    const unsub = mock.subscribe(send);
    send();
    return unsub;
  }
  const q = query(collection(db, 'wallPosts', postId, 'replies'), orderBy('ts', 'asc'));
  return onSnapshot(q, (snap) =>
    cb(
      snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        ts: d.data().ts?.toMillis?.() ?? Date.now(),
      }))
    )
  );
}

// ----------------- Journal (private to user) -----------------

export async function addJournalEntry({ uid, body, mood, tags }) {
  if (isDemo) return mock.addJournalEntry({ uid, body, mood, tags });
  return addDoc(collection(db, 'journal'), {
    uid, body, mood: mood || null, tags: tags || [],
    ts: serverTimestamp(),
  });
}

export function watchJournalEntries(uid, cb) {
  if (isDemo) {
    const send = () => cb(mock.listJournalEntries(uid));
    const unsub = mock.subscribe(send);
    send();
    return unsub;
  }
  const q = query(collection(db, 'journal'), where('uid', '==', uid), orderBy('ts', 'desc'));
  return onSnapshot(q, (snap) =>
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data(), ts: d.data().ts?.toMillis?.() ?? Date.now() })))
  );
}

// ----------------- Crisis Safety Plan -----------------

export async function saveSafetyPlan({ uid, plan }) {
  if (isDemo) return mock.saveSafetyPlan({ uid, plan });
  await setDoc(doc(db, 'safetyPlans', uid), { uid, ...plan, updatedAt: serverTimestamp() });
}

export async function getSafetyPlan(uid) {
  if (isDemo) return mock.getSafetyPlan(uid);
  const snap = await getDoc(doc(db, 'safetyPlans', uid));
  return snap.exists() ? snap.data() : null;
}

// ----------------- Helper-only supervision wall -----------------

export async function createHelperWallPost({ uid, displayName, body, kind = 'reflection' }) {
  if (isDemo) {
    return mock.createHelperWallPost({ uid, displayName, body, kind });
  }
  return addDoc(collection(db, 'helperWall'), {
    uid,
    displayName: displayName || 'A helper',
    body: String(body || '').slice(0, 1500),
    kind,
    ts: serverTimestamp(),
  });
}

export function watchHelperWallPosts(cb) {
  if (isDemo) {
    const send = () => cb(mock.listHelperWallPosts());
    const unsub = mock.subscribe(send);
    send();
    return unsub;
  }
  const q = query(collection(db, 'helperWall'), orderBy('ts', 'desc'), fbLimit(50));
  return onSnapshot(q, (snap) =>
    cb(
      snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        ts: d.data().ts?.toMillis?.() ?? Date.now(),
      })),
    ),
  );
}

export async function deleteHelperWallPost(id) {
  if (isDemo) return mock.deleteHelperWallPost(id);
  return deleteDoc(doc(db, 'helperWall', id));
}

// ----------------- Companion memory (opt-in, owner-only) -----------------

export async function saveCompanionMemoryItem({ topic, note }) {
  if (isDemo) return { ok: true };
  if (!functions) throw new Error('Functions not initialized.');
  const call = httpsCallable(functions, 'saveMemoryItem');
  const res = await call({ topic, note });
  return res.data;
}

export async function wipeCompanionMemory() {
  if (isDemo) return { ok: true, deleted: 0 };
  if (!functions) throw new Error('Functions not initialized.');
  const call = httpsCallable(functions, 'wipeMemory');
  const res = await call({});
  return res.data;
}

export function watchCompanionMemory(uid, cb) {
  if (isDemo) {
    cb([]);
    return () => {};
  }
  const q = query(
    collection(db, `companionMemory/${uid}/items`),
    orderBy('ts', 'desc'),
    fbLimit(20),
  );
  return onSnapshot(q, (snap) =>
    cb(
      snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        ts: d.data().ts?.toMillis?.() ?? null,
      })),
    ),
  );
}

// ----------------- Backfill helper (admin only) -----------------
//
// One-shot migration: populate /usersPublic from existing /users docs
// for every user that existed before the onUserWrite trigger was
// deployed. Idempotent — safe to call repeatedly.
export async function backfillPublicProfiles() {
  if (isDemo) return { ok: true, written: 0 };
  if (!functions) throw new Error('Functions not initialized.');
  const call = httpsCallable(functions, 'backfillUsersPublic');
  const res = await call({});
  return res.data;
}

// ----------------- Helper ratings (truly anonymous) -----------------
//
// Ratings are written through a Cloud Function so the rater's uid never
// reaches the helper. The function writes:
//   - ratings/{deterministic_id}                — admin-only, has fromUid
//   - usersPublic/{helperUid}/ratings/{...}     — anonymized, helper-readable

export async function rateHelper({ helperUid, chatId, stars, note }) {
  if (isDemo) return mock.rateHelper({ helperUid, fromUid: null, chatId, stars, note });
  if (!functions) throw new Error('Functions not initialized.');
  const call = httpsCallable(functions, 'submitRating');
  const res = await call({ helperUid, chatId, stars, note: note || '' });
  return res.data;
}

export function watchRatingsFor(helperUid, cb) {
  if (isDemo) {
    const send = () => cb(mock.listRatingsFor(helperUid));
    const unsub = mock.subscribe(send);
    send();
    return unsub;
  }
  // Read the anonymized public mirror — never the raw /ratings collection.
  const q = query(collection(db, `usersPublic/${helperUid}/ratings`));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => d.data())));
}

// ----------------- Library (helper-authored, admin-approved) -----------------
//
// Users see only approved articles + exercises and can heart them.
// Helpers compose and submit; their drafts and submitted posts are
// private until an admin approves. The collection is `library`.

function normalizeLibraryPost(d) {
  const data = d.data ? d.data() : d;
  const id = d.id ?? data.id;
  return {
    ...data,
    id,
    createdAt: data.createdAt?.toMillis?.() ?? data.createdAt ?? null,
    approvedAt: data.approvedAt?.toMillis?.() ?? data.approvedAt ?? null,
  };
}

export async function createLibraryPost({ authorUid, authorName, kind, title, body }) {
  if (isDemo) return mock.createLibraryPost({ authorUid, authorName, kind, title, body });
  return addDoc(collection(db, 'library'), {
    authorUid,
    authorName: authorName || 'Helper',
    kind, // 'article' | 'exercise'
    title,
    body,
    status: 'submitted',
    createdAt: serverTimestamp(),
    approvedAt: null,
    approvedBy: null,
    likes: 0,
    likeUids: [],
  });
}

export async function updateLibraryPost(id, fields) {
  if (isDemo) return mock.updateLibraryPost(id, fields);
  return updateDoc(doc(db, 'library', id), fields);
}

export async function deleteLibraryPost(id) {
  if (isDemo) return mock.deleteLibraryPost(id);
  return deleteDoc(doc(db, 'library', id));
}

export async function approveLibraryPost(id, adminUid) {
  if (isDemo) return mock.approveLibraryPost(id, adminUid);
  return updateDoc(doc(db, 'library', id), {
    status: 'approved',
    approvedAt: serverTimestamp(),
    approvedBy: adminUid,
  });
}

export async function rejectLibraryPost(id) {
  if (isDemo) return mock.rejectLibraryPost(id);
  return updateDoc(doc(db, 'library', id), { status: 'rejected' });
}

// Toggle the calling user's like on an approved post. Uses
// arrayUnion / arrayRemove + a counter so we don't need a transaction.
export async function toggleLibraryLike(id, uid, currentlyLiked) {
  if (isDemo) return mock.toggleLibraryLike(id, uid, currentlyLiked);
  return updateDoc(doc(db, 'library', id), {
    likeUids: currentlyLiked ? arrayRemove(uid) : arrayUnion(uid),
    likes: increment(currentlyLiked ? -1 : 1),
  });
}

// All approved posts, newest first, for browsing by users.
export function watchApprovedLibrary(cb) {
  if (isDemo) {
    const send = () => cb(mock.listLibrary({ status: 'approved' }));
    const unsub = mock.subscribe(send);
    send();
    return unsub;
  }
  const q = query(collection(db, 'library'), where('status', '==', 'approved'));
  return onSnapshot(q, (s) => {
    const rows = s.docs.map(normalizeLibraryPost);
    rows.sort((a, b) => (b.approvedAt ?? b.createdAt ?? 0) - (a.approvedAt ?? a.createdAt ?? 0));
    cb(rows);
  });
}

// Submitted (= awaiting review) posts for the admin queue.
export function watchPendingLibrary(cb) {
  if (isDemo) {
    const send = () => cb(mock.listLibrary({ status: 'submitted' }));
    const unsub = mock.subscribe(send);
    send();
    return unsub;
  }
  const q = query(collection(db, 'library'), where('status', '==', 'submitted'));
  return onSnapshot(q, (s) => {
    const rows = s.docs.map(normalizeLibraryPost);
    rows.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
    cb(rows);
  });
}

// All posts authored by `uid`, regardless of status, for the helper's
// own dashboard view.
export function watchMyLibrary(uid, cb) {
  if (isDemo) {
    const send = () => cb(mock.listLibrary({ authorUid: uid }));
    const unsub = mock.subscribe(send);
    send();
    return unsub;
  }
  const q = query(collection(db, 'library'), where('authorUid', '==', uid));
  return onSnapshot(q, (s) => {
    const rows = s.docs.map(normalizeLibraryPost);
    rows.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
    cb(rows);
  });
}

// ----------------- Resources / Helplines -----------------

export async function listResources() {
  if (isDemo) return mock.listResources();
  const snap = await getDocs(collection(db, 'resources'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export function getHelplines() {
  return mock.getHelplines();
}
