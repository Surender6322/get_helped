// Anonymous "Wall of Support" — community feed where users post short
// vents or wins; others react with hearts and short replies. Identities
// are never shown — every post and reply appears anonymous (uid is stored
// only for moderation / preventing self-hearting).

import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import {
  watchWallPosts,
  createWallPost,
  toggleHeartWallPost,
  watchWallReplies,
  addWallReply,
} from '../services/api.js';
import { detectCrisisSignals } from '../utils/crisisDetection.js';
import { useEscapeKey } from '../hooks/useEscapeKey.js';

const KIND_LABEL = { vent: 'Vent', win: 'Win', question: 'Question' };

export default function Wall() {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [body, setBody] = useState('');
  const [kind, setKind] = useState('vent');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  // Soft-pause flow: first click on Submit shows a "take a breath" pane;
  // second click actually posts. Reduces regret-deletes (Headspace Ebb
  // research) and gives high-emotion users a 2-second cooling step.
  const [confirmPost, setConfirmPost] = useState(false);
  const confirmTimer = useRef(null);

  useEffect(() => watchWallPosts(setPosts), []);
  useEffect(() => () => clearTimeout(confirmTimer.current), []);

  const requestPost = (e) => {
    e.preventDefault();
    setErr('');
    const t = body.trim();
    if (!t) return;
    if (t.length > 1000) {
      setErr('Posts are limited to 1000 characters.');
      return;
    }
    // Two-step. The first step just opens the gentle "are you sure?" pane.
    setConfirmPost(true);
    // Auto-collapse after 30s of no decision so the pane doesn't haunt the user.
    clearTimeout(confirmTimer.current);
    confirmTimer.current = setTimeout(() => setConfirmPost(false), 30000);
  };

  const reallyPost = async () => {
    setBusy(true);
    setConfirmPost(false);
    try {
      await createWallPost({ uid: user.uid, body: body.trim(), kind });
      setBody('');
    } catch (e2) {
      setErr(e2.message || 'Could not post.');
    } finally {
      setBusy(false);
    }
  };

  // Late-night microcopy: between 22:00 and 05:00 local time, an empty
  // wall feels lonely. Replace the empty state with something gentler.
  const isLateNight = useMemo(() => {
    const h = new Date().getHours();
    return h >= 22 || h < 5;
  }, []);

  return (
    <div>
      <div className="page-h">
        <div>
          <h1>Wall of Support</h1>
          <p>Anonymous space for vents, small wins, and gentle words. Be kind.</p>
        </div>
      </div>

      <form onSubmit={requestPost} className="card mb-4">
        <div className="card-h">
          <h3>Share something</h3>
          <span className="pill pill-info">posted anonymously</span>
        </div>
        <div className="row mb-3" style={{ gap: 8, flexWrap: 'wrap' }}>
          {Object.entries(KIND_LABEL).map(([k, l]) => (
            <button
              type="button"
              key={k}
              className={`mood-chip ${kind === k ? 'active' : ''}`}
              onClick={() => setKind(k)}
            >
              {l}
            </button>
          ))}
        </div>
        <textarea
          rows={3}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={
            kind === 'vent'
              ? "What's weighing on you today?"
              : kind === 'win'
                ? "Share a small win — anything counts."
                : 'Ask the community a gentle question.'
          }
          maxLength={1000}
        />
        <div className="row between mt-2">
          <span className="muted" style={{ fontSize: 12 }}>{body.length}/1000</span>
          {err && <span className="pill pill-danger">{err}</span>}
          <button className="btn btn-primary" disabled={busy || !body.trim()}>
            {busy ? 'Posting…' : 'Post anonymously'}
          </button>
        </div>
      </form>

      <div className="stack">
        {posts.length === 0 && (
          <div className="card empty">
            {isLateNight
              ? "Late nights can be hard. Someone is always reading the Wall, even now — yours could be the first whisper into the dark."
              : "No posts yet — yours could be the first."}
          </div>
        )}
        {posts.map((p) => (
          <Post key={p.id} post={p} myUid={user.uid} />
        ))}
      </div>

      {confirmPost && (
        <SoftPauseModal
          onCancel={() => setConfirmPost(false)}
          onConfirm={reallyPost}
        />
      )}
    </div>
  );
}

// 2-second "take a breath" pause before a Wall post goes public.
// We don't actually enforce a delay (that feels punitive); the pause
// is the modal itself. Headspace Ebb research showed regret-deletion
// rates drop materially with a single intentional pause step.
function SoftPauseModal({ onConfirm, onCancel }) {
  useEscapeKey(onCancel);
  return (
    <div className="modal-back" onClick={onCancel} role="dialog" aria-modal="true">
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 460 }}
      >
        <h3 style={{ marginTop: 0 }}>Take a breath ☁️</h3>
        <p className="muted" style={{ marginTop: 4 }}>
          Once posted, your message goes to the Wall right away. Identities are anonymous — but the
          words stay until you delete them. Still want to share?
        </p>
        <div
          className="row"
          style={{ gap: 8, justifyContent: 'flex-end', marginTop: 12, flexWrap: 'wrap' }}
        >
          <button className="btn btn-ghost" onClick={onCancel} autoFocus>
            Hold on, let me re-read
          </button>
          <button className="btn btn-primary" onClick={onConfirm}>
            Post it anyway
          </button>
        </div>
      </div>
    </div>
  );
}

function Post({ post, myUid }) {
  const [replies, setReplies] = useState([]);
  const [showReplies, setShowReplies] = useState(false);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!showReplies) return;
    return watchWallReplies(post.id, setReplies);
  }, [post.id, showReplies]);

  const isMine = post.uid === myUid;
  const hearted = (post.heartUids || []).includes(myUid);
  const flag = useMemo(() => detectCrisisSignals(post.body), [post.body]);

  const onHeart = async () => {
    if (isMine) return; // no self-hearting
    await toggleHeartWallPost({ postId: post.id, uid: myUid });
  };

  const onReply = async (e) => {
    e.preventDefault();
    const t = reply.trim();
    if (!t) return;
    setBusy(true);
    try {
      await addWallReply({ postId: post.id, uid: myUid, body: t });
      setReply('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`card ${flag.severity === 'high' ? 'wall-card-flagged' : ''}`}>
      <div className="row between mb-2">
        <span className={`pill ${post.kind === 'win' ? 'pill-success' : post.kind === 'question' ? 'pill-info' : 'pill-warn'}`}>
          {KIND_LABEL[post.kind] || 'post'}
        </span>
        <span className="muted" style={{ fontSize: 12 }}>{timeAgo(post.ts)}</span>
      </div>
      {flag.severity === 'high' && (
        <div
          className="pill pill-danger"
          style={{ marginBottom: 10, fontSize: 12 }}
        >
          ⚠️ This post mentions self-harm. If that's you reading this — please consider opening
          the Emergency banner above. You matter.
        </div>
      )}
      <div style={{ whiteSpace: 'pre-wrap', fontSize: 15, lineHeight: 1.5 }}>
        {post.body}
      </div>

      <div className="row between mt-3">
        <div className="row" style={{ gap: 8 }}>
          <button
            className={`btn btn-sm ${hearted ? 'btn-accent' : 'btn-ghost'}`}
            onClick={onHeart}
            disabled={isMine}
            title={isMine ? "You can't react to your own post" : 'Send a heart'}
          >
            {hearted ? '💚' : '🤍'} {post.hearts || 0}
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setShowReplies((s) => !s)}
          >
            💬 {showReplies ? 'Hide replies' : 'Reply'}
          </button>
        </div>
        {isMine && <span className="pill" style={{ fontSize: 11 }}>your post</span>}
      </div>

      {showReplies && (
        <div className="mt-3" style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          {replies.length === 0 && (
            <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>
              Be the first to reply with kind words.
            </div>
          )}
          {replies.map((r) => (
            <div
              key={r.id}
              style={{
                padding: '8px 10px',
                background: 'var(--bg)',
                borderRadius: 8,
                marginBottom: 6,
                fontSize: 14,
              }}
            >
              <span className="muted" style={{ fontSize: 11, marginRight: 8 }}>
                anonymous · {timeAgo(r.ts)}
              </span>
              <span style={{ whiteSpace: 'pre-wrap' }}>{r.body}</span>
            </div>
          ))}
          <form onSubmit={onReply} className="row mt-2" style={{ gap: 6 }}>
            <input
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Reply with kindness…"
              maxLength={500}
            />
            <button className="btn btn-primary btn-sm" disabled={busy || !reply.trim()}>
              Send
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function timeAgo(ts) {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
