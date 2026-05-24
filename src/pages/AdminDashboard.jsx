import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import {
  watchAllHelpers,
  watchAllUsers,
  watchAdmins,
  approveHelper,
  rejectHelper,
  revokeHelper,
  findUserByEmail,
  setUserRole,
} from '../services/api.js';
import { formatShortDateTime } from '../utils/date.js';

const TABS = [
  { key: 'approvals', label: 'Approvals' },
  { key: 'helpers', label: 'Helpers' },
  { key: 'users', label: 'Users' },
  { key: 'admins', label: 'Admins' },
];

export default function AdminDashboard() {
  const { user: me } = useAuth();
  const [tab, setTab] = useState('approvals');
  const [helpers, setHelpers] = useState([]);
  const [users, setUsers] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [busy, setBusy] = useState(null);

  useEffect(() => watchAllHelpers(setHelpers), []);
  useEffect(() => watchAllUsers(setUsers), []);
  useEffect(() => watchAdmins(setAdmins), []);

  // Bucket helpers by verification status. Legacy helpers without an
  // explicit `verificationStatus` field default to "pending" (so the
  // admin still sees their credentials and can act on them).
  const pending = helpers.filter(
    (h) => !h.verified && (h.verificationStatus ?? 'pending') === 'pending',
  );
  const verified = helpers.filter((h) => h.verified);
  const archived = helpers.filter(
    (h) => !h.verified && (h.verificationStatus === 'rejected' || h.verificationStatus === 'revoked'),
  );

  const runWithBusy = async (uid, fn) => {
    setBusy(uid);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <div className="page-h">
        <div>
          <h1>Admin console</h1>
          <p>Review helper applications, browse the community, and manage who can administer the platform.</p>
        </div>
        <div className="row">
          <span className="pill pill-warn">{pending.length} pending</span>
          <span className="pill pill-success">{verified.length} verified</span>
          <span className="pill pill-info">{users.length} users</span>
          <span className="pill pill-info">{admins.length} admins</span>
        </div>
      </div>

      <div className="row mb-3" role="tablist" style={{ flexWrap: 'wrap', gap: 8 }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            className={`mood-chip ${tab === t.key ? 'active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
            {t.key === 'approvals' && pending.length > 0 && (
              <span className="pill pill-warn" style={{ marginLeft: 6, fontSize: 10 }}>
                {pending.length}
              </span>
            )}
            {t.key === 'helpers' && (
              <span className="muted" style={{ marginLeft: 6, fontSize: 12 }}>
                ({helpers.length})
              </span>
            )}
            {t.key === 'users' && (
              <span className="muted" style={{ marginLeft: 6, fontSize: 12 }}>
                ({users.length})
              </span>
            )}
            {t.key === 'admins' && (
              <span className="muted" style={{ marginLeft: 6, fontSize: 12 }}>
                ({admins.length})
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === 'approvals' && (
        <ApprovalsTab
          pending={pending}
          verified={verified}
          archived={archived}
          busy={busy}
          runWithBusy={runWithBusy}
        />
      )}

      {tab === 'helpers' && <HelpersDirectory helpers={helpers} />}

      {tab === 'users' && <UsersDirectory users={users} />}

      {tab === 'admins' && <AdminsCard admins={admins} me={me} />}
    </div>
  );
}

function ApprovalsTab({ pending, verified, archived, busy, runWithBusy }) {
  return (
    <>
      <div className="card mb-4">
        <div className="card-h"><h3>Pending verifications</h3></div>
        {pending.length === 0 ? (
          <div className="empty">All caught up — no pending helpers.</div>
        ) : (
          <div className="stack">
            {pending.map((h) => (
              <HelperRow
                key={h.uid}
                h={h}
                busy={busy === h.uid}
                actions={[
                  {
                    label: 'Approve',
                    variant: 'primary',
                    onClick: () => runWithBusy(h.uid, () => approveHelper(h.uid)),
                  },
                  {
                    label: 'Decline',
                    variant: 'ghost',
                    confirm:
                      "Decline this helper application? They won't be in the queue anymore — they can re-submit later from their profile.",
                    onClick: () => runWithBusy(h.uid, () => rejectHelper(h.uid)),
                  },
                ]}
              />
            ))}
          </div>
        )}
      </div>

      <div className="card mb-4">
        <div className="card-h"><h3>Verified helpers</h3></div>
        {verified.length === 0 ? (
          <div className="empty">No verified helpers yet.</div>
        ) : (
          <div className="stack">
            {verified.map((h) => (
              <HelperRow
                key={h.uid}
                h={h}
                busy={busy === h.uid}
                actions={[
                  {
                    label: 'Revoke',
                    variant: 'ghost',
                    confirm:
                      'Revoke this helper? They will no longer take new chats. They can re-apply from their profile if they want to come back.',
                    onClick: () => runWithBusy(h.uid, () => revokeHelper(h.uid)),
                  },
                ]}
              />
            ))}
          </div>
        )}
      </div>

      {archived.length > 0 && (
        <div className="card">
          <div className="card-h">
            <h3>Past helpers</h3>
            <span className="muted" style={{ fontSize: 12 }}>
              Declined or revoked. They re-enter the queue if they re-submit.
            </span>
          </div>
          <div className="stack">
            {archived.map((h) => (
              <HelperRow
                key={h.uid}
                h={h}
                busy={busy === h.uid}
                statusBadge={h.verificationStatus === 'revoked' ? 'revoked' : 'declined'}
                actions={[
                  {
                    label: 'Re-approve',
                    variant: 'primary',
                    onClick: () => runWithBusy(h.uid, () => approveHelper(h.uid)),
                  },
                ]}
              />
            ))}
          </div>
        </div>
      )}
    </>
  );
}

// --- Helpers directory: full list with search + status filter ---------

const HELPER_STATUS_OPTIONS = [
  { key: 'all', label: 'All' },
  { key: 'verified', label: 'Verified' },
  { key: 'pending', label: 'Pending' },
  { key: 'rejected', label: 'Declined' },
  { key: 'revoked', label: 'Revoked' },
];

function HelpersDirectory({ helpers }) {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    return helpers.filter((h) => {
      const stat = h.verified ? 'verified' : h.verificationStatus ?? 'pending';
      if (status !== 'all' && stat !== status) return false;
      if (!term) return true;
      return (
        (h.displayName || '').toLowerCase().includes(term) ||
        (h.email || '').toLowerCase().includes(term) ||
        (h.credentials || '').toLowerCase().includes(term)
      );
    });
  }, [helpers, q, status]);

  return (
    <div className="card">
      <div className="card-h">
        <h3>All helpers</h3>
        <span className="muted" style={{ fontSize: 12 }}>{visible.length} shown</span>
      </div>

      <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <input
          type="search"
          placeholder="Search by name, email, or credentials"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ flex: '1 1 220px', minWidth: 0 }}
        />
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
          {HELPER_STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              className={`mood-chip ${status === opt.key ? 'active' : ''}`}
              onClick={() => setStatus(opt.key)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="empty">No helpers match this filter.</div>
      ) : (
        <div className="stack">
          {visible.map((h) => (
            <HelperDirectoryRow key={h.uid} h={h} />
          ))}
        </div>
      )}
    </div>
  );
}

function HelperDirectoryRow({ h }) {
  const stat = h.verified ? 'verified' : h.verificationStatus ?? 'pending';
  const statPillClass =
    stat === 'verified'
      ? 'pill-success'
      : stat === 'pending'
        ? 'pill-warn'
        : 'pill-danger';
  const presence = h.verified
    ? h.available
      ? { label: 'available', cls: 'pill-success' }
      : { label: 'away', cls: 'pill-info' }
    : null;

  return (
    <div className="row between" style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 10, gap: 12, flexWrap: 'wrap' }}>
      <div style={{ minWidth: 0, flex: '1 1 240px' }}>
        <div style={{ fontWeight: 600 }}>
          {h.displayName || 'Helper'}
          <span className={`pill ${statPillClass}`} style={{ marginLeft: 8, fontSize: 11 }}>
            {labelForStatus(stat)}
          </span>
          {presence && (
            <span className={`pill ${presence.cls}`} style={{ marginLeft: 6, fontSize: 11 }}>
              {presence.label}
            </span>
          )}
        </div>
        <div className="muted" style={{ fontSize: 13 }}>{h.email}</div>
        <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
          Joined {formatShortDateTime(h.createdAt) || '—'}
          {h.lastAvailableAt && (
            <> · last available {formatShortDateTime(h.lastAvailableAt)}</>
          )}
        </div>
        {h.credentials && (
          <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>
            <strong>Credentials:</strong> {h.credentials}
          </div>
        )}
        {Array.isArray(h.tags) && h.tags.length > 0 && (
          <div className="row" style={{ gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
            {h.tags.map((t) => (
              <span key={t} className="pill pill-info" style={{ fontSize: 10 }}>
                {t}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function labelForStatus(s) {
  if (s === 'verified') return 'verified';
  if (s === 'pending') return 'pending';
  if (s === 'rejected') return 'declined';
  if (s === 'revoked') return 'revoked';
  return s;
}

// --- Users directory: regular accounts ---------------------------------

function UsersDirectory({ users }) {
  const [q, setQ] = useState('');

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return users;
    return users.filter(
      (u) =>
        (u.displayName || '').toLowerCase().includes(term) ||
        (u.email || '').toLowerCase().includes(term),
    );
  }, [users, q]);

  return (
    <div className="card">
      <div className="card-h">
        <h3>All users</h3>
        <span className="muted" style={{ fontSize: 12 }}>{visible.length} shown</span>
      </div>

      <input
        type="search"
        placeholder="Search by name or email"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        style={{ width: '100%', marginBottom: 12 }}
      />

      {visible.length === 0 ? (
        <div className="empty">
          {users.length === 0 ? 'No users have signed up yet.' : 'No users match this search.'}
        </div>
      ) : (
        <div className="stack">
          {visible.map((u) => (
            <div
              key={u.uid}
              className="row between"
              style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 10, gap: 12, flexWrap: 'wrap' }}
            >
              <div style={{ minWidth: 0, flex: '1 1 220px' }}>
                <div style={{ fontWeight: 600 }}>{u.displayName || 'User'}</div>
                <div className="muted" style={{ fontSize: 13 }}>{u.email}</div>
                <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                  Joined {formatShortDateTime(u.createdAt) || '—'}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Admins (existing component, just moved) ---------------------------

function AdminsCard({ admins, me }) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [revokeBusy, setRevokeBusy] = useState(null);

  const promote = async (e) => {
    e.preventDefault();
    setErr('');
    setMsg('');
    const trimmed = email.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      const found = await findUserByEmail(trimmed);
      if (!found) {
        setErr(
          `No account exists for ${trimmed}. Ask the person to register on the live site first, then promote them here.`
        );
        return;
      }
      if (found.role === 'admin') {
        setErr(`${trimmed} is already an admin.`);
        return;
      }
      await setUserRole(found.uid, 'admin');
      setMsg(`${found.displayName || trimmed} is now an admin.`);
      setEmail('');
    } catch (e2) {
      setErr(e2.message || 'Could not promote user.');
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (uid) => {
    setRevokeBusy(uid);
    setErr('');
    setMsg('');
    try {
      await setUserRole(uid, 'user');
      setMsg('Admin access revoked. The account is now a regular user.');
    } catch (e) {
      setErr(e.message || 'Could not revoke admin access.');
    } finally {
      setRevokeBusy(null);
    }
  };

  return (
    <div className="card">
      <div className="card-h">
        <h3>Admins</h3>
        <span className="pill pill-info">{admins.length} total</span>
      </div>

      <form onSubmit={promote} className="row" style={{ gap: 8, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <input
          type="email"
          placeholder="Email of an existing user/helper to promote"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{ flex: '1 1 240px', minWidth: 0 }}
        />
        <button className="btn btn-primary" disabled={busy}>
          {busy ? 'Promoting…' : 'Promote to admin'}
        </button>
      </form>
      <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>
        The person must already have a GetHelped account. Ask them to sign up at{' '}
        <code>/register</code> first if they don't.
      </p>

      {err && (
        <div className="pill pill-danger" style={{ marginTop: 10 }}>
          {err}
        </div>
      )}
      {msg && (
        <div className="pill pill-success" style={{ marginTop: 10 }}>
          {msg}
        </div>
      )}

      <div className="stack mt-3">
        {admins.length === 0 ? (
          <div className="empty">No admins yet — odd, since you're seeing this page.</div>
        ) : (
          admins.map((a) => {
            const isMe = a.uid === me.uid;
            return (
              <div
                key={a.uid}
                className="row between"
                style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 10, gap: 12, flexWrap: 'wrap' }}
              >
                <div style={{ minWidth: 0, flex: '1 1 220px' }}>
                  <div style={{ fontWeight: 600 }}>
                    {a.displayName || 'Admin'}
                    {isMe && <span className="pill pill-info" style={{ marginLeft: 8 }}>you</span>}
                  </div>
                  <div className="muted" style={{ fontSize: 13 }}>{a.email}</div>
                </div>
                <button
                  className="btn btn-ghost btn-sm"
                  disabled={isMe || revokeBusy === a.uid}
                  title={isMe ? "You can't revoke your own admin access" : 'Demote to regular user'}
                  onClick={() => revoke(a.uid)}
                >
                  {revokeBusy === a.uid ? '…' : 'Revoke admin'}
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function HelperRow({ h, actions = [], busy, statusBadge }) {
  return (
    <div className="row between" style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 10, gap: 12, flexWrap: 'wrap' }}>
      <div style={{ minWidth: 0, flex: '1 1 240px' }}>
        <div style={{ fontWeight: 600 }}>
          {h.displayName}
          {statusBadge && (
            <span className="pill pill-warn" style={{ marginLeft: 8 }}>
              {statusBadge}
            </span>
          )}
        </div>
        <div className="muted" style={{ fontSize: 13 }}>{h.email}</div>
        <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
          <strong>Credentials:</strong> {h.credentials || '—'}
        </div>
        {h.bio && <div className="muted" style={{ fontSize: 13, marginTop: 4 }}><strong>Bio:</strong> {h.bio}</div>}
      </div>
      <div className="row" style={{ gap: 8, flexShrink: 0 }}>
        {actions.map((a) => (
          <button
            key={a.label}
            className={`btn btn-${a.variant || 'ghost'} btn-sm`}
            disabled={busy}
            onClick={() => {
              if (a.confirm && !confirm(a.confirm)) return;
              a.onClick();
            }}
          >
            {busy ? '…' : a.label}
          </button>
        ))}
      </div>
    </div>
  );
}
