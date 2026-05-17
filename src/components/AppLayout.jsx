import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import EmergencyButton from './EmergencyButton.jsx';
import { isDemo } from '../services/api.js';

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const links = navLinksFor(user.role);

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="logo">
          <Logo />
          GetHelped
        </div>
        <nav>
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end}>
              {l.label}
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
          {isDemo && (
            <div style={{ marginTop: 12, fontSize: 11 }}>
              <span className="pill pill-warn">DEMO MODE</span>
            </div>
          )}
        </div>
      </aside>
      <main className="main">
        <EmergencyButton />
        <Outlet />
      </main>
    </div>
  );
}

function navLinksFor(role) {
  if (role === 'user') {
    return [
      { to: '/app', label: 'Dashboard', end: true },
      { to: '/app/helpers', label: 'Find a Helper' },
      { to: '/app/chat', label: 'My Chats' },
      { to: '/app/mood', label: 'Mood Tracker' },
      { to: '/app/resources', label: 'Resources' },
      { to: '/app/profile', label: 'Profile' },
    ];
  }
  if (role === 'helper') {
    return [
      { to: '/helper', label: 'Dashboard', end: true },
      { to: '/helper/chat', label: 'Active Chats' },
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
  return (
    <svg width="22" height="22" viewBox="0 0 64 64">
      <defs>
        <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#7BA7E1" />
          <stop offset="100%" stopColor="#5B7FDE" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill="url(#lg)" />
      <path
        d="M32 48s-14-8.5-14-19a8 8 0 0114-5.3A8 8 0 0146 29c0 10.5-14 19-14 19z"
        fill="#fff"
      />
    </svg>
  );
}
