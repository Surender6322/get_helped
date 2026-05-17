import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import {
  watchChatsFor,
  watchMessages,
  sendMessage,
  getUser,
  setTyping,
  watchTyping,
} from '../services/api.js';
import { detectCrisisSignals } from '../utils/crisisDetection.js';
import { markChatRead } from '../utils/unread.js';
import { getHelplines, rateHelper } from '../services/api.js';

export default function Chat() {
  const { user } = useAuth();
  const { chatId } = useParams();
  const navigate = useNavigate();
  const [chats, setChats] = useState([]);
  const [partners, setPartners] = useState({});
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [typingUids, setTypingUids] = useState([]);
  const [showCrisisHelp, setShowCrisisHelp] = useState(false);
  const [showRating, setShowRating] = useState(false);
  const scrollRef = useRef(null);
  const typingTimerRef = useRef(null);

  useEffect(() => watchChatsFor(user.uid, setChats), [user.uid]);

  useEffect(() => {
    if (!chatId) return;
    return watchMessages(chatId, setMessages);
  }, [chatId]);

  // Mark this chat as read whenever new messages arrive while it's open.
  useEffect(() => {
    if (!chatId || messages.length === 0) return;
    const last = messages[messages.length - 1];
    markChatRead(user.uid, chatId, last.ts);
  }, [chatId, messages, user.uid]);

  // Watch the partner's typing state.
  useEffect(() => {
    if (!chatId) {
      setTypingUids([]);
      return;
    }
    return watchTyping({ chatId, exceptUid: user.uid }, setTypingUids);
  }, [chatId, user.uid]);

  // Clear our own typing flag when leaving a chat or unmounting.
  useEffect(() => {
    return () => {
      if (chatId) setTyping({ chatId, uid: user.uid, typing: false }).catch(() => {});
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    };
  }, [chatId, user.uid]);

  useEffect(() => {
    (async () => {
      const map = { ...partners };
      for (const c of chats) {
        const otherUid = user.role === 'user' ? c.helperUid : c.userUid;
        if (!map[otherUid]) {
          const u = await getUser(otherUid);
          map[otherUid] = u || { displayName: 'Unknown' };
        }
      }
      setPartners(map);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chats]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, typingUids.length]);

  const activeChat = chats.find((c) => c.id === chatId) || null;
  const partnerUid = activeChat
    ? user.role === 'user'
      ? activeChat.helperUid
      : activeChat.userUid
    : null;
  const partner = partnerUid ? partners[partnerUid] : null;

  const showAnonForUser = activeChat?.anonymous && user.role === 'helper';

  // Crisis check on the input as the user types (only meaningful for users,
  // but we run for both to be safe — helpers might paste a message into the
  // input by mistake).
  const liveSignals = useMemo(() => detectCrisisSignals(text), [text]);

  const onChangeText = (e) => {
    const next = e.target.value;
    setText(next);
    if (!chatId) return;

    // Send typing presence (debounced — the server-side staleness window is
    // 6s, so refreshing every 3s while typing is plenty).
    if (next.trim()) {
      setTyping({ chatId, uid: user.uid, typing: true }).catch(() => {});
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => {
        setTyping({ chatId, uid: user.uid, typing: false }).catch(() => {});
      }, 5000);
    } else {
      setTyping({ chatId, uid: user.uid, typing: false }).catch(() => {});
    }
  };

  const onSend = async (e) => {
    e.preventDefault();
    const t = text.trim();
    if (!t || !chatId) return;
    setSending(true);
    setText('');
    setTyping({ chatId, uid: user.uid, typing: false }).catch(() => {});
    try {
      await sendMessage({ chatId, from: user.uid, text: t });
    } finally {
      setSending(false);
    }
  };

  const baseRoute = user.role === 'helper' ? '/helper/chat' : '/app/chat';

  return (
    <div>
      <div className="page-h">
        <div>
          <h1>Conversations</h1>
          <p>Messages are delivered in real time and stored privately.</p>
        </div>
      </div>

      <div className="chat-shell">
        <div className="chat-list">
          {chats.length === 0 && (
            <div className="empty">
              No conversations yet.
              {user.role === 'user' && (
                <>
                  <br />
                  <button className="btn btn-primary btn-sm mt-2" onClick={() => navigate('/app/helpers')}>
                    Find a helper
                  </button>
                </>
              )}
            </div>
          )}
          {chats.map((c) => {
            const otherUid = user.role === 'user' ? c.helperUid : c.userUid;
            const other = partners[otherUid];
            const display =
              c.anonymous && user.role === 'helper'
                ? 'Anonymous user'
                : other?.displayName || 'Loading…';
            return (
              <div
                key={c.id}
                className={`chat-list-item ${c.id === chatId ? 'active' : ''}`}
                onClick={() => navigate(`${baseRoute}/${c.id}`)}
              >
                <div className="name">{display}</div>
                <div className="preview">{c.lastMessage || 'New conversation'}</div>
              </div>
            );
          })}
        </div>

        <div className="chat-pane">
          {!activeChat ? (
            <div className="empty">Select a conversation from the list to start chatting.</div>
          ) : (
            <>
              <div className="chat-header">
                <div>
                  <div className="name">
                    {showAnonForUser ? 'Anonymous user' : partner?.displayName || '…'}
                  </div>
                  <div className="meta">
                    {activeChat.anonymous ? 'Anonymous conversation · ' : ''}
                    Started {new Date(activeChat.createdAt).toLocaleString()}
                  </div>
                </div>
                <div className="row" style={{ gap: 8 }}>
                  {user.role === 'user' && (
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => setShowRating(true)}
                      title="Rate this helper anonymously"
                    >
                      ★ Rate helper
                    </button>
                  )}
                  <span className="pill pill-info">private</span>
                </div>
              </div>

              <div className="chat-msgs" ref={scrollRef}>
                {messages.length === 0 && (
                  <div className="empty">
                    {user.role === 'user'
                      ? 'Say hi — your helper is here to listen, no judgement.'
                      : 'Greet your user warmly. Listening is more important than fixing.'}
                  </div>
                )}
                {messages.map((m) => {
                  const incoming = m.from !== user.uid;
                  // Only flag *incoming* messages on the helper side — we
                  // don't want to label a user's own message as "crisis".
                  const flag =
                    incoming && user.role === 'helper'
                      ? detectCrisisSignals(m.text)
                      : { severity: 'none' };
                  const cls = `msg ${m.from === user.uid ? 'me' : 'them'} ${
                    flag.severity === 'high'
                      ? 'msg-crisis-high'
                      : flag.severity === 'medium'
                        ? 'msg-crisis-medium'
                        : ''
                  }`;
                  return (
                    <div key={m.id} className={cls}>
                      {flag.severity === 'high' && (
                        <span className="msg-crisis-pill">⚠️ Crisis signal</span>
                      )}
                      {flag.severity === 'medium' && (
                        <span className="msg-crisis-pill msg-crisis-pill-medium">⚠ Distress</span>
                      )}
                      {m.text}
                      <span className="ts">
                        {new Date(m.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  );
                })}
                {typingUids.length > 0 && (
                  <div className="msg them typing-bubble" aria-live="polite">
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                  </div>
                )}
              </div>

              {/* Soft crisis prompt for users typing high-severity content. */}
              {user.role === 'user' && liveSignals.severity === 'high' && (
                <div className="crisis-prompt">
                  <div>
                    <strong>It sounds like you might be in a really hard place right now.</strong>{' '}
                    Please consider reaching out to a trained crisis counsellor — they're free and
                    available 24×7.
                  </div>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    onClick={() => setShowCrisisHelp(true)}
                  >
                    Get help now
                  </button>
                </div>
              )}

              <form className="chat-input" onSubmit={onSend}>
                <input
                  value={text}
                  onChange={onChangeText}
                  placeholder="Type a message…"
                  autoFocus
                />
                <button className="btn btn-primary" disabled={sending || !text.trim()}>
                  Send
                </button>
              </form>
            </>
          )}
        </div>
      </div>

      {showCrisisHelp && <CrisisHelpModal onClose={() => setShowCrisisHelp(false)} />}
      {showRating && partnerUid && (
        <RatingModal
          helperUid={partnerUid}
          fromUid={user.uid}
          chatId={chatId}
          partnerName={partner?.displayName || 'helper'}
          onClose={() => setShowRating(false)}
        />
      )}
    </div>
  );
}

function RatingModal({ helperUid, fromUid, chatId, partnerName, onClose }) {
  const [stars, setStars] = useState(0);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (stars < 1) return;
    setBusy(true);
    try {
      await rateHelper({ helperUid, fromUid, chatId, stars, note });
      setDone(true);
      setTimeout(onClose, 1200);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="close" onClick={onClose} aria-label="Close">×</button>
        <h3>Rate your conversation</h3>
        <p className="muted" style={{ fontSize: 14 }}>
          {partnerName} won't see your name — your feedback is anonymous and helps the platform.
        </p>
        <form onSubmit={submit} className="stack mt-3">
          <div className="row" style={{ gap: 4, fontSize: 30 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                type="button"
                key={n}
                onClick={() => setStars(n)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
                aria-label={`${n} stars`}
              >
                {n <= stars ? '★' : '☆'}
              </button>
            ))}
          </div>
          <textarea
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional note about what helped (or didn't)…"
          />
          <div className="row between">
            <span>{done && <span className="pill pill-success">Thanks for the feedback ❤️</span>}</span>
            <button className="btn btn-primary" disabled={busy || stars < 1 || done}>
              {busy ? 'Sending…' : 'Submit rating'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CrisisHelpModal({ onClose }) {
  const helplines = getHelplines();
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="close" onClick={onClose} aria-label="Close">×</button>
        <h3>You are not alone.</h3>
        <p className="muted">
          What you're feeling matters. If you're in immediate danger, please call your local
          emergency services. The numbers below are free, confidential, and staffed by trained
          counsellors.
        </p>
        <div className="stack mt-3">
          {helplines.map((h) => (
            <div
              key={h.tel}
              className="row between"
              style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 10 }}
            >
              <div>
                <div style={{ fontWeight: 600 }}>{h.name}</div>
                {h.hours && <div className="muted" style={{ fontSize: 12 }}>{h.hours}</div>}
              </div>
              <a className="btn btn-danger btn-sm" href={`tel:${h.tel.replace(/\s/g, '')}`}>
                Call {h.tel}
              </a>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
