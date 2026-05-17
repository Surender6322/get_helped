import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import {
  watchAllHelpers,
  watchAdmins,
  setHelperVerification,
  findUserByEmail,
  setUserRole,
} from '../services/api.js';

export default function AdminDashboard() {
  const { user: me } = useAuth();
  const [helpers, setHelpers] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [busy, setBusy] = useState(null);

  useEffect(() => watchAllHelpers(setHelpers), []);
  useEffect(() => watchAdmins(setAdmins), []);

  const pending = helpers.filter((h) => !h.verified);
  const verified = helpers.filter((h) => h.verified);

  const setVerified = async (uid, value) => {
    setBusy(uid);
    try {
      await setHelperVerification(uid, value);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <div className="page-h">
        <div>
          <h1>Admin console</h1>
          <p>Review helper applications and manage who can administer the platform.</p>
        </div>
        <div className="row">
          <span className="pill pill-warn">{pending.length} pending</span>
          <span className="pill pill-success">{verified.length} verified</span>
          <span className="pill pill-info">{admins.length} admins</span>
        </div>
      </div>

      <AdminsCard admins={admins} me={me} />

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
                onApprove={() => setVerified(h.uid, true)}
                onReject={() => setVerified(h.uid, false)}
                actionLabel="Approve"
              />
            ))}
          </div>
        )}
      </div>

      <div className="card">
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
                onApprove={() => setVerified(h.uid, true)}
                onReject={() => setVerified(h.uid, false)}
                actionLabel="Revoke"
                revoke
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

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
    <div className="card mb-4">
      <div className="card-h">
        <h3>Admins</h3>
        <span className="pill pill-info">{admins.length} total</span>
      </div>

      <form onSubmit={promote} className="row" style={{ gap: 8, alignItems: 'flex-start' }}>
        <input
          type="email"
          placeholder="Email of an existing user/helper to promote"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{ flex: 1 }}
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
                style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 10 }}
              >
                <div>
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

function HelperRow({ h, onApprove, onReject, actionLabel, revoke, busy }) {
  return (
    <div className="row between" style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 10 }}>
      <div>
        <div style={{ fontWeight: 600 }}>{h.displayName}</div>
        <div className="muted" style={{ fontSize: 13 }}>{h.email}</div>
        <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
          <strong>Credentials:</strong> {h.credentials || '—'}
        </div>
        {h.bio && <div className="muted" style={{ fontSize: 13, marginTop: 4 }}><strong>Bio:</strong> {h.bio}</div>}
      </div>
      <div className="row" style={{ gap: 8 }}>
        {!revoke ? (
          <button className="btn btn-primary btn-sm" disabled={busy} onClick={onApprove}>
            {busy ? '…' : actionLabel}
          </button>
        ) : (
          <button className="btn btn-ghost btn-sm" disabled={busy} onClick={onReject}>
            {busy ? '…' : actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}
