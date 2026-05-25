// Notification helper. Uses the standard Browser Notification API for
// system-level alerts when the tab is unfocused, and falls back to an
// in-app toast (event-bus pattern) when permission is denied or when the
// tab is currently focused.
//
// We use a simple custom event so any component can listen for toasts
// without prop-drilling.

const TOAST_EVENT = 'gethelped:toast';
const MUTED_EVENT = 'gethelped:notif-muted';
const MUTED_KEY = 'gethelped_notifications_muted';

export function notificationsSupported() {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getNotificationPermission() {
  if (!notificationsSupported()) return 'unsupported';
  return Notification.permission; // 'granted' | 'denied' | 'default'
}

export async function requestNotificationPermission() {
  if (!notificationsSupported()) return 'unsupported';
  if (Notification.permission !== 'default') return Notification.permission;
  try {
    return await Notification.requestPermission();
  } catch {
    return 'denied';
  }
}

// Browsers don't let web apps revoke their own permission. Instead, we
// keep an in-app "muted" flag in localStorage so users get a real
// disable button — the next time we'd show a notification, we just skip.
export function isNotificationsMuted() {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(MUTED_KEY) === '1';
}

export function setNotificationsMuted(muted) {
  if (typeof window === 'undefined') return;
  if (muted) localStorage.setItem(MUTED_KEY, '1');
  else localStorage.removeItem(MUTED_KEY);
  window.dispatchEvent(new CustomEvent(MUTED_EVENT, { detail: { muted } }));
}

export function subscribeMuted(handler) {
  const fn = (e) => handler(e.detail);
  window.addEventListener(MUTED_EVENT, fn);
  return () => window.removeEventListener(MUTED_EVENT, fn);
}

// Show either a system notification or an in-app toast, depending on
// permission state and tab visibility. Honours the in-app "muted" flag.
export function notify({ title, body, onClick }) {
  if (isNotificationsMuted()) return;
  const visible = typeof document !== 'undefined' && document.visibilityState === 'visible';

  // If tab is focused, prefer an in-app toast (less intrusive).
  if (visible) {
    pushToast({ title, body, onClick });
    return;
  }

  // Tab unfocused — try system notification first.
  if (notificationsSupported() && Notification.permission === 'granted') {
    try {
      const n = new Notification(title, {
        body,
        icon: '/favicon.svg',
        tag: 'gethelped-msg',
      });
      n.onclick = () => {
        window.focus();
        if (onClick) onClick();
        n.close();
      };
      return;
    } catch {
      // fall through to toast
    }
  }

  pushToast({ title, body, onClick });
}

export function pushToast(payload) {
  window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail: payload }));
}

export function subscribeToasts(handler) {
  const fn = (e) => handler(e.detail);
  window.addEventListener(TOAST_EVENT, fn);
  return () => window.removeEventListener(TOAST_EVENT, fn);
}
