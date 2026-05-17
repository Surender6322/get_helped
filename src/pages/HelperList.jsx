import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { watchHelpers, startOrGetChat } from '../services/api.js';

export default function HelperList() {
  const { user } = useAuth();
  const [helpers, setHelpers] = useState([]);
  const [anon, setAnon] = useState(false);
  const [busy, setBusy] = useState(null);
  const navigate = useNavigate();

  useEffect(
    () => watchHelpers((rows) => setHelpers(rows), { verifiedOnly: true, availableOnly: false }),
    []
  );

  const start = async (helper) => {
    setBusy(helper.uid);
    try {
      const chat = await startOrGetChat({
        userUid: user.uid,
        helperUid: helper.uid,
        anonymous: anon,
      });
      navigate(`/app/chat/${chat.id}`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <div className="page-h">
        <div>
          <h1>Find a helper</h1>
          <p>All helpers below have been verified by our admin team.</p>
        </div>
        <label className="row" style={{ gap: 8, fontSize: 14 }}>
          <input
            type="checkbox"
            checked={anon}
            onChange={(e) => setAnon(e.target.checked)}
            style={{ width: 'auto' }}
          />
          Talk anonymously
        </label>
      </div>

      {helpers.length === 0 ? (
        <div className="card empty">
          No verified helpers found. Please check back soon — new helpers are reviewed regularly.
        </div>
      ) : (
        <div className="grid grid-2">
          {helpers.map((h) => (
            <div key={h.uid} className="card">
              <div className="row between">
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>{h.displayName}</div>
                  <div className="muted" style={{ fontSize: 13 }}>{h.credentials || 'Trained peer helper'}</div>
                </div>
                <span className={`pill ${h.available ? 'pill-success' : 'pill-warn'}`}>
                  {h.available ? 'available' : 'away'}
                </span>
              </div>
              {h.bio && <p className="muted mt-2" style={{ fontSize: 14 }}>{h.bio}</p>}
              <div className="row between mt-3">
                <span className="pill pill-info">verified</span>
                <button
                  className="btn btn-primary btn-sm"
                  disabled={busy === h.uid}
                  onClick={() => start(h)}
                >
                  {busy === h.uid ? 'Starting…' : anon ? 'Start anonymous chat' : 'Start chat'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
