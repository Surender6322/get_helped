// AI Companion page — always-available empathetic chat. Conversations are
// kept in localStorage on the device only (never sent to Firestore) so the
// user has maximum privacy. They can clear history at any time.

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { chatWithCompanion, isCompanionConfigured } from '../services/gemini.js';
import { detectCrisisSignals } from '../utils/crisisDetection.js';
import {
  getHelplines,
  saveCompanionMemoryItem,
  wipeCompanionMemory,
  watchCompanionMemory,
  updateProfile,
  getUser,
} from '../services/api.js';
import { CrisisModal } from '../components/EmergencyButton.jsx';
import { useEscapeKey } from '../hooks/useEscapeKey.js';

const KEY_PREFIX = 'gethelped_companion_';
const MAX_HISTORY = 30; // last N messages used for context

const SUGGESTIONS = [
  "I've had a rough day, can we just talk?",
  "Aaj bahut overthinking ho rahi hai, help kar do.",
  "Help me wind down before bed.",
  "Kal exam hai, anxiety ho rahi hai.",
];

const GREETING = {
  role: 'assistant',
  text:
    "Hey, I'm here. ☺️ This is your safe space — whatever you share stays just between us.\n\n" +
    "Talk to me in whichever language feels easiest — English, हिंदी, Hinglish, mix-and-match — koi problem nahi. " +
    "I'll meet you where you are.\n\n" +
    "So… what's on your mind right now?",
};

function loadHistory(uid) {
  try {
    const raw = localStorage.getItem(KEY_PREFIX + uid);
    if (!raw) return [GREETING];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) && arr.length ? arr : [GREETING];
  } catch {
    return [GREETING];
  }
}

function saveHistory(uid, history) {
  try {
    localStorage.setItem(KEY_PREFIX + uid, JSON.stringify(history.slice(-100)));
  } catch {}
}

export default function Companion() {
  const { user } = useAuth();
  const [history, setHistory] = useState(() => loadHistory(user.uid));
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showCrisis, setShowCrisis] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => saveHistory(user.uid, history), [user.uid, history]);
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [history, busy]);

  if (!isCompanionConfigured()) {
    return <NotConfigured />;
  }

  const send = async (overrideText) => {
    const t = (overrideText ?? text).trim();
    if (!t || busy) return;
    setError('');

    // Local crisis classifier — independent of the LLM. If it fires
    // high we surface the helpline panel immediately, regardless of
    // what the model returns. (Per JMIR 2026 / Headspace Ebb pattern:
    // safety detection runs as a separate pipeline.)
    const localClass = detectCrisisSignals(t);
    if (localClass.severity === 'high') setShowCrisis(true);

    const userMsg = { role: 'user', text: t, ts: Date.now() };
    const next = [...history, userMsg];
    setHistory(next);
    setText('');
    setBusy(true);

    try {
      const recent = next.slice(-MAX_HISTORY);

      // If the user has opted in to memory, prepend a synthetic "user"
      // turn at the front of the history that lists what they've asked
      // the Companion to remember. We do NOT commit this synthetic
      // turn to localStorage — it only goes to the LLM for context.
      let historyForCall = recent.slice(0, -1);
      if (memoryEnabled && memories.length > 0) {
        const lines = memories
          .map((m) => `• ${m.topic}${m.note ? ' — ' + m.note : ''}`)
          .join('\n');
        historyForCall = [
          {
            role: 'user',
            text:
              "Note for context — these are things I've explicitly asked you to remember about me. " +
              "Use them lightly; don't recite them back unless relevant:\n" +
              lines,
          },
          ...historyForCall,
        ];
      }

      const result = await chatWithCompanion({
        history: historyForCall,
        message: t,
      });
      setHistory((cur) => [
        ...cur,
        {
          role: 'assistant',
          text: result.reply,
          ts: Date.now(),
          synthetic: result.synthetic,
        },
      ]);
    } catch (e) {
      setError(e.message || 'Something went wrong.');
      setHistory((cur) => [
        ...cur,
        {
          role: 'assistant',
          text:
            "I couldn't reach the AI service just now. If this is urgent please call a helpline, " +
            'or reach out to a human helper from the "Find a Helper" page.',
          ts: Date.now(),
          isError: true,
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  const reset = () => setConfirmReset(true);
  const doReset = () => {
    setHistory([GREETING]);
    setConfirmReset(false);
  };

  // ---- Companion memory (opt-in) ----
  const [memoryEnabled, setMemoryEnabled] = useState(false);
  const [memories, setMemories] = useState([]);
  const [showMemoryPanel, setShowMemoryPanel] = useState(false);
  const [memoryTopic, setMemoryTopic] = useState('');
  const [memoryNote, setMemoryNote] = useState('');
  const [memBusy, setMemBusy] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const u = await getUser(user.uid);
        if (mounted) setMemoryEnabled(!!u?.companionMemoryEnabled);
      } catch {
        // ignore — assume off
      }
    })();
    return () => {
      mounted = false;
    };
  }, [user.uid]);

  useEffect(() => {
    if (!memoryEnabled) {
      setMemories([]);
      return undefined;
    }
    return watchCompanionMemory(user.uid, setMemories);
  }, [memoryEnabled, user.uid]);

  const toggleMemory = async () => {
    const next = !memoryEnabled;
    setMemoryEnabled(next);
    try {
      if (!next) {
        // Turning OFF wipes existing memories.
        await wipeCompanionMemory();
      } else {
        await updateProfile(user.uid, { companionMemoryEnabled: true });
      }
    } catch (e) {
      setMemoryEnabled(!next); // revert on failure
      setError(e?.message || 'Could not update memory setting.');
    }
  };

  const saveMemory = async (e) => {
    e.preventDefault();
    const t = memoryTopic.trim();
    if (!t) return;
    setMemBusy(true);
    try {
      await saveCompanionMemoryItem({ topic: t, note: memoryNote.trim() });
      setMemoryTopic('');
      setMemoryNote('');
    } catch (e2) {
      setError(e2?.message || 'Could not save.');
    } finally {
      setMemBusy(false);
    }
  };

  return (
    <div className="page-fill">
      <div className="page-h">
        <div>
          <h1>AI Companion</h1>
          <p>
            Always-on, gentle listener — speak in any language you're comfortable
            with: English, <span lang="hi">हिंदी</span>, Hinglish, switch as you go.
            For tough moments, please reach out to a{' '}
            <strong>real human helper</strong> from "Find a Helper".
          </p>
        </div>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <span className="pill pill-info">🌐 multi-lingual</span>
          <span className="pill pill-info">private to this device</span>
          {memoryEnabled && (
            <span className="pill pill-success">memory: on</span>
          )}
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setShowMemoryPanel((v) => !v)}
          >
            🧠 Memory
          </button>
          <button className="btn btn-ghost btn-sm" onClick={reset}>
            Clear chat
          </button>
        </div>
      </div>

      <div
        className="card companion-shell"
        style={{ padding: 0 }}
      >
        <div
          ref={scrollRef}
          className="chat-msgs"
          style={{ flex: 1, minHeight: 0, padding: 16 }}
        >
          {history.map((m, idx) => (
            <CompanionMessage key={idx} msg={m} />
          ))}
          {busy && (
            <div className="msg them typing-bubble">
              <span className="typing-dot" />
              <span className="typing-dot" />
              <span className="typing-dot" />
            </div>
          )}
        </div>

        {history.length <= 1 && !busy && (
          <div style={{ padding: '0 16px 12px' }}>
            <div className="muted mb-2" style={{ fontSize: 12 }}>Try one of these to start:</div>
            <div className="mood-row" style={{ gap: 6 }}>
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  className="mood-chip"
                  onClick={() => send(s)}
                  disabled={busy}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        <form
          className="chat-input"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type how you're feeling…"
            disabled={busy}
            autoFocus
          />
          <button className="btn btn-primary" disabled={busy || !text.trim()}>
            {busy ? '…' : 'Send'}
          </button>
        </form>
      </div>

      {showMemoryPanel && (
        <div className="card mt-3 memory-panel">
          <div className="card-h">
            <h3>🧠 Companion memory</h3>
            <label className="row" style={{ gap: 6, fontSize: 13, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={memoryEnabled}
                onChange={toggleMemory}
              />
              {memoryEnabled ? 'Enabled' : 'Off'}
            </label>
          </div>
          <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
            Optional. When on, you can save a few notes (like <em>"presentation today"</em>) the
            Companion can refer to in this and future sessions. Stored privately to your account.
            Turning memory off wipes everything — no questions asked.
          </p>

          {memoryEnabled && (
            <>
              <form className="row" style={{ gap: 8, flexWrap: 'wrap' }} onSubmit={saveMemory}>
                <input
                  placeholder="Topic — e.g. presentation today"
                  value={memoryTopic}
                  onChange={(e) => setMemoryTopic(e.target.value)}
                  maxLength={120}
                  style={{ flex: '1 1 220px', minWidth: 0 }}
                />
                <input
                  placeholder="Optional note"
                  value={memoryNote}
                  onChange={(e) => setMemoryNote(e.target.value)}
                  maxLength={400}
                  style={{ flex: '2 1 280px', minWidth: 0 }}
                />
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={memBusy || !memoryTopic.trim()}
                >
                  {memBusy ? '…' : 'Remember'}
                </button>
              </form>

              <div className="stack mt-3">
                {memories.length === 0 ? (
                  <div className="muted" style={{ fontSize: 13 }}>
                    No memories saved yet. Add one above.
                  </div>
                ) : (
                  memories.map((m) => (
                    <div
                      key={m.id}
                      className="row between"
                      style={{
                        padding: 10,
                        border: '1px solid var(--border)',
                        borderRadius: 8,
                        gap: 10,
                        flexWrap: 'wrap',
                      }}
                    >
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontWeight: 600 }}>{m.topic}</div>
                        {m.note && (
                          <div className="muted" style={{ fontSize: 13 }}>{m.note}</div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="row mt-3" style={{ justifyContent: 'flex-end' }}>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={async () => {
                    if (!confirm('Wipe all saved memories? This cannot be undone.')) return;
                    await wipeCompanionMemory();
                    setMemoryEnabled(false);
                  }}
                >
                  Wipe everything
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {error && (
        <div className="pill pill-danger" style={{ marginBottom: 12 }}>
          {error}
        </div>
      )}

      <div className="muted" style={{ fontSize: 12, padding: '0 8px' }}>
        AI Companion is not a therapist. For diagnoses, medication, or ongoing therapy please consult
        a licensed professional. In a crisis, dial Tele-MANAS at 14416 (24×7, 20 languages) or
        Vandrevala (+91 1860-2662-345).
      </div>

      {showCrisis && <CrisisModal onClose={() => setShowCrisis(false)} />}
      {confirmReset && (
        <ConfirmModal
          title="Clear this conversation?"
          body="Your chat history with the Companion lives only on this device — once cleared it can't be recovered."
          confirmLabel="Clear chat"
          confirmVariant="danger"
          onConfirm={doReset}
          onCancel={() => setConfirmReset(false)}
        />
      )}
    </div>
  );
}

// Lightweight, on-brand confirmation modal — replaces native confirm()
// which is ugly, focus-trapping-broken, and inaccessible.
function ConfirmModal({ title, body, confirmLabel, confirmVariant, onConfirm, onCancel }) {
  useEscapeKey(onCancel);
  return (
    <div className="modal-back" onClick={onCancel} role="dialog" aria-modal="true">
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
        <h3 style={{ marginTop: 0 }}>{title}</h3>
        {body && <p className="muted">{body}</p>}
        <div className="row" style={{ gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
          <button className="btn btn-ghost" onClick={onCancel} autoFocus>
            Cancel
          </button>
          <button className={`btn btn-${confirmVariant || 'primary'}`} onClick={onConfirm}>
            {confirmLabel || 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}

function CompanionMessage({ msg }) {
  // Show crisis helplines inline whenever the model's reply or user's message
  // contains a high-severity signal (belt-and-braces — the system prompt also
  // handles this server-side).
  const flag = detectCrisisSignals(msg.text);
  return (
    <div className={`msg ${msg.role === 'user' ? 'me' : 'them'} ${msg.isError ? 'msg-crisis-medium' : ''}`}>
      <div style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</div>
      {flag.severity === 'high' && msg.role !== 'user' && (
        <InlineHelplines />
      )}
    </div>
  );
}

function InlineHelplines() {
  const lines = getHelplines();
  return (
    <div
      className="mt-2"
      style={{
        background: 'rgba(255, 255, 255, 0.85)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: 10,
        fontSize: 12,
        color: 'var(--text)',
      }}
    >
      <strong>Free, confidential helplines:</strong>
      <ul style={{ margin: '4px 0 0 18px', padding: 0 }}>
        {lines.slice(0, 3).map((h) => (
          <li key={h.tel}>
            {h.name}: <a href={`tel:${h.tel.replace(/\s/g, '')}`}>{h.tel}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function NotConfigured() {
  return (
    <div>
      <div className="page-h">
        <div>
          <h1>AI Companion</h1>
          <p>The AI listener isn't enabled on this deployment.</p>
        </div>
      </div>
      <div className="card">
        <h3>Setup needed</h3>
        <p className="muted">
          To enable the AI Companion on this site, an admin needs to configure a Gemini API key.
        </p>
        <ol style={{ lineHeight: 1.8 }}>
          <li>
            Get a free key from{' '}
            <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">
              aistudio.google.com/apikey
            </a>
          </li>
          <li>
            Add it to <code>.env</code> as{' '}
            <code>VITE_GEMINI_API_KEY=your-key-here</code>
          </li>
          <li>
            Rebuild & redeploy: <code>npm run build &amp;&amp; firebase deploy --only hosting</code>
          </li>
          <li>
            Lock the key to your domain in Google Cloud → Credentials so it can't be abused.
          </li>
        </ol>
      </div>
    </div>
  );
}
