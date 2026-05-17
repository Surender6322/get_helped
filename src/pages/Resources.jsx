import { useEffect, useState } from 'react';
import { listResources } from '../services/api.js';

export default function Resources() {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('all');
  const [open, setOpen] = useState(null);

  useEffect(() => {
    (async () => setItems(await listResources()))();
  }, []);

  const filtered = filter === 'all' ? items : items.filter((r) => r.kind === filter);

  return (
    <div>
      <div className="page-h">
        <div>
          <h1>Resource library</h1>
          <p>Self-help articles, breathing techniques, and grounding exercises.</p>
        </div>
        <div className="row">
          <button className={`mood-chip ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>All</button>
          <button className={`mood-chip ${filter === 'article' ? 'active' : ''}`} onClick={() => setFilter('article')}>Articles</button>
          <button className={`mood-chip ${filter === 'exercise' ? 'active' : ''}`} onClick={() => setFilter('exercise')}>Exercises</button>
        </div>
      </div>

      <div className="grid grid-2">
        {filtered.map((r) => (
          <div key={r.id} className="card" onClick={() => setOpen(r)} style={{ cursor: 'pointer' }}>
            <div className="row between">
              <span className={`pill ${r.kind === 'exercise' ? 'pill-success' : 'pill-info'}`}>{r.kind}</span>
            </div>
            <div style={{ fontWeight: 700, fontSize: 16, marginTop: 8 }}>{r.title}</div>
            <div className="muted mt-2" style={{ fontSize: 14 }}>{r.summary}</div>
          </div>
        ))}
      </div>

      {open && (
        <div className="modal-back" onClick={() => setOpen(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <button className="close" onClick={() => setOpen(null)} aria-label="Close">×</button>
            <span className={`pill ${open.kind === 'exercise' ? 'pill-success' : 'pill-info'}`}>{open.kind}</span>
            <h3 style={{ marginTop: 10 }}>{open.title}</h3>
            <p className="muted">{open.summary}</p>
            <p style={{ whiteSpace: 'pre-wrap' }}>{open.body}</p>
          </div>
        </div>
      )}
    </div>
  );
}
