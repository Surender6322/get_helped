import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { addJournalEntry, watchJournalEntries } from '../services/api.js';
import {
  isEncryptionConfigured,
  isEncryptionUnlocked,
  enableEncryption,
  unlockEncryption,
  lockEncryption,
  encryptString,
  decryptString,
  looksEncrypted,
  resetEncryption,
} from '../utils/clientCrypto.js';

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
  const [e2eOn, setE2eOn] = useState(isEncryptionConfigured());
  const [e2eUnlocked, setE2eUnlocked] = useState(isEncryptionUnlocked());

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
      // Optional client-side encryption: if the user has set up a
      // passphrase AND has it unlocked, encrypt the body before send.
      // Otherwise write plaintext like before.
      let payload = t;
      if (e2eOn && e2eUnlocked) {
        try {
          payload = await encryptString(t);
        } catch (err) {
          alert("Couldn't encrypt: " + (err?.message || err));
          return;
        }
      }
      await addJournalEntry({ uid: user.uid, body: payload, mood, tags });
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
        <div className="row" style={{ gap: 8, alignItems: 'center' }}>
          <span className="pill pill-info">{entries.length} entries</span>
          <E2EControls
            on={e2eOn}
            unlocked={e2eUnlocked}
            setOn={setE2eOn}
            setUnlocked={setE2eUnlocked}
          />
        </div>
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
  const [body, setBody] = useState(() =>
    looksEncrypted(entry.body) ? null : String(entry.body || ''),
  );
  const [decryptErr, setDecryptErr] = useState('');

  useEffect(() => {
    if (!looksEncrypted(entry.body)) return;
    (async () => {
      try {
        const plain = await decryptString(entry.body);
        setBody(plain);
      } catch (err) {
        setDecryptErr(err?.message || 'Locked');
      }
    })();
  }, [entry.body]);

  return (
    <div style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 10 }}>
      <div className="row between mb-2">
        <span style={{ fontSize: 14 }}>
          {m && <span style={{ marginRight: 6 }}>{m.emoji}</span>}
          <strong>{m?.label || ''}</strong>
          {looksEncrypted(entry.body) && (
            <span className="pill pill-info" style={{ marginLeft: 6, fontSize: 11 }}>🔒 encrypted</span>
          )}
        </span>
        <span className="muted" style={{ fontSize: 12 }}>{new Date(entry.ts).toLocaleString()}</span>
      </div>
      {body !== null ? (
        <div style={{ whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.5 }}>{body}</div>
      ) : (
        <div className="muted" style={{ fontSize: 13, fontStyle: 'italic' }}>
          {decryptErr ? `🔒 ${decryptErr}` : 'Decrypting…'}
        </div>
      )}
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

function E2EControls({ on, unlocked, setOn, setUnlocked }) {
  const [open, setOpen] = useState(false);
  const [pass, setPass] = useState('');
  const [pass2, setPass2] = useState('');
  const [err, setErr] = useState('');

  const enable = async (e) => {
    e.preventDefault();
    setErr('');
    if (pass !== pass2) return setErr('Passphrases do not match.');
    try {
      await enableEncryption(pass);
      setOn(true);
      setUnlocked(true);
      setOpen(false);
      setPass('');
      setPass2('');
    } catch (e2) {
      setErr(e2?.message || 'Failed to enable.');
    }
  };

  const unlock = async (e) => {
    e.preventDefault();
    setErr('');
    try {
      await unlockEncryption(pass);
      setUnlocked(true);
      setOpen(false);
      setPass('');
    } catch (e2) {
      setErr(e2?.message || 'Wrong passphrase.');
    }
  };

  if (!on) {
    return (
      <>
        <button className="btn btn-ghost btn-sm" onClick={() => setOpen(true)} title="Encrypt new journal entries on this device">
          🔒 Set passphrase
        </button>
        {open && (
          <Modal title="Encrypt your journal" onClose={() => setOpen(false)}>
            <p style={{ fontSize: 13 }}>
              Pick a passphrase. New entries you write will be encrypted in
              your browser before they're saved — even Firebase admins can't
              read them. <strong>If you forget this passphrase, those entries
              are gone forever.</strong> No reset, no recovery.
            </p>
            <form onSubmit={enable} className="stack-sm">
              <input
                type="password"
                placeholder="Passphrase (min 6 chars)"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                autoFocus
                minLength={6}
              />
              <input
                type="password"
                placeholder="Confirm passphrase"
                value={pass2}
                onChange={(e) => setPass2(e.target.value)}
                minLength={6}
              />
              {err && <div className="pill pill-danger">{err}</div>}
              <button className="btn btn-primary" disabled={pass.length < 6 || pass !== pass2}>
                Enable encryption
              </button>
            </form>
          </Modal>
        )}
      </>
    );
  }

  if (!unlocked) {
    return (
      <>
        <button className="btn btn-ghost btn-sm" onClick={() => setOpen(true)}>
          🔒 Unlock
        </button>
        {open && (
          <Modal title="Unlock journal" onClose={() => setOpen(false)}>
            <form onSubmit={unlock} className="stack-sm">
              <input
                type="password"
                placeholder="Your passphrase"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                autoFocus
              />
              {err && <div className="pill pill-danger">{err}</div>}
              <button className="btn btn-primary">Unlock</button>
            </form>
          </Modal>
        )}
      </>
    );
  }

  return (
    <button
      className="btn btn-ghost btn-sm"
      onClick={() => {
        lockEncryption();
        setUnlocked(false);
      }}
      title="Lock encryption (your passphrase will be cleared from this tab)"
    >
      🔓 Lock
    </button>
  );
}

function Modal({ title, children, onClose }) {
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <div className="row between mb-3">
          <h3 style={{ margin: 0 }}>{title}</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}
