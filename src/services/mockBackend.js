// In-browser mock backend so the entire GetHelped app is runnable without
// a Firebase project. Persists to localStorage and emits real-time events
// across browser tabs via the `storage` event.
//
// This mirrors only the surface area used by ./api.js:
//   - users (auth)
//   - profiles (Firestore-equivalent)
//   - moods
//   - chats / messages (Realtime DB-equivalent)
//   - resources

const KEY = 'gethelped_db_v1';
const SESSION_KEY = 'gethelped_session_v1';

const seed = () => ({
  users: [
    {
      uid: 'admin-1',
      email: 'admin@gethelped.app',
      password: 'admin123',
      role: 'admin',
      displayName: 'Platform Admin',
      createdAt: Date.now(),
    },
    {
      uid: 'helper-1',
      email: 'aarav@gethelped.app',
      password: 'helper123',
      role: 'helper',
      displayName: 'Aarav Sharma',
      bio: 'Final-year M.A. Psychology student, trained in active listening.',
      credentials: 'M.A. Psychology (Year 2), Delhi University',
      verified: true,
      available: true,
      createdAt: Date.now(),
    },
    {
      uid: 'helper-2',
      email: 'meera@gethelped.app',
      password: 'helper123',
      role: 'helper',
      displayName: 'Meera Iyer',
      bio: 'Volunteer counsellor focusing on academic stress and burnout.',
      credentials: 'B.A. Psychology, Bangalore',
      verified: false,
      available: true,
      createdAt: Date.now(),
    },
    {
      uid: 'user-1',
      email: 'riya@gethelped.app',
      password: 'user123',
      role: 'user',
      displayName: 'Riya',
      anonymous: false,
      createdAt: Date.now(),
    },
  ],
  moods: [
    { uid: 'user-1', mood: 'okay', note: 'Slept well today', ts: Date.now() - 1000 * 60 * 60 * 26 },
    { uid: 'user-1', mood: 'down', note: 'Exam stress', ts: Date.now() - 1000 * 60 * 60 * 50 },
  ],
  chats: [
    // { id, userUid, helperUid, anonymous, lastMessage, lastTs, createdAt }
  ],
  messages: {
    // chatId: [ { id, from, text, ts } ]
  },
  resources: [
    {
      id: 'r1',
      title: '4-7-8 Breathing Exercise',
      kind: 'exercise',
      summary: 'A simple breathing technique that calms the nervous system in under 2 minutes.',
      body:
        'Inhale through your nose for 4 seconds. Hold for 7 seconds. Exhale through your mouth for 8 seconds. Repeat 4 times.',
    },
    {
      id: 'r2',
      title: 'Grounding 5-4-3-2-1',
      kind: 'exercise',
      summary: 'A sensory grounding technique used to reduce acute anxiety.',
      body:
        'Name 5 things you can see, 4 you can feel, 3 you can hear, 2 you can smell, 1 you can taste. Bring yourself back to the present moment.',
    },
    {
      id: 'r3',
      title: 'Understanding Anxiety',
      kind: 'article',
      summary: 'What anxiety is, how it shows up in the body, and when to seek help.',
      body:
        'Anxiety is a normal response to stress, but it can become persistent. Common signs include racing thoughts, restlessness, sleep changes and avoidance. Lifestyle measures (sleep, exercise, social support) help. If symptoms persist for weeks and impact daily life, please reach out to a licensed professional.',
    },
    {
      id: 'r4',
      title: 'Sleep Hygiene Basics',
      kind: 'article',
      summary: 'Small habits that improve sleep quality, which is foundational for mental health.',
      body:
        'Keep a consistent sleep schedule. Avoid screens 30 minutes before bed. Keep the room cool and dark. Use the bed only for sleep. Limit caffeine after noon.',
    },
    {
      id: 'r5',
      title: 'Journaling Prompts for Difficult Days',
      kind: 'exercise',
      summary: 'Five gentle prompts to externalise and process emotions on harder days.',
      body:
        '1. What feeling is loudest right now? 2. Where do I feel it in my body? 3. What might it be trying to tell me? 4. What is one tiny kindness I can offer myself today? 5. Who is one person I trust I could reach out to?',
    },
  ],
});

const helplines = [
  { name: 'iCall (India)', tel: '+91 9152987821', hours: 'Mon–Sat, 8am–10pm' },
  { name: 'Vandrevala Foundation (24x7)', tel: '+91 1860-2662-345' },
  { name: 'AASRA (24x7)', tel: '+91 9820466726' },
  { name: 'Emergency Services (India)', tel: '112' },
];

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      const s = seed();
      localStorage.setItem(KEY, JSON.stringify(s));
      return s;
    }
    return JSON.parse(raw);
  } catch (e) {
    console.error('mockBackend load failed', e);
    const s = seed();
    localStorage.setItem(KEY, JSON.stringify(s));
    return s;
  }
}

function save(state) {
  localStorage.setItem(KEY, JSON.stringify(state));
  // notify same tab listeners (storage event only fires on other tabs)
  window.dispatchEvent(new Event('gethelped:db-updated'));
}

function uid(prefix = 'id') {
  return prefix + '_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function subscribe(fn) {
  const handler = () => fn();
  window.addEventListener('storage', handler);
  window.addEventListener('gethelped:db-updated', handler);
  return () => {
    window.removeEventListener('storage', handler);
    window.removeEventListener('gethelped:db-updated', handler);
  };
}

// --- Auth ---

function getSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setSession(user, persist = true) {
  if (!user) {
    sessionStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(SESSION_KEY);
  } else {
    const value = JSON.stringify({ uid: user.uid });
    if (persist) localStorage.setItem(SESSION_KEY, value);
    sessionStorage.setItem(SESSION_KEY, value);
  }
  // Notify same-tab subscribers (the `storage` event only fires on *other*
  // tabs, so without this the AuthContext won't see same-tab sign-in/out).
  window.dispatchEvent(new Event('gethelped:db-updated'));
}

async function signUp({ email, password, role, displayName, credentials }) {
  const state = load();
  if (state.users.find((u) => u.email === email)) {
    throw new Error('An account already exists with that email.');
  }
  const newUser = {
    uid: uid(role),
    email,
    password,
    role,
    displayName,
    createdAt: Date.now(),
    ...(role === 'helper'
      ? { credentials: credentials || '', bio: '', verified: false, available: false }
      : {}),
  };
  state.users.push(newUser);
  save(state);
  setSession(newUser);
  return sanitize(newUser);
}

async function signIn({ email, password }) {
  const state = load();
  const user = state.users.find((u) => u.email === email && u.password === password);
  if (!user) throw new Error('Invalid email or password.');
  setSession(user);
  return sanitize(user);
}

function signOut() {
  setSession(null);
}

function currentUser() {
  const s = getSession();
  if (!s) return null;
  const state = load();
  const u = state.users.find((x) => x.uid === s.uid);
  return u ? sanitize(u) : null;
}

function sanitize(u) {
  const { password, ...rest } = u;
  return rest;
}

// --- Profile ---

async function updateProfile(uidStr, patch) {
  const state = load();
  const u = state.users.find((x) => x.uid === uidStr);
  if (!u) throw new Error('User not found');
  Object.assign(u, patch);
  save(state);
  return sanitize(u);
}

// --- Helpers list ---

function listHelpers({ verifiedOnly = true, availableOnly = false } = {}) {
  const state = load();
  return state.users
    .filter((u) => u.role === 'helper')
    .filter((u) => (verifiedOnly ? u.verified : true))
    .filter((u) => (availableOnly ? u.available : true))
    .map(sanitize);
}

function listAllHelpers() {
  return listHelpers({ verifiedOnly: false, availableOnly: false });
}

async function setHelperVerification(helperUid, verified) {
  return updateProfile(helperUid, { verified });
}

async function setHelperAvailability(helperUid, available) {
  return updateProfile(helperUid, { available });
}

// --- Mood ---

async function addMood({ uid: userUid, mood, note }) {
  const state = load();
  state.moods.push({ uid: userUid, mood, note: note || '', ts: Date.now() });
  save(state);
}

function listMoods(userUid) {
  const state = load();
  return state.moods
    .filter((m) => m.uid === userUid)
    .sort((a, b) => b.ts - a.ts);
}

// --- Chats ---

async function startOrGetChat({ userUid, helperUid, anonymous }) {
  const state = load();
  let chat = state.chats.find((c) => c.userUid === userUid && c.helperUid === helperUid);
  if (!chat) {
    chat = {
      id: uid('chat'),
      userUid,
      helperUid,
      anonymous: !!anonymous,
      lastMessage: '',
      lastTs: Date.now(),
      createdAt: Date.now(),
    };
    state.chats.push(chat);
    state.messages[chat.id] = [];
    save(state);
  } else if (anonymous !== undefined && chat.anonymous !== anonymous) {
    chat.anonymous = !!anonymous;
    save(state);
  }
  return chat;
}

function listChatsFor(userUid) {
  const state = load();
  return state.chats
    .filter((c) => c.userUid === userUid || c.helperUid === userUid)
    .sort((a, b) => b.lastTs - a.lastTs);
}

function listMessages(chatId) {
  const state = load();
  return state.messages[chatId] || [];
}

async function sendMessage({ chatId, from, text }) {
  const state = load();
  if (!state.messages[chatId]) state.messages[chatId] = [];
  const msg = { id: uid('m'), from, text, ts: Date.now() };
  state.messages[chatId].push(msg);
  const chat = state.chats.find((c) => c.id === chatId);
  if (chat) {
    chat.lastMessage = text;
    chat.lastTs = msg.ts;
  }
  save(state);
  return msg;
}

// --- Resources ---

function listResources() {
  return load().resources;
}

function getHelplines() {
  return helplines;
}

// --- Lookups ---

function getUser(uidStr) {
  const state = load();
  const u = state.users.find((x) => x.uid === uidStr);
  return u ? sanitize(u) : null;
}

export const mock = {
  subscribe,
  // auth
  signUp,
  signIn,
  signOut,
  currentUser,
  // profile / helpers
  updateProfile,
  listHelpers,
  listAllHelpers,
  setHelperVerification,
  setHelperAvailability,
  // mood
  addMood,
  listMoods,
  // chat
  startOrGetChat,
  listChatsFor,
  listMessages,
  sendMessage,
  // resources / lookups
  listResources,
  getHelplines,
  getUser,
};
