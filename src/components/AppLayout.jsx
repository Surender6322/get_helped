import { useEffect, useId, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { watchChatsFor, isDemo } from '../services/api.js';
import { countUnreadChats, subscribeUnread, getLastReadTs } from '../utils/unread.js';
import {
  getNotificationPermission,
  notificationsSupported,
  requestNotificationPermission,
  notify,
} from '../utils/notifications.js';
import EmergencyButton from './EmergencyButton.jsx';
import ToastHost from './ToastHost.jsx';

export default function AppLayout() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [chats, setChats] = useState([]);
  const [, setUnreadTick] = useState(0);
  const [permission, setPermission] = useState(getNotificationPermission());
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const lastNotifiedRef = useRef({}); // { chatId: lastMessageTs }

  // Auto-close the mobile drawer on every route change.
  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  // Lock body scroll while drawer is open so the page underneath doesn't
  // scroll along with the menu.
  useEffect(() => {
    if (mobileNavOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [mobileNavOpen]);

  useEffect(() => watchChatsFor(user.uid, setChats), [user.uid]);
  useEffect(() => subscribeUnread(() => setUnreadTick((t) => t + 1)), []);

  // Notify on new incoming messages in chats the user isn't currently viewing.
  useEffect(() => {
    for (const c of chats) {
      const ts = typeof c.lastTs?.toMillis === 'function' ? c.lastTs.toMillis() : c.lastTs;
      if (!ts || !c.lastMessage) continue;

      // Initialize seen-baseline from the unread tracker the *first* time we
      // observe a chat — without this, every chat would fire a notification
      // on first sidebar-load.
      if (lastNotifiedRef.current[c.id] == null) {
        lastNotifiedRef.current[c.id] = Math.max(ts, getLastReadTs(user.uid, c.id));
        continue;
      }
      if (ts <= lastNotifiedRef.current[c.id]) continue;

      // Skip if the message is from us, or if we're currently viewing this chat.
      if (c.lastFrom === user.uid) {
        lastNotifiedRef.current[c.id] = ts;
        continue;
      }
      const onActiveChat = location.pathname.endsWith(`/chat/${c.id}`);
      if (onActiveChat) {
        lastNotifiedRef.current[c.id] = ts;
        continue;
      }

      lastNotifiedRef.current[c.id] = ts;
      const target = user.role === 'helper' ? '/helper/chat' : '/app/chat';
      notify({
        title: 'New message on GetHelped',
        body: c.lastMessage.length > 80 ? c.lastMessage.slice(0, 77) + '…' : c.lastMessage,
        onClick: () => navigate(`${target}/${c.id}`),
      });
    }
  }, [chats, user.uid, user.role, location.pathname, navigate]);

  const askPermission = async () => {
    const r = await requestNotificationPermission();
    setPermission(r);
  };

  const showPermissionPrompt =
    notificationsSupported() &&
    permission === 'default' &&
    chats.length > 0;

  const unread = countUnreadChats(user.uid, chats);

  const links = navLinksFor(user.role).map((l) => ({
    ...l,
    badge: l.unreadEligible ? unread : 0,
  }));

  return (
    <div className="shell">
      <header className="mobile-topbar">
        <button
          type="button"
          className="hamburger"
          aria-label="Open navigation"
          onClick={() => setMobileNavOpen(true)}
        >
          <span /><span /><span />
        </button>
        <div className="logo logo-compact">
          <Logo />
          GetHelped
        </div>
        {unread > 0 && (
          <span className="nav-badge" style={{ marginLeft: 'auto' }}>{unread}</span>
        )}
      </header>

      <div
        className={`mobile-overlay ${mobileNavOpen ? 'open' : ''}`}
        onClick={() => setMobileNavOpen(false)}
        aria-hidden="true"
      />

      <aside className={`sidebar ${mobileNavOpen ? 'open' : ''}`}>
        <button
          type="button"
          className="sidebar-close"
          aria-label="Close navigation"
          onClick={() => setMobileNavOpen(false)}
        >
          ×
        </button>
        <div className="logo">
          <Logo />
          GetHelped
        </div>
        <nav>
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end}>
              <span style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                <span>{l.label}</span>
                {l.badge > 0 && <span className="nav-badge">{l.badge}</span>}
              </span>
            </NavLink>
          ))}
        </nav>
        <div className="me">
          <div style={{ marginBottom: 6, fontWeight: 600, color: 'var(--text)' }}>
            {user.displayName || user.email}
          </div>
          <div>
            <span className="pill pill-info">{user.role}</span>
            {user.role === 'helper' && (
              <span className={`pill ${user.verified ? 'pill-success' : 'pill-warn'}`} style={{ marginLeft: 6 }}>
                {user.verified ? 'verified' : 'pending'}
              </span>
            )}
          </div>
          <button
            className="btn btn-ghost btn-sm"
            style={{ marginTop: 10, width: '100%' }}
            onClick={async () => {
              await logout();
              navigate('/');
            }}
          >
            Sign out
          </button>
          <button
            type="button"
            className="theme-toggle"
            onClick={toggle}
            aria-label="Toggle theme"
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? '☀️ Light mode' : '🌙 Dark mode'}
          </button>
          {isDemo && (
            <div style={{ marginTop: 12, fontSize: 11 }}>
              <span className="pill pill-warn">DEMO MODE</span>
            </div>
          )}
        </div>
      </aside>
      <main className="main">
        <EmergencyButton />
        {showPermissionPrompt && (
          <div className="notif-prompt">
            <span>
              <strong>Get pinged</strong> when a helper or user messages you, even when this tab is in the background.
            </span>
            <button className="btn btn-primary btn-sm" onClick={askPermission}>
              Enable notifications
            </button>
          </div>
        )}
        <Outlet />
      </main>
      <ToastHost />
    </div>
  );
}

function navLinksFor(role) {
  if (role === 'user') {
    return [
      { to: '/app', label: 'Dashboard', end: true },
      { to: '/app/helpers', label: 'Find a Helper' },
      { to: '/app/chat', label: 'My Chats', unreadEligible: true },
      { to: '/app/companion', label: 'AI Companion' },
      { to: '/app/wall', label: 'Wall of Support' },
      { to: '/app/journal', label: 'Journal' },
      { to: '/app/mood', label: 'Mood Tracker' },
      { to: '/app/safety-plan', label: 'Safety Plan' },
      { to: '/app/resources', label: 'Resources' },
      { to: '/app/profile', label: 'Profile' },
    ];
  }
  if (role === 'helper') {
    return [
      { to: '/helper', label: 'Dashboard', end: true },
      { to: '/helper/chat', label: 'Active Chats', unreadEligible: true },
      { to: '/helper/wall', label: 'Wall of Support' },
      { to: '/helper/resources', label: 'Resources' },
      { to: '/helper/profile', label: 'Profile' },
    ];
  }
  return [
    { to: '/admin', label: 'Admin', end: true },
    { to: '/admin/profile', label: 'Profile' },
  ];
}

function Logo() {
  // Logo renders twice on the same page (mobile topbar + sidebar). Without a
  // unique gradient id per instance, the duplicate <defs id="lg"> can fail
  // to resolve in some browsers and the heart's blue background disappears,
  // leaving a white-on-white "invisible" icon in light mode.
  const reactId = useId();
  const gradId = `gh-logo-grad-${reactId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  return (
    <svg width="22" height="22" viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#7BA7E1" />
          <stop offset="100%" stopColor="#5B7FDE" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill={`url(#${gradId})`} />
      <path
        d="M32 48s-14-8.5-14-19a8 8 0 0114-5.3A8 8 0 0146 29c0 10.5-14 19-14 19z"
        fill="#fff"
      />
    </svg>
  );
}
