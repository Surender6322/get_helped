import { useEffect, useState } from 'react';
import { watchAllHelpers, setHelperVerification } from '../services/api.js';

export default function AdminDashboard() {
  const [helpers, setHelpers] = useState([]);
  const [busy, setBusy] = useState(null);

  useEffect(() => watchAllHelpers(setHelpers), []);

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
          <p>Review helper applications and manage the platform.</p>
        </div>
        <div className="row">
          <span className="pill pill-warn">{pending.length} pending</span>
          <span className="pill pill-success">{verified.length} verified</span>
        </div>
      </div>

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
