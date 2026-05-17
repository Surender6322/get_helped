// Unified API. All UI code talks to this module — never to Firebase or
// mockBackend directly. This makes swapping the backend a single-flag change.

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  onAuthStateChanged,
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
  await updateDoc(doc(db, 'chats', chatId), { lastMessage: text, lastTs: serverTimestamp() });
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
