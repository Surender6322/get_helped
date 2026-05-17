import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import {
  watchChatsFor,
  setHelperAvailability,
  getUser,
} from '../services/api.js';

export default function HelperDashboard() {
  const { user } = useAuth();
  const [chats, setChats] = useState([]);
  const [partners, setPartners] = useState({});
  const [available, setAvailable] = useState(!!user.available);
  const [busy, setBusy] = useState(false);

  useEffect(() => watchChatsFor(user.uid, setChats), [user.uid]);

  useEffect(() => {
    (async () => {
      const map = {};
      for (const c of chats) {
        if (!map[c.userUid]) {
          const u = await getUser(c.userUid);
          map[c.userUid] = u;
        }
      }
      setPartners(map);
    })();
  }, [chats]);

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
        <div className="card mb-4" style={{ background: '#fdf6e6', borderColor: '#f0d79b' }}>
          <strong>Awaiting admin verification.</strong>{' '}
          <span className="muted">
            Your credentials have been submitted and are being reviewed. You'll be able to
            accept conversations as soon as you're verified.
          </span>
        </div>
      )}

      <div className="grid grid-3">
        <div className="card">
          <div className="card-h"><h3>Active chats</h3><span className="pill pill-info">{chats.length}</span></div>
          {chats.length === 0 ? (
            <div className="empty">No conversations yet. Set yourself to available so users can reach you.</div>
          ) : (
            <div className="stack-sm">
              {chats.slice(0, 4).map((c) => (
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
          </div>
          <Link to="/helper/profile" className="btn btn-ghost btn-sm mt-3">Edit profile</Link>
        </div>
      </div>
    </div>
  );
}
