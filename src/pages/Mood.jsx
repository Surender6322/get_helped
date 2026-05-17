import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { addMood, watchMoods } from '../services/api.js';

const moods = [
  { key: 'great', emoji: '😄', label: 'Great' },
  { key: 'good', emoji: '🙂', label: 'Good' },
  { key: 'okay', emoji: '😐', label: 'Okay' },
  { key: 'down', emoji: '😔', label: 'Down' },
  { key: 'awful', emoji: '😢', label: 'Awful' },
];

export default function Mood() {
  const { user } = useAuth();
  const [selected, setSelected] = useState('okay');
  const [note, setNote] = useState('');
  const [history, setHistory] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => watchMoods(user.uid, setHistory), [user.uid]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await addMood({ uid: user.uid, mood: selected, note });
      setNote('');
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

      <div className="grid grid-2">
        <form className="card" onSubmit={submit}>
          <div className="card-h"><h3>How are you feeling right now?</h3></div>
          <div className="mood-row">
            {moods.map((m) => (
              <button
                type="button"
                key={m.key}
                className={`mood-chip ${selected === m.key ? 'active' : ''}`}
                onClick={() => setSelected(m.key)}
              >
                <span style={{ fontSize: 18, marginRight: 6 }}>{m.emoji}</span>
                {m.label}
              </button>
            ))}
          </div>
          <div className="form-row mt-3">
            <label>Optional note</label>
            <textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Anything you'd like to remember about today…"
            />
          </div>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save entry'}
          </button>
        </form>

        <div className="card">
          <div className="card-h"><h3>Your history</h3><span className="muted" style={{ fontSize: 12 }}>{history.length} entries</span></div>
          {history.length === 0 ? (
            <div className="empty">Once you log moods, they'll show up here in reverse chronological order.</div>
          ) : (
            <div>
              {history.map((m, i) => {
                const def = moods.find((x) => x.key === m.mood) || moods[2];
                return (
                  <div key={i} className="mood-history-row">
                    <span className="mood-emoji">{def.emoji}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600 }}>{def.label}</div>
                      {m.note && <div className="muted" style={{ fontSize: 13 }}>{m.note}</div>}
                    </div>
                    <div className="muted" style={{ fontSize: 12 }}>
                      {new Date(m.ts).toLocaleString()}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
