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
  onSnapshot,
  getDocs,
  serverTimestamp,
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

import { auth, db, rtdb, USE_DEMO } from './firebase.js';
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

export async function getUser(uid) {
  if (isDemo) return mock.getUser(uid);
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? snap.data() : null;
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

export async function setHelperVerification(helperUid, verified) {
  if (isDemo) return mock.setHelperVerification(helperUid, verified);
  return updateDoc(doc(db, 'users', helperUid), { verified });
}

export async function setHelperAvailability(helperUid, available) {
  if (isDemo) return mock.setHelperAvailability(helperUid, available);
  return updateDoc(doc(db, 'users', helperUid), { available });
}

// ----------------- Mood -----------------

export async function addMood({ uid, mood, note }) {
  if (isDemo) return mock.addMood({ uid, mood, note });
  return addDoc(collection(db, 'moods'), {
    uid, mood, note: note || '', ts: serverTimestamp(),
  });
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
    cb(snap.docs.map((d) => ({ ...d.data(), ts: d.data().ts?.toMillis?.() ?? Date.now() })))
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
  return (await getDoc(ref)).data();
}

export function watchChatsFor(uid, cb) {
  if (isDemo) {
    const send = () => cb(mock.listChatsFor(uid));
    const unsub = mock.subscribe(send);
    send();
    return unsub;
  }
  const q1 = query(collection(db, 'chats'), where('userUid', '==', uid));
  const q2 = query(collection(db, 'chats'), where('helperUid', '==', uid));
  let aRows = [], bRows = [];
  const emit = () => {
    const merged = [...aRows, ...bRows].sort(
      (a, b) => (b.lastTs?.toMillis?.() ?? 0) - (a.lastTs?.toMillis?.() ?? 0)
    );
    cb(merged);
  };
  const u1 = onSnapshot(q1, (s) => { aRows = s.docs.map((d) => d.data()); emit(); });
  const u2 = onSnapshot(q2, (s) => { bRows = s.docs.map((d) => d.data()); emit(); });
  return () => { u1(); u2(); };
}

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
  await set(newRef, { from, text, ts: Date.now() });
  // also bump lastMessage on chat doc
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
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const data = snap.data();
  const heartUids = Array.isArray(data.heartUids) ? data.heartUids : [];
  const has = heartUids.includes(uid);
  await updateDoc(ref, {
    heartUids: has ? heartUids.filter((u) => u !== uid) : [...heartUids, uid],
    hearts: has ? Math.max(0, (data.hearts || 0) - 1) : (data.hearts || 0) + 1,
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

// ----------------- Helper ratings (anonymous) -----------------

export async function rateHelper({ helperUid, fromUid, chatId, stars, note }) {
  if (isDemo) return mock.rateHelper({ helperUid, fromUid, chatId, stars, note });
  return addDoc(collection(db, 'ratings'), {
    helperUid, fromUid, chatId, stars, note: note || '',
    ts: serverTimestamp(),
  });
}

export function watchRatingsFor(helperUid, cb) {
  if (isDemo) {
    const send = () => cb(mock.listRatingsFor(helperUid));
    const unsub = mock.subscribe(send);
    send();
    return unsub;
  }
  const q = query(collection(db, 'ratings'), where('helperUid', '==', helperUid));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => d.data())));
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
