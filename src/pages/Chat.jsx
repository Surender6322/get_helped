import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import {
  watchChatsFor,
  watchMessages,
  sendMessage,
  watchUser,
  setTyping,
  watchTyping,
} from '../services/api.js';
import { detectCrisisSignals } from '../utils/crisisDetection.js';
import { markChatRead } from '../utils/unread.js';
import { formatShortDateTime } from '../utils/date.js';
import { rateHelper } from '../services/api.js';
import { fetchPartnerCached, setCachedPartner } from '../utils/partnerCache.js';
import { CrisisModal } from '../components/EmergencyButton.jsx';
import { useEscapeKey } from '../hooks/useEscapeKey.js';

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
  const [filter, setFilter] = useState('');
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

  // Build the de-duplicated list of partner UIDs we need a name for. We
  // join on the *string* of UIDs so this memo only changes when the set
  // actually changes (new chat created / removed) — not on every chat-doc
  // update (lastMessage bump, etc.). That's what was causing 100×
  // resubscribe storms previously.
  const partnerUids = useMemo(() => {
    const set = new Set();
    for (const c of chats) {
      const u = user.role === 'user' ? c.helperUid : c.userUid;
      if (u) set.add(u);
    }
    return Array.from(set);
  }, [chats, user.role]);
  const partnerUidsKey = partnerUids.join('|');

  // One-shot, cached fetch of each partner's display name for the list.
  // Cached values hydrate synchronously; uncached uids fetch in PARALLEL
  // (not sequentially). Names are essentially static, so we don't open
  // a realtime listener for every list item — that's reserved for the
  // currently-active partner below.
  useEffect(() => {
    if (partnerUids.length === 0) return;
    let cancelled = false;
    Promise.all(partnerUids.map(fetchPartnerCached)).then((results) => {
      if (cancelled) return;
      const patch = {};
      partnerUids.forEach((uid, i) => { patch[uid] = results[i]; });
      setPartners((prev) => ({ ...prev, ...patch }));
    });
    return () => { cancelled = true; };
  }, [partnerUidsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, typingUids.length]);

  // O(1) lookup of the active chat — `chats.find()` on every render
  // would scan all 100 chats per re-render otherwise.
  const chatsById = useMemo(() => {
    const m = {};
    for (const c of chats) m[c.id] = c;
    return m;
  }, [chats]);
  const activeChat = chatId ? chatsById[chatId] || null : null;

  const partnerUid = activeChat
    ? user.role === 'user'
      ? activeChat.helperUid
      : activeChat.userUid
    : null;

  // Live-watch ONLY the currently-open partner so presence updates
  // (available / lastAvailableAt) push to the chat header in real time.
  // The list view doesn't need this, just the open chat.
  useEffect(() => {
    if (!partnerUid) return;
    return watchUser(partnerUid, (u) => {
      const value = u || { displayName: 'Unknown' };
      setCachedPartner(partnerUid, value);
      setPartners((prev) => ({ ...prev, [partnerUid]: value }));
    });
  }, [partnerUid]);

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

  // Stable callback so memoized ChatListItem rows don't all re-render
  // every time some unrelated state in this component changes.
  const onSelectChat = useCallback(
    (id) => navigate(`${baseRoute}/${id}`),
    [navigate, baseRoute],
  );

  // Decorate chats with their resolved display name and apply the
  // search filter. Memoized on (chats, partners, filter, user.role)
  // so 100-row maps don't re-walk on every keystroke elsewhere.
  const visibleChats = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const decorated = chats.map((c) => {
      const otherUid = user.role === 'user' ? c.helperUid : c.userUid;
      const other = partners[otherUid];
      const display =
        c.anonymous && user.role === 'helper'
          ? 'Anonymous user'
          : other?.displayName || '…';
      return { ...c, __display: display };
    });
    if (!q) return decorated;
    return decorated.filter(
      (c) =>
        c.__display.toLowerCase().includes(q) ||
        (c.lastMessage || '').toLowerCase().includes(q),
    );
  }, [chats, partners, filter, user.role]);

  return (
    <div className="page-fill">
      <div className="page-h">
        <div>
          <h1>Conversations</h1>
          <p>Messages are delivered in real time and stored privately.</p>
        </div>
      </div>

      <div className="chat-shell">
        <div className="chat-list">
          {chats.length > 4 && (
            <div className="chat-list-search">
              <input
                type="search"
                placeholder="Search by name or message…"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                aria-label="Search conversations"
              />
            </div>
          )}
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
          {visibleChats.map((c) => (
            <ChatListItem
              key={c.id}
              chatId={c.id}
              isActive={c.id === chatId}
              displayName={c.__display}
              preview={c.lastMessage || 'New conversation'}
              onSelect={onSelectChat}
            />
          ))}
          {visibleChats.length === 0 && chats.length > 0 && filter && (
            <div className="empty">No conversations match "{filter}".</div>
          )}
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
                    {user.role === 'user'
                      ? renderHelperPresence(partner)
                      : `Started ${formatShortDateTime(activeChat.createdAt) || '—'}`}
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
                  <div className="empty">{getChatOpener(user.role, chatId)}</div>
                )}
                {messages.map((m) => (
                  <MessageBubble
                    key={m.id}
                    msg={m}
                    isMine={m.from === user.uid}
                    flagOnHelperSide={user.role === 'helper'}
                  />
                ))}
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
          chatId={chatId}
          partnerName={partner?.displayName || 'helper'}
          onClose={() => setShowRating(false)}
        />
      )}
    </div>
  );
}

function RatingModal({ helperUid, chatId, partnerName, onClose }) {
  const [stars, setStars] = useState(0);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState('');
  useEscapeKey(onClose);

  const submit = async (e) => {
    e.preventDefault();
    if (stars < 1) return;
    setBusy(true);
    setErr('');
    try {
      await rateHelper({ helperUid, chatId, stars, note });
      setDone(true);
      setTimeout(onClose, 1200);
    } catch (e2) {
      setErr(e2?.message || 'Could not submit rating.');
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
            <span>
              {done && <span className="pill pill-success">Thanks for the feedback ❤️</span>}
              {err && <span className="pill pill-danger">{err}</span>}
            </span>
            <button className="btn btn-primary" disabled={busy || stars < 1 || done}>
              {busy ? 'Sending…' : 'Submit rating'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const MessageBubble = memo(function MessageBubble({ msg, isMine, flagOnHelperSide }) {
  // Only flag *incoming* messages on the helper side — we don't want to
  // label a user's own message as "crisis".
  const flag =
    !isMine && flagOnHelperSide
      ? detectCrisisSignals(msg.text)
      : { severity: 'none' };
  const cls = `msg ${isMine ? 'me' : 'them'} ${
    flag.severity === 'high'
      ? 'msg-crisis-high'
      : flag.severity === 'medium'
        ? 'msg-crisis-medium'
        : ''
  }`;
  return (
    <div className={cls}>
      {flag.severity === 'high' && (
        <span className="msg-crisis-pill">⚠️ Crisis signal</span>
      )}
      {flag.severity === 'medium' && (
        <span className="msg-crisis-pill msg-crisis-pill-medium">⚠ Distress</span>
      )}
      {msg.text}
      <span className="ts">
        {new Date(msg.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </span>
    </div>
  );
});

const ChatListItem = memo(function ChatListItem({
  chatId,
  isActive,
  displayName,
  preview,
  onSelect,
}) {
  return (
    <div
      className={`chat-list-item ${isActive ? 'active' : ''}`}
      onClick={() => onSelect(chatId)}
    >
      <div className="name">{displayName}</div>
      <div className="preview">{preview}</div>
    </div>
  );
});

function renderHelperPresence(partner) {
  if (!partner) return '…';
  if (partner.available) {
    return (
      <span style={{ color: 'var(--accent-600)', fontWeight: 600 }}>
        ● Available
      </span>
    );
  }
  const last = formatShortDateTime(partner.lastAvailableAt);
  return last ? `Last available ${last}` : 'Currently away';
}

// Rotating, empathetic opener prompts. We pick a deterministic-but-varied
// option based on the chat ID so the same chat always greets you the
// same way (no jarring change on refresh), but different chats feel
// different. Mixes EN + Hinglish — the predominant register for young
// Indian users — so neither feels foreign.
const USER_OPENERS = [
  "It can be hard to start. Even \"I'm not sure where to begin\" is a perfect first message.",
  "Take your time — your helper is here, no judgement, no rush.",
  "Shuru karne ki tension mat lo — bas jo dimaag mein hai, woh likh do.",
  "You don't have to explain everything. A single sentence is enough to begin.",
  "Whatever you share stays just between you two. You set the pace.",
];
const HELPER_OPENERS = [
  'Greet your user warmly. Listening is more important than fixing.',
  'A small "Hey, I\'m here whenever you\'re ready" goes a long way.',
  'No script needed. Match their energy and just be present.',
];
function getChatOpener(role, chatId) {
  const arr = role === 'user' ? USER_OPENERS : HELPER_OPENERS;
  if (!chatId) return arr[0];
  let h = 0;
  for (let i = 0; i < chatId.length; i++) h = (h * 31 + chatId.charCodeAt(i)) >>> 0;
  return arr[h % arr.length];
}

function CrisisHelpModal({ onClose }) {
  return (
    <CrisisModal
      onClose={onClose}
      title="You are not alone."
      lead="What you're feeling matters. If you're in immediate danger, please call your local emergency services. The numbers below are free, confidential, and staffed by trained counsellors."
    />
  );
}
