// Per-user, per-chat "last read message timestamp" tracker, persisted to
// localStorage. Gives us a simple unread badge without needing extra
// Firestore writes on every message view.
//
// Storage layout: { [uid]: { [chatId]: lastReadTs } }

const KEY = 'gethelped_unread_v1';

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function save(state) {
  localStorage.setItem(KEY, JSON.stringify(state));
  window.dispatchEvent(new Event('gethelped:unread-updated'));
}

export function markChatRead(uid, chatId, ts = Date.now()) {
  if (!uid || !chatId) return;
  const s = load();
  s[uid] = s[uid] || {};
  if ((s[uid][chatId] || 0) >= ts) return; // already up-to-date
  s[uid][chatId] = ts;
  save(s);
}

export function getLastReadTs(uid, chatId) {
  return load()?.[uid]?.[chatId] ?? 0;
}

// Subscribe to changes (so a sidebar badge can re-render when reads happen).
export function subscribeUnread(fn) {
  const handler = () => fn();
  window.addEventListener('gethelped:unread-updated', handler);
  window.addEventListener('storage', handler);
  return () => {
    window.removeEventListener('gethelped:unread-updated', handler);
    window.removeEventListener('storage', handler);
  };
}

// Count chats where the *last incoming* message timestamp > stored read ts.
// Caller passes in the chats array (already filtered to those involving uid).
export function countUnreadChats(uid, chats) {
  if (!chats?.length) return 0;
  let n = 0;
  for (const c of chats) {
    if (!c.lastTs) continue;
    // toMillis if firestore Timestamp; passthrough if number
    const ts = typeof c.lastTs?.toMillis === 'function' ? c.lastTs.toMillis() : c.lastTs;
    if (ts > getLastReadTs(uid, c.id)) n++;
  }
  return n;
}
