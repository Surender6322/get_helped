import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import {
  watchChatsFor,
  watchMessages,
  sendMessage,
  getUser,
} from '../services/api.js';

export default function Chat() {
  const { user } = useAuth();
  const { chatId } = useParams();
  const navigate = useNavigate();
  const [chats, setChats] = useState([]);
  const [partners, setPartners] = useState({});
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => watchChatsFor(user.uid, setChats), [user.uid]);

  useEffect(() => {
    if (!chatId) return;
    return watchMessages(chatId, setMessages);
  }, [chatId]);

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
  }, [messages]);

  const activeChat = chats.find((c) => c.id === chatId) || null;
  const partnerUid = activeChat
    ? user.role === 'user'
      ? activeChat.helperUid
      : activeChat.userUid
    : null;
  const partner = partnerUid ? partners[partnerUid] : null;

  const showAnonForUser = activeChat?.anonymous && user.role === 'helper';

  const onSend = async (e) => {
    e.preventDefault();
    const t = text.trim();
    if (!t || !chatId) return;
    setSending(true);
    setText('');
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
                <span className="pill pill-info">private</span>
              </div>

              <div className="chat-msgs" ref={scrollRef}>
                {messages.length === 0 && (
                  <div className="empty">
                    {user.role === 'user'
                      ? 'Say hi — your helper is here to listen, no judgement.'
                      : 'Greet your user warmly. Listening is more important than fixing.'}
                  </div>
                )}
                {messages.map((m) => (
                  <div key={m.id} className={`msg ${m.from === user.uid ? 'me' : 'them'}`}>
                    {m.text}
                    <span className="ts">{new Date(m.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                ))}
              </div>

              <form className="chat-input" onSubmit={onSend}>
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
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
    </div>
  );
}
