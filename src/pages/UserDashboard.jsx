import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { watchHelpers, watchMoods, watchChatsFor, getUser } from '../services/api.js';

const moodEmoji = {
  great: '😄',
  good: '🙂',
  okay: '😐',
  down: '😔',
  awful: '😢',
};

export default function UserDashboard() {
  const { user } = useAuth();
  const [helpers, setHelpers] = useState([]);
  const [moods, setMoods] = useState([]);
  const [chats, setChats] = useState([]);
  const [helperNames, setHelperNames] = useState({});

  useEffect(
    () => watchHelpers((rows) => setHelpers(rows), { verifiedOnly: true, availableOnly: true }),
    []
  );
  useEffect(() => watchMoods(user.uid, setMoods), [user.uid]);
  useEffect(() => watchChatsFor(user.uid, setChats), [user.uid]);

  useEffect(() => {
    (async () => {
      const map = {};
      for (const c of chats) {
        if (!map[c.helperUid]) {
          const u = await getUser(c.helperUid);
          map[c.helperUid] = u?.displayName || 'Helper';
        }
      }
      setHelperNames(map);
    })();
  }, [chats]);

  const latestMood = moods[0];

  return (
    <div>
      <div className="page-h">
        <div>
          <h1>Hi, {user.displayName || 'there'} 👋</h1>
          <p>How are you feeling today?</p>
        </div>
        <Link to="/app/helpers" className="btn btn-primary">Talk to someone now</Link>
      </div>

      <div className="grid grid-3">
        <div className="card">
          <div className="card-h"><h3>Available helpers</h3><span className="pill pill-success">{helpers.length} online</span></div>
          {helpers.length === 0 ? (
            <div className="empty">No helpers available right now. Check back soon.</div>
          ) : (
            <div className="stack-sm">
              {helpers.slice(0, 3).map((h) => (
                <div key={h.uid} className="row between">
                  <div>
                    <div style={{ fontWeight: 600 }}>{h.displayName}</div>
                    <div className="muted" style={{ fontSize: 12 }}>{h.credentials}</div>
                  </div>
                  <Link to="/app/helpers" className="btn btn-ghost btn-sm">View</Link>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-h"><h3>Latest mood</h3><Link className="muted" to="/app/mood">View all</Link></div>
          {latestMood ? (
            <div className="row" style={{ gap: 16 }}>
              <div style={{ fontSize: 40 }}>{moodEmoji[latestMood.mood] || '🙂'}</div>
              <div>
                <div style={{ fontWeight: 600, textTransform: 'capitalize' }}>{latestMood.mood}</div>
                <div className="muted" style={{ fontSize: 13 }}>
                  {latestMood.note || 'No note'} · {timeAgo(latestMood.ts)}
                </div>
              </div>
            </div>
          ) : (
            <div className="empty">Log your first mood entry to start tracking how you feel over time.</div>
          )}
          <Link to="/app/mood" className="btn btn-accent btn-sm mt-3">Log mood</Link>
        </div>

        <div className="card">
          <div className="card-h"><h3>Active chats</h3><Link className="muted" to="/app/chat">Open inbox</Link></div>
          {chats.length === 0 ? (
            <div className="empty">No conversations yet. Start one from the Helpers page.</div>
          ) : (
            <div className="stack-sm">
              {chats.slice(0, 3).map((c) => (
                <Link key={c.id} to={`/app/chat/${c.id}`} className="row between" style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{helperNames[c.helperUid] || 'Helper'}</div>
                    <div className="muted" style={{ fontSize: 12 }}>{c.lastMessage || 'New conversation'}</div>
                  </div>
                  <span className="pill pill-info">open</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card mt-4">
        <div className="card-h"><h3>Quick self-help</h3><Link className="muted" to="/app/resources">Browse library</Link></div>
        <div className="grid grid-3">
          <Tip
            title="4-7-8 breathing"
            body="Inhale 4s · hold 7s · exhale 8s. Repeat 4 times to calm a racing mind."
          />
          <Tip
            title="Grounding 5-4-3-2-1"
            body="Name 5 things you see, 4 you feel, 3 you hear, 2 you smell, 1 you taste."
          />
          <Tip
            title="Reach out"
            body="A short text to someone you trust — even a meme — counts."
          />
        </div>
      </div>
    </div>
  );
}

function Tip({ title, body }) {
  return (
    <div style={{ padding: 14, border: '1px solid var(--border)', borderRadius: 10, background: '#fafbfd' }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{title}</div>
      <div className="muted" style={{ fontSize: 13 }}>{body}</div>
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
