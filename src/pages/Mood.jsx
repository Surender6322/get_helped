import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { addMood, updateMood, watchMoods } from '../services/api.js';
import MoodChart from '../components/MoodChart.jsx';
import { formatShortDateTime } from '../utils/date.js';

const moods = [
  { key: 'great', emoji: '😄', label: 'Great' },
  { key: 'good',  emoji: '🙂', label: 'Good' },
  { key: 'okay',  emoji: '😐', label: 'Okay' },
  { key: 'down',  emoji: '😔', label: 'Down' },
  { key: 'awful', emoji: '😢', label: 'Awful' },
];

function isSameDay(ts) {
  const d = new Date(ts);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export default function Mood() {
  const { user } = useAuth();
  const [selected, setSelected] = useState('okay');
  const [note, setNote] = useState('');
  const [history, setHistory] = useState([]);
  const [busy, setBusy] = useState(false);
  // When set, the form is in edit mode for an existing entry id.
  const [editingId, setEditingId] = useState(null);

  useEffect(() => watchMoods(user.uid, setHistory), [user.uid]);

  const editingEntry = useMemo(
    () => history.find((m) => m.id === editingId) || null,
    [history, editingId],
  );

  // Compassion check-in: if the last 3 entries (most recent first) are
  // all "down" or "awful", surface a non-pushy nudge toward the
  // Companion or a human helper. We deliberately don't trigger this on
  // a single bad day — that would feel surveillance-y.
  const showCheckIn = useMemo(() => {
    if (history.length < 3) return false;
    const recent = history.slice(0, 3);
    return recent.every((m) => m.mood === 'down' || m.mood === 'awful');
  }, [history]);

  const startEdit = (m) => {
    setEditingId(m.id);
    setSelected(m.mood);
    setNote(m.note || '');
    // Smoothly scroll the form into view on mobile.
    requestAnimationFrame(() => {
      document
        .getElementById('mood-form')
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setSelected('okay');
    setNote('');
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (editingId) {
        await updateMood(editingId, { mood: selected, note });
        cancelEdit();
      } else {
        await addMood({ uid: user.uid, mood: selected, note });
        setNote('');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="page-h">
        <div>
          <h1>Mood tracker</h1>
          <p>Logging how you feel — even briefly — helps you spot patterns over time.</p>
        </div>
      </div>

      {showCheckIn && (
        <div className="card mb-4 mood-checkin" role="status" aria-live="polite">
          <div style={{ fontWeight: 600, marginBottom: 6 }}>
            A few rough days in a row. That's a lot to carry.
          </div>
          <div className="muted" style={{ fontSize: 14, marginBottom: 10 }}>
            Nothing has to be wrong with you for it to feel this heavy. Want a low-pressure way to talk
            it through?
          </div>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <Link className="btn btn-primary btn-sm" to="/app/companion">
              Talk to the AI Companion
            </Link>
            <Link className="btn btn-ghost btn-sm" to="/app/helpers">
              Find a human helper
            </Link>
          </div>
        </div>
      )}

      <div className="card mb-4">
        <div className="card-h"><h3>30-day trend</h3></div>
        <MoodChart entries={history} />
      </div>

      <div className="grid grid-2">
        <form id="mood-form" className="card" onSubmit={submit}>
          <div className="card-h">
            <h3>
              {editingId
                ? "Edit today's entry"
                : 'How are you feeling right now?'}
            </h3>
            {editingEntry && (
              <span className="muted" style={{ fontSize: 12 }}>
                {formatShortDateTime(editingEntry.ts)}
              </span>
            )}
          </div>
          <fieldset
            className="mood-row"
            role="radiogroup"
            aria-labelledby="mood-q"
            style={{ border: 'none', padding: 0, margin: 0 }}
          >
            <legend id="mood-q" className="sr-only">
              How are you feeling?
            </legend>
            {moods.map((m) => (
              <button
                type="button"
                key={m.key}
                role="radio"
                aria-checked={selected === m.key}
                aria-label={m.label}
                className={`mood-chip ${selected === m.key ? 'active' : ''}`}
                onClick={() => setSelected(m.key)}
              >
                <span aria-hidden="true" style={{ fontSize: 18, marginRight: 6 }}>{m.emoji}</span>
                {m.label}
              </button>
            ))}
          </fieldset>
          <div className="form-row mt-3">
            <label>Optional note</label>
            <textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Anything you'd like to remember about today…"
            />
          </div>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn btn-primary" disabled={busy}>
              {busy
                ? (editingId ? 'Saving…' : 'Logging…')
                : (editingId ? 'Save changes' : 'Save entry')}
            </button>
            {editingId && (
              <button type="button" className="btn btn-ghost" onClick={cancelEdit} disabled={busy}>
                Cancel
              </button>
            )}
          </div>
        </form>

        <div className="card">
          <div className="card-h">
            <h3>Your history</h3>
            <span className="muted" style={{ fontSize: 12 }}>{history.length} entries</span>
          </div>
          {history.length === 0 ? (
            <div className="empty">Once you log moods, they'll show up here in reverse chronological order.</div>
          ) : (
            <div>
              {history.map((m) => {
                const def = moods.find((x) => x.key === m.mood) || moods[2];
                const editable = isSameDay(m.ts);
                return (
                  <div key={m.id} className="mood-history-row">
                    <span className="mood-emoji">{def.emoji}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600 }}>{def.label}</div>
                      {m.note && <div className="muted" style={{ fontSize: 13 }}>{m.note}</div>}
                    </div>
                    <div
                      className="muted"
                      style={{ fontSize: 12, textAlign: 'right' }}
                    >
                      <div>{formatShortDateTime(m.ts)}</div>
                      {editable && (
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          style={{ marginTop: 4 }}
                          onClick={() => startEdit(m)}
                        >
                          Edit
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <p className="muted" style={{ fontSize: 11, marginTop: 8 }}>
            Tip: only today's entries can be edited — older days stay a faithful record.
          </p>
        </div>
      </div>
    </div>
  );
}
