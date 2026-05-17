import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { watchHelpers, startOrGetChat } from '../services/api.js';
import { HELPER_TAGS, tagLabel } from '../utils/helperTags.js';

export default function HelperList() {
  const { user } = useAuth();
  const [helpers, setHelpers] = useState([]);
  const [anon, setAnon] = useState(false);
  const [activeTags, setActiveTags] = useState([]);
  const [busy, setBusy] = useState(null);
  const navigate = useNavigate();

  useEffect(
    () => watchHelpers((rows) => setHelpers(rows), { verifiedOnly: true, availableOnly: false }),
    []
  );

  const filtered = useMemo(() => {
    if (activeTags.length === 0) return helpers;
    return helpers.filter((h) => {
      const t = Array.isArray(h.tags) ? h.tags : [];
      return activeTags.every((req) => t.includes(req));
    });
  }, [helpers, activeTags]);

  const toggleTag = (k) =>
    setActiveTags((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]));

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

      <div className="card mb-4">
        <div className="card-h">
          <h3>Filter by what you'd like to talk about</h3>
          {activeTags.length > 0 && (
            <button className="btn btn-ghost btn-sm" onClick={() => setActiveTags([])}>
              Clear filters
            </button>
          )}
        </div>
        <div className="mood-row" style={{ gap: 6 }}>
          {HELPER_TAGS.map((t) => (
            <button
              key={t.key}
              className={`mood-chip ${activeTags.includes(t.key) ? 'active' : ''}`}
              onClick={() => toggleTag(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="muted mt-2" style={{ fontSize: 12 }}>
          Showing {filtered.length} of {helpers.length} verified helpers
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card empty">
          {activeTags.length
            ? 'No helpers match every selected specialization. Try removing some filters.'
            : 'No verified helpers found. Please check back soon — new helpers are reviewed regularly.'}
        </div>
      ) : (
        <div className="grid grid-2">
          {filtered.map((h) => (
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
              {Array.isArray(h.tags) && h.tags.length > 0 && (
                <div className="mood-row mt-2" style={{ gap: 4 }}>
                  {h.tags.map((t) => (
                    <span
                      key={t}
                      className="pill pill-info"
                      style={{ fontSize: 11 }}
                    >
                      {tagLabel(t)}
                    </span>
                  ))}
                </div>
              )}
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
