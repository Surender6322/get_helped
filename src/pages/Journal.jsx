import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { addJournalEntry, watchJournalEntries } from '../services/api.js';

const MOODS = [
  { key: 'great', emoji: '😄', label: 'Great' },
  { key: 'good', emoji: '🙂', label: 'Good' },
  { key: 'okay', emoji: '😐', label: 'Okay' },
  { key: 'down', emoji: '😔', label: 'Down' },
  { key: 'awful', emoji: '😢', label: 'Awful' },
];

const SUGGESTED_TAGS = [
  'sleep', 'work', 'study', 'family', 'relationships',
  'health', 'exercise', 'self-care', 'social', 'finances',
];

export default function Journal() {
  const { user } = useAuth();
  const [body, setBody] = useState('');
  const [mood, setMood] = useState('okay');
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [entries, setEntries] = useState([]);
  const [filter, setFilter] = useState(''); // tag filter

  useEffect(() => watchJournalEntries(user.uid, setEntries), [user.uid]);

  const filtered = useMemo(
    () => (filter ? entries.filter((e) => (e.tags || []).includes(filter)) : entries),
    [entries, filter]
  );

  const allTags = useMemo(() => {
    const s = new Set();
    entries.forEach((e) => (e.tags || []).forEach((t) => s.add(t)));
    return [...s];
  }, [entries]);

  const submit = async (e) => {
    e.preventDefault();
    const t = body.trim();
    if (!t) return;
    setBusy(true);
    try {
      await addJournalEntry({ uid: user.uid, body: t, mood, tags });
      setBody('');
      setTags([]);
      setTagInput('');
    } finally {
      setBusy(false);
    }
  };

  const addTag = (t) => {
    const norm = t.trim().toLowerCase().replace(/\s+/g, '-');
    if (!norm || tags.includes(norm) || tags.length >= 5) return;
    setTags([...tags, norm]);
    setTagInput('');
  };

  return (
    <div>
      <div className="page-h">
        <div>
          <h1>Journal</h1>
          <p>A private space — only you can read these entries.</p>
        </div>
        <span className="pill pill-info">{entries.length} entries</span>
      </div>

      <div className="grid grid-2">
        <form className="card" onSubmit={submit}>
          <div className="card-h"><h3>New entry</h3></div>

          <label>How are you feeling?</label>
          <div className="mood-row mb-3">
            {MOODS.map((m) => (
              <button
                type="button"
                key={m.key}
                className={`mood-chip ${mood === m.key ? 'active' : ''}`}
                onClick={() => setMood(m.key)}
              >
                <span style={{ fontSize: 16, marginRight: 4 }}>{m.emoji}</span>
                {m.label}
              </button>
            ))}
          </div>

          <label>What's on your mind?</label>
          <textarea
            rows={6}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Just write. No one else will read this."
          />

          <label className="mt-3">Tags (up to 5)</label>
          <div className="mood-row mb-2" style={{ gap: 6 }}>
            {tags.map((t) => (
              <span
                key={t}
                className="pill pill-info"
                style={{ cursor: 'pointer' }}
                onClick={() => setTags(tags.filter((x) => x !== t))}
                title="Click to remove"
              >
                {t} ×
              </span>
            ))}
          </div>
          <div className="row" style={{ gap: 8 }}>
            <input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addTag(tagInput);
                }
              }}
              placeholder="Add a tag and press Enter"
            />
          </div>
          <div className="mood-row mt-2" style={{ gap: 4 }}>
            <span className="muted" style={{ fontSize: 12, marginRight: 4 }}>Suggested:</span>
            {SUGGESTED_TAGS.filter((t) => !tags.includes(t)).slice(0, 6).map((t) => (
              <button
                type="button"
                key={t}
                className="pill"
                style={{ cursor: 'pointer', fontSize: 11 }}
                onClick={() => addTag(t)}
              >
                + {t}
              </button>
            ))}
          </div>

          <button className="btn btn-primary mt-3" disabled={busy || !body.trim()}>
            {busy ? 'Saving…' : 'Save entry'}
          </button>
        </form>

        <div className="card">
          <div className="card-h">
            <h3>Your entries</h3>
            {allTags.length > 0 && (
              <select value={filter} onChange={(e) => setFilter(e.target.value)} style={{ width: 'auto' }}>
                <option value="">All tags</option>
                {allTags.map((t) => (
                  <option key={t} value={t}>#{t}</option>
                ))}
              </select>
            )}
          </div>
          {filtered.length === 0 ? (
            <div className="empty">
              {filter ? `No entries with #${filter}` : 'Your private journal is empty.'}
            </div>
          ) : (
            <div className="stack" style={{ gap: 12 }}>
              {filtered.map((e) => (
                <JournalCard key={e.id} entry={e} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function JournalCard({ entry }) {
  const m = MOODS.find((x) => x.key === entry.mood);
  return (
    <div style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 10 }}>
      <div className="row between mb-2">
        <span style={{ fontSize: 14 }}>
          {m && <span style={{ marginRight: 6 }}>{m.emoji}</span>}
          <strong>{m?.label || ''}</strong>
        </span>
        <span className="muted" style={{ fontSize: 12 }}>{new Date(entry.ts).toLocaleString()}</span>
      </div>
      <div style={{ whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.5 }}>{entry.body}</div>
      {entry.tags?.length > 0 && (
        <div className="mood-row mt-2" style={{ gap: 4 }}>
          {entry.tags.map((t) => (
            <span key={t} className="pill" style={{ fontSize: 11 }}>#{t}</span>
          ))}
        </div>
      )}
    </div>
  );
}
