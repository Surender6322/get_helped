import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import {
  createHelperWallPost,
  watchHelperWallPosts,
  deleteHelperWallPost,
} from '../services/api.js';

// "Supervision" wall — visible only to verified helpers and admins.
// (Enforced by firestore.rules: read = isVerifiedHelper() || isAdmin())
//
// Why this exists: holding emotional weight for strangers — especially
// strangers in crisis — burns helpers out fast. The right pattern in
// peer-support work is *clinical supervision*: a structured space to
// reflect on tough sessions, ask other helpers for guidance, and keep
// each other anchored. We can't offer 1-on-1 supervision in v1, but we
// can give helpers a quiet, helpers-only room.

const KINDS = [
  { key: 'reflection', label: 'Reflection', emoji: '🪞' },
  { key: 'question', label: 'Question', emoji: '🤔' },
  { key: 'win', label: 'Small win', emoji: '🌱' },
  { key: 'heavy', label: 'Heavy session', emoji: '💧' },
];

export default function HelperSupervision() {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [body, setBody] = useState('');
  const [kind, setKind] = useState('reflection');
  const [busy, setBusy] = useState(false);

  useEffect(() => watchHelperWallPosts(setPosts), []);

  const submit = async (e) => {
    e.preventDefault();
    const t = body.trim();
    if (!t) return;
    setBusy(true);
    try {
      await createHelperWallPost({
        uid: user.uid,
        displayName: user.displayName,
        body: t,
        kind,
      });
      setBody('');
    } finally {
      setBusy(false);
    }
  };

  const filtered = useMemo(() => posts.slice(0, 50), [posts]);

  return (
    <div>
      <div className="page-h">
        <div>
          <h1>Helper space</h1>
          <p>
            A private room for helpers and admins. Reflect on tough sessions,
            ask each other for guidance, share small wins. Users never see
            this.
          </p>
        </div>
        <span className="pill pill-info">{posts.length} posts</span>
      </div>

      <div className="card mb-3">
        <form onSubmit={submit}>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
            {KINDS.map((k) => (
              <button
                key={k.key}
                type="button"
                className={`btn btn-sm ${kind === k.key ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setKind(k.key)}
              >
                {k.emoji} {k.label}
              </button>
            ))}
          </div>
          <textarea
            rows={3}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Share a reflection, a question, or a moment from a session. Stay general — no user-identifying details."
            maxLength={1500}
          />
          <div className="row between mt-2">
            <span className="muted" style={{ fontSize: 12 }}>{body.length}/1500</span>
            <button className="btn btn-primary" disabled={busy || !body.trim()}>
              {busy ? 'Posting…' : 'Share with helpers'}
            </button>
          </div>
        </form>
      </div>

      <div className="stack">
        {filtered.length === 0 ? (
          <div className="empty">
            Nothing here yet. Be the first to share — even a single line counts.
          </div>
        ) : (
          filtered.map((p) => (
            <PostCard
              key={p.id}
              post={p}
              canDelete={p.uid === user.uid || user.role === 'admin'}
              onDelete={() => deleteHelperWallPost(p.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function PostCard({ post, canDelete, onDelete }) {
  const k = KINDS.find((x) => x.key === post.kind) || KINDS[0];
  return (
    <div className="card">
      <div className="row between mb-2">
        <span style={{ fontSize: 14, fontWeight: 600 }}>
          {k.emoji} {post.displayName}
        </span>
        <span className="muted" style={{ fontSize: 12 }}>
          {post.ts ? new Date(post.ts).toLocaleString() : ''}
          {canDelete && (
            <button
              className="btn btn-ghost btn-sm"
              style={{ marginLeft: 8 }}
              onClick={() => {
                if (confirm('Delete this post?')) onDelete();
              }}
            >
              Delete
            </button>
          )}
        </span>
      </div>
      <div style={{ whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.5 }}>
        {post.body}
      </div>
    </div>
  );
}
