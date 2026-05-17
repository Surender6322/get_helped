// 30-day mood trend as a pure SVG line chart. No chart library.
//
// Mood encoding (high = better):
//   great=5, good=4, okay=3, down=2, awful=1

const SCORE = { great: 5, good: 4, okay: 3, down: 2, awful: 1 };
const EMOJI = { 5: '😄', 4: '🙂', 3: '😐', 2: '😔', 1: '😢' };

const W = 640;
const H = 220;
const PAD = { top: 20, right: 16, bottom: 28, left: 36 };
const DAYS = 30;

function startOfDay(ts) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export default function MoodChart({ entries }) {
  // Build a 30-day window: bucket entries by day, take avg mood per day.
  const today = startOfDay(Date.now());
  const dayMs = 24 * 60 * 60 * 1000;
  const buckets = Array.from({ length: DAYS }, (_, i) => ({
    ts: today - (DAYS - 1 - i) * dayMs,
    sum: 0,
    n: 0,
  }));
  for (const e of entries || []) {
    const t = startOfDay(e.ts);
    const idx = DAYS - 1 - Math.floor((today - t) / dayMs);
    if (idx < 0 || idx >= DAYS) continue;
    const v = SCORE[e.mood];
    if (!v) continue;
    buckets[idx].sum += v;
    buckets[idx].n += 1;
  }
  const points = buckets.map((b, i) => ({
    i,
    ts: b.ts,
    value: b.n > 0 ? b.sum / b.n : null,
  }));

  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const x = (i) => PAD.left + (i / (DAYS - 1)) * innerW;
  const y = (v) => PAD.top + innerH - ((v - 1) / 4) * innerH;

  const valued = points.filter((p) => p.value != null);
  const path = valued
    .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${x(p.i).toFixed(1)} ${y(p.value).toFixed(1)}`)
    .join(' ');

  const avg = valued.length ? valued.reduce((s, p) => s + p.value, 0) / valued.length : 0;
  const trendUp = valued.length > 4
    ? valued.slice(-3).reduce((s, p) => s + p.value, 0) / 3 >
      valued.slice(0, 3).reduce((s, p) => s + p.value, 0) / 3
    : null;

  return (
    <div>
      <div className="row between mb-3">
        <div>
          <div className="muted" style={{ fontSize: 12 }}>30-day average</div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>
            {avg ? avg.toFixed(1) : '—'} {avg ? `· ${labelFor(Math.round(avg))}` : ''}
          </div>
        </div>
        <div>
          <div className="muted" style={{ fontSize: 12 }}>Recent trend</div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>
            {trendUp == null ? '—' : trendUp ? '📈 lifting' : '📉 dipping'}
          </div>
        </div>
        <div>
          <div className="muted" style={{ fontSize: 12 }}>Logged days</div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{valued.length} / {DAYS}</div>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={H}
        role="img"
        aria-label="30-day mood trend chart"
        style={{ maxWidth: '100%' }}
      >
        {/* Y gridlines + emoji labels */}
        {[5, 4, 3, 2, 1].map((v) => (
          <g key={v}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(v)}
              y2={y(v)}
              stroke="var(--border)"
              strokeDasharray={v === 3 ? '0' : '2 4'}
              strokeWidth="1"
            />
            <text
              x={PAD.left - 8}
              y={y(v) + 4}
              fontSize="14"
              textAnchor="end"
              fill="var(--text-muted)"
            >
              {EMOJI[v]}
            </text>
          </g>
        ))}

        {/* X axis labels: day-0, day-15, day-29 */}
        {[0, 7, 14, 21, 29].map((i) => (
          <text
            key={i}
            x={x(i)}
            y={H - 8}
            fontSize="10"
            textAnchor="middle"
            fill="var(--text-muted)"
          >
            {new Date(buckets[i].ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </text>
        ))}

        {/* Path */}
        {path && (
          <path
            d={path}
            fill="none"
            stroke="var(--primary)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Points */}
        {valued.map((p) => (
          <g key={p.i}>
            <circle cx={x(p.i)} cy={y(p.value)} r={3.5} fill="var(--primary)" />
            <title>
              {new Date(p.ts).toLocaleDateString()}: {p.value.toFixed(1)} {labelFor(Math.round(p.value))}
            </title>
          </g>
        ))}

        {/* Empty state */}
        {valued.length === 0 && (
          <text
            x={W / 2}
            y={H / 2}
            fontSize="13"
            textAnchor="middle"
            fill="var(--text-muted)"
          >
            Log a few moods to see your 30-day trend.
          </text>
        )}
      </svg>
    </div>
  );
}

function labelFor(n) {
  return ({ 5: 'Great', 4: 'Good', 3: 'Okay', 2: 'Down', 1: 'Awful' })[n] || '';
}
