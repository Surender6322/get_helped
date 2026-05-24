import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import {
  watchChatsFor,
  setHelperAvailability,
  resubmitForVerification,
  updateProfile,
} from '../services/api.js';
import { usePartnerNames } from '../utils/partnerCache.js';

export default function HelperDashboard() {
  const { user } = useAuth();
  const [chats, setChats] = useState([]);
  const [available, setAvailable] = useState(!!user.available);
  const [helperStatus, setHelperStatus] = useState(user.helperStatus || 'available');
  const [chatCap, setChatCap] = useState(Number(user.chatCap || 5));
  const [busy, setBusy] = useState(false);

  useEffect(() => watchChatsFor(user.uid, setChats), [user.uid]);

  // Only the top 4 chats are actually rendered, so only fetch THOSE
  // partners. Previously we walked all 100 sequentially.
  const visibleChats = useMemo(() => chats.slice(0, 4), [chats]);
  const visibleUids = useMemo(
    () => visibleChats.map((c) => c.userUid).filter(Boolean),
    [visibleChats],
  );
  const partners = usePartnerNames(visibleUids);

  const toggle = async () => {
    setBusy(true);
    try {
      const next = !available;
      await setHelperAvailability(user.uid, next);
      setAvailable(next);
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (next) => {
    setBusy(true);
    try {
      // 'recovering' implies offline-to-new-chats but the helper can
      // still finish in-flight conversations. So we leave `available`
      // alone and just flip helperStatus; the HelperList read filters
      // on this and won't surface them to new users.
      await updateProfile(user.uid, { helperStatus: next });
      setHelperStatus(next);
    } finally {
      setBusy(false);
    }
  };

  const saveCap = async (n) => {
    const v = Math.max(1, Math.min(20, Number(n) || 5));
    setChatCap(v);
    await updateProfile(user.uid, { chatCap: v });
  };

  const openChats = chats.length;
  const atCap = openChats >= chatCap;

  return (
    <div>
      <div className="page-h">
        <div>
          <h1>Welcome, {user.displayName}</h1>
          <p>Thank you for showing up for someone today.</p>
        </div>
        <div className="row">
          <span className={`pill ${user.verified ? 'pill-success' : 'pill-warn'}`}>
            {user.verified ? 'verified helper' : 'verification pending'}
          </span>
          <button
            className={`btn ${available ? 'btn-accent' : 'btn-ghost'}`}
            onClick={toggle}
            disabled={busy || !user.verified}
            title={user.verified ? '' : 'Wait for admin verification before going available.'}
          >
            {available ? 'Available' : 'Go available'}
          </button>
        </div>
      </div>

      {!user.verified && (
        <VerificationStatus user={user} />
      )}

      <div className="grid grid-3">
        <div className="card">
          <div className="card-h"><h3>Active chats</h3><span className="pill pill-info">{chats.length}</span></div>
          {chats.length === 0 ? (
            <div className="empty">No conversations yet. Set yourself to available so users can reach you.</div>
          ) : (
            <div className="stack-sm">
              {visibleChats.map((c) => (
                <Link
                  key={c.id}
                  to={`/helper/chat/${c.id}`}
                  className="row between"
                  style={{ textDecoration: 'none', color: 'inherit' }}
                >
                  <div>
                    <div style={{ fontWeight: 600 }}>
                      {c.anonymous ? 'Anonymous user' : partners[c.userUid]?.displayName || '…'}
                    </div>
                    <div className="muted" style={{ fontSize: 12 }}>
                      {c.lastMessage || 'New conversation'}
                    </div>
                  </div>
                  <span className="pill pill-info">open</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-h"><h3>Helper guidelines</h3></div>
          <ul style={{ paddingLeft: 18, margin: 0, fontSize: 14, color: 'var(--text-muted)' }}>
            <li>Listen first, advise sparingly.</li>
            <li>Validate feelings before solutions.</li>
            <li>Never diagnose — refer to a professional when in doubt.</li>
            <li>If a user mentions self-harm or imminent danger, share helplines from the emergency banner.</li>
          </ul>
        </div>

        <div className="card">
          <div className="card-h"><h3>Your status</h3></div>
          <div className="stack-sm" style={{ fontSize: 14 }}>
            <div className="row between"><span>Verification</span><span className={`pill ${user.verified ? 'pill-success' : 'pill-warn'}`}>{user.verified ? 'verified' : 'pending'}</span></div>
            <div className="row between"><span>Availability</span><span className={`pill ${available ? 'pill-success' : 'pill-info'}`}>{available ? 'available' : 'away'}</span></div>
            <div className="row between"><span>Profile complete</span><span className={`pill ${user.bio ? 'pill-success' : 'pill-warn'}`}>{user.bio ? 'yes' : 'add bio'}</span></div>
            <div className="row between">
              <span>Concurrent chat cap</span>
              <span>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={chatCap}
                  onChange={(e) => saveCap(e.target.value)}
                  style={{ width: 60, padding: '4px 6px' }}
                />
                <span className="muted" style={{ marginLeft: 6 }}>open: {openChats}</span>
              </span>
            </div>
            {atCap && (
              <div className="alert-warn" style={{ fontSize: 12, padding: 8 }}>
                You're at your chat cap. New users won't see you in the helper
                list until an existing chat closes (or you raise the cap).
              </div>
            )}
          </div>
          <Link to="/helper/profile" className="btn btn-ghost btn-sm mt-3">Edit profile</Link>
        </div>

        <div className="card">
          <div className="card-h">
            <h3>I need a break</h3>
            <span className={`pill ${helperStatus === 'recovering' ? 'pill-warn' : 'pill-info'}`}>{helperStatus}</span>
          </div>
          <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
            Holding space for someone in pain is real work. If a session was
            heavy, take a break — your existing chats stay open, but new
            users won't be routed to you until you flip back.
          </p>
          <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
            <button
              className={`btn btn-sm ${helperStatus === 'available' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setStatus('available')}
              disabled={busy}
            >
              ✅ Available
            </button>
            <button
              className={`btn btn-sm ${helperStatus === 'recovering' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setStatus('recovering')}
              disabled={busy}
              title="Pause routing of new users to you. Existing chats stay open."
            >
              ☕ Recovering
            </button>
            <button
              className={`btn btn-sm ${helperStatus === 'away' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setStatus('away')}
              disabled={busy}
              title="Stepping away — same effect as recovering, just clearer to admins."
            >
              🌙 Away
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function VerificationStatus({ user }) {
  const status = user.verificationStatus || (user.verified ? 'verified' : 'pending');
  const [busy, setBusy] = useState(false);
  const [creds, setCreds] = useState(user.credentials || '');
  const [editing, setEditing] = useState(false);

  if (status === 'verified') return null;

  const submit = async () => {
    setBusy(true);
    try {
      await resubmitForVerification(user.uid, creds);
      setEditing(false);
    } finally {
      setBusy(false);
    }
  };

  const variant =
    status === 'rejected' ? 'alert-warn' :
    status === 'revoked'  ? 'alert-warn' : 'alert-warn';

  const headline =
    status === 'pending'
      ? 'Awaiting admin verification.'
      : status === 'rejected'
        ? 'Your last application was declined.'
        : 'Your verified status was revoked.';

  const subtext =
    status === 'pending'
      ? "Your credentials are being reviewed. You'll be able to accept conversations as soon as you're verified."
      : status === 'rejected'
        ? 'You can update your credentials below and re-submit at any time.'
        : 'You can update your credentials below and re-apply for verification.';

  return (
    <div className={`card ${variant} mb-4`}>
      <strong>{headline}</strong>
      <div className="muted mt-2" style={{ fontSize: 13 }}>{subtext}</div>

      {(status === 'rejected' || status === 'revoked') && (
        <div className="mt-3">
          {!editing ? (
            <button className="btn btn-primary btn-sm" onClick={() => setEditing(true)}>
              Update credentials &amp; re-submit
            </button>
          ) : (
            <>
              <textarea
                rows={3}
                value={creds}
                onChange={(e) => setCreds(e.target.value)}
                placeholder="e.g. M.A. Psychology, 2nd year, Delhi University. Volunteer at iCall."
                style={{ marginTop: 8 }}
              />
              <div className="row mt-2" style={{ gap: 8 }}>
                <button className="btn btn-primary btn-sm" onClick={submit} disabled={busy}>
                  {busy ? 'Submitting…' : 'Re-submit for review'}
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => setEditing(false)} disabled={busy}>
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
