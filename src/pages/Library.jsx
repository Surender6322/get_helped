// Library — helper-authored articles & exercises with admin approval
// and per-user likes.
//
//   Users  : browse approved posts and like the ones that resonate.
//   Helpers: compose new posts, see their own (any status), like
//            other helpers' approved posts.
//   Admins : also see the pending-review queue with approve / reject.

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import {
  watchApprovedLibrary,
  watchPendingLibrary,
  watchMyLibrary,
  createLibraryPost,
  updateLibraryPost,
  deleteLibraryPost,
  approveLibraryPost,
  rejectLibraryPost,
  toggleLibraryLike,
} from '../services/api.js';
import { formatShortDateTime } from '../utils/date.js';
import { TEAM_LIBRARY } from '../data/teamLibrary.js';

const KINDS = [
  { key: 'article',  label: 'Article',  emoji: '📰', helper: 'A short read on a topic that helps people cope.' },
  { key: 'exercise', label: 'Exercise', emoji: '🧘', helper: 'A guided practice — breathing, journaling, grounding.' },
];

export default function Library() {
  const { user } = useAuth();
  const isHelper = user.role === 'helper';
  const isAdmin = user.role === 'admin';
  const isUser = user.role === 'user';

  const [approved, setApproved] = useState([]);
  const [pending, setPending] = useState([]);
  const [mine, setMine] = useState([]);
  const [filterKind, setFilterKind] = useState('all');
  const [composing, setComposing] = useState(false);
  const [editingDraft, setEditingDraft] = useState(null);

  useEffect(() => watchApprovedLibrary(setApproved), []);
  useEffect(() => {
    if (isAdmin) return watchPendingLibrary(setPending);
  }, [isAdmin]);
  useEffect(() => {
    if (isHelper) return watchMyLibrary(user.uid, setMine);
  }, [isHelper, user.uid]);

  // Merge curated team-authored content (ships with the bundle, always
  // available, can't be edited) with helper-submitted approved posts.
  // Team posts go after newly approved community ones so the latter
  // get visibility, but team content is always present.
  const allApproved = useMemo(() => [...approved, ...TEAM_LIBRARY], [approved]);

  const visibleApproved = useMemo(() => {
    if (filterKind === 'all') return allApproved;
    return allApproved.filter((p) => p.kind === filterKind);
  }, [allApproved, filterKind]);

  const onLike = async (post) => {
    const liked = Array.isArray(post.likeUids) && post.likeUids.includes(user.uid);
    await toggleLibraryLike(post.id, user.uid, liked);
  };

  const onApprove = (post) => approveLibraryPost(post.id, user.uid);
  const onReject = (post) => {
    if (!confirm('Reject this submission? The author can rework and re-submit it.')) return;
    return rejectLibraryPost(post.id);
  };
  const onDelete = (post) => {
    if (!confirm('Delete this post? This cannot be undone.')) return;
    return deleteLibraryPost(post.id);
  };

  return (
    <div>
      <div className="page-h">
        <div>
          <h1>Library</h1>
          <p>
            {isUser && 'A growing collection of articles and exercises written by our verified helpers.'}
            {isHelper && 'Share what you’ve learned. Posts you submit go to the admin team for review before going live.'}
            {isAdmin && 'Review submissions, then approve to publish them to all users.'}
          </p>
        </div>
        {(isHelper || isAdmin) && user.verified !== false && isHelper && (
          <button className="btn btn-primary" onClick={() => { setComposing(true); setEditingDraft(null); }}>
            + New post
          </button>
        )}
      </div>

      {composing && (
        <Composer
          authorUid={user.uid}
          authorName={user.displayName || 'Helper'}
          existing={editingDraft}
          onClose={() => { setComposing(false); setEditingDraft(null); }}
        />
      )}

      {isAdmin && (
        <div className="card mb-4">
          <div className="card-h">
            <h3>Pending review</h3>
            <span className="pill pill-warn">{pending.length}</span>
          </div>
          {pending.length === 0 ? (
            <div className="empty">Nothing waiting. Helpers will appear here when they submit new posts.</div>
          ) : (
            <div className="stack">
              {pending.map((p) => (
                <PostCard
                  key={p.id}
                  post={p}
                  expandable
                  actions={
                    <>
                      <button className="btn btn-primary btn-sm" onClick={() => onApprove(p)}>Approve</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => onReject(p)}>Reject</button>
                    </>
                  }
                />
              ))}
            </div>
          )}
        </div>
      )}

      {isHelper && (
        <div className="card mb-4">
          <div className="card-h">
            <h3>Your posts</h3>
            <span className="pill pill-info">{mine.length}</span>
          </div>
          {mine.length === 0 ? (
            <div className="empty">You haven't published anything yet. Tap "New post" to start.</div>
          ) : (
            <div className="stack">
              {mine.map((p) => (
                <PostCard
                  key={p.id}
                  post={p}
                  expandable
                  showStatus
                  actions={
                    <>
                      {p.status !== 'approved' && (
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => { setEditingDraft(p); setComposing(true); }}
                        >
                          Edit
                        </button>
                      )}
                      <button className="btn btn-ghost btn-sm" onClick={() => onDelete(p)}>
                        Delete
                      </button>
                    </>
                  }
                />
              ))}
            </div>
          )}
        </div>
      )}

      <div className="card">
        <div className="card-h">
          <h3>{isUser ? 'Browse the library' : 'Live library'}</h3>
          <div className="row" style={{ gap: 6 }}>
            <FilterChip label="All" active={filterKind === 'all'} onClick={() => setFilterKind('all')} />
            {KINDS.map((k) => (
              <FilterChip
                key={k.key}
                label={`${k.emoji} ${k.label}`}
                active={filterKind === k.key}
                onClick={() => setFilterKind(k.key)}
              />
            ))}
          </div>
        </div>

        {visibleApproved.length === 0 ? (
          <div className="empty">
            Nothing here yet — helpers haven't submitted any{' '}
            {filterKind === 'all' ? 'posts' : KINDS.find((k) => k.key === filterKind)?.label.toLowerCase()} yet.
          </div>
        ) : (
          <div className="stack">
            {visibleApproved.map((p) => {
              const liked = Array.isArray(p.likeUids) && p.likeUids.includes(user.uid);
              return (
                <PostCard
                  key={p.id}
                  post={p}
                  expandable
                  team={p.__team}
                  actions={
                    p.__team ? (
                      <span
                        className="pill pill-info"
                        title="Curated by the GetHelped team — always available."
                      >
                        ✦ curated
                      </span>
                    ) : (
                      <button
                        className={`btn btn-sm ${liked ? 'btn-accent' : 'btn-ghost'}`}
                        onClick={() => onLike(p)}
                        aria-pressed={liked}
                        title={liked ? 'Unlike' : 'Like'}
                      >
                        {liked ? '♥' : '♡'} {p.likes || 0}
                      </button>
                    )
                  }
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function FilterChip({ label, active, onClick }) {
  return (
    <button className={`mood-chip ${active ? 'active' : ''}`} onClick={onClick}>
      {label}
    </button>
  );
}

function PostCard({ post, actions, expandable, showStatus, team }) {
  const [expanded, setExpanded] = useState(false);
  const kind = KINDS.find((k) => k.key === post.kind) || KINDS[0];
  const dateLabel = team
    ? null
    : formatShortDateTime(post.approvedAt || post.createdAt) || '—';
  return (
    <article className="library-card">
      <header className="library-card__head">
        <span className="library-kind" aria-hidden="true">{kind.emoji}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="library-title">{post.title}</div>
          <div className="muted" style={{ fontSize: 12 }}>
            By {post.authorName || 'Helper'}
            {dateLabel && <> · {dateLabel}</>}
            {showStatus && (
              <>
                {' · '}
                <span
                  className={`pill pill-${post.status === 'approved' ? 'success' : post.status === 'rejected' ? 'danger' : 'warn'}`}
                  style={{ fontSize: 10 }}
                >
                  {post.status}
                </span>
              </>
            )}
          </div>
        </div>
        <div className="row" style={{ gap: 6, flexShrink: 0 }}>{actions}</div>
      </header>
      <div className={`library-body ${expanded ? 'is-expanded' : ''}`}>
        {post.body}
      </div>
      {expandable && post.body.length > 280 && (
        <button
          className="btn btn-ghost btn-sm library-toggle"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? 'Show less' : 'Read more'}
        </button>
      )}
    </article>
  );
}

function Composer({ authorUid, authorName, existing, onClose }) {
  const [kind, setKind] = useState(existing?.kind || 'article');
  const [title, setTitle] = useState(existing?.title || '');
  const [body, setBody] = useState(existing?.body || '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    if (title.trim().length < 4) { setErr('Title is too short.'); return; }
    if (body.trim().length < 30) { setErr('Body should be at least a couple of sentences.'); return; }
    if (body.length > 10000)     { setErr('Body is too long (max 10,000 characters).'); return; }
    setBusy(true);
    try {
      if (existing) {
        await updateLibraryPost(existing.id, {
          kind, title: title.trim(), body: body.trim(),
          // Re-submit if the author edits a previously rejected post.
          status: existing.status === 'rejected' ? 'submitted' : existing.status,
        });
      } else {
        await createLibraryPost({
          authorUid, authorName, kind, title: title.trim(), body: body.trim(),
        });
      }
      onClose();
    } catch (e2) {
      setErr(e2.message || 'Could not save the post.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card mb-4">
      <div className="card-h">
        <h3>{existing ? 'Edit post' : 'New post'}</h3>
        <button className="btn btn-ghost btn-sm" onClick={onClose} disabled={busy}>Cancel</button>
      </div>
      <form onSubmit={submit}>
        <div className="role-pick role-pick--rich" style={{ marginBottom: 14 }}>
          {KINDS.map((k) => (
            <button
              key={k.key}
              type="button"
              className={kind === k.key ? 'active' : ''}
              onClick={() => setKind(k.key)}
            >
              <span className="role-emoji" aria-hidden="true">{k.emoji}</span>
              <span className="role-title">{k.label}</span>
              <span className="role-sub">{k.helper}</span>
            </button>
          ))}
        </div>
        <div className="form-row">
          <label>Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={kind === 'article' ? 'e.g. Coping with exam anxiety' : 'e.g. 4-7-8 breathing for sleep'}
            maxLength={200}
            required
          />
        </div>
        <div className="form-row">
          <label>Body
            <span className="form-hint">
              Plain text. Aim for clarity and warmth — write to one person, not a crowd.
            </span>
          </label>
          <textarea
            rows={10}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={10000}
          />
          <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
            {body.length} / 10,000
          </div>
        </div>
        {err && <div className="form-error" role="alert">{err}</div>}
        <button className="btn btn-primary" disabled={busy}>
          {busy
            ? 'Saving…'
            : existing
              ? 'Save changes'
              : 'Submit for review'}
        </button>
        <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
          {existing && existing.status === 'approved'
            ? 'Edits to an approved post are saved but stay live.'
            : 'An admin will review this before it appears in the public library.'}
        </p>
      </form>
    </div>
  );
}
