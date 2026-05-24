// AI Companion page — always-available empathetic chat. Conversations are
// kept in localStorage on the device only (never sent to Firestore) so the
// user has maximum privacy. They can clear history at any time.

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { chatWithCompanion, isCompanionConfigured } from '../services/gemini.js';
import { detectCrisisSignals } from '../utils/crisisDetection.js';
import { getHelplines } from '../services/api.js';

const KEY_PREFIX = 'gethelped_companion_';
const MAX_HISTORY = 30; // last N messages used for context

const SUGGESTIONS = [
  "I've had a rough day, can we just talk?",
  "I keep overthinking everything. Help me untangle this.",
  "Help me wind down before bed.",
  "I'm anxious about an exam tomorrow.",
];

const GREETING = {
  role: 'assistant',
  text:
    "Hi, I'm here. This is a private space — anything you say stays between us. " +
    "What's on your mind right now?",
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

    const userMsg = { role: 'user', text: t, ts: Date.now() };
    const next = [...history, userMsg];
    setHistory(next);
    setText('');
    setBusy(true);

    try {
      const recent = next.slice(-MAX_HISTORY);
      const reply = await chatWithCompanion({
        history: recent.slice(0, -1), // exclude the just-added message
        message: t,
      });
      setHistory((cur) => [
        ...cur,
        { role: 'assistant', text: reply, ts: Date.now() },
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

  const reset = () => {
    if (!confirm('Clear this conversation? This cannot be undone.')) return;
    setHistory([GREETING]);
  };

  return (
    <div className="page-fill">
      <div className="page-h">
        <div>
          <h1>AI Companion</h1>
          <p>
            Always-on, gentle listener. For tough moments, reach out to a{' '}
            <strong>real human helper</strong> from "Find a Helper".
          </p>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <span className="pill pill-info">private to this device</span>
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

      {error && (
        <div className="pill pill-danger" style={{ marginBottom: 12 }}>
          {error}
        </div>
      )}

      <div className="muted" style={{ fontSize: 12, padding: '0 8px' }}>
        AI Companion is not a therapist. For diagnoses, medication, or ongoing therapy please consult
        a licensed professional. In a crisis, call iCall (+91 9152987821) or Vandrevala (+91 1860-2662-345).
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
