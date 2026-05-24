import { useId } from 'react';

/**
 * On-brand loading indicator: a soft heart with a subtle "heartbeat" pulse,
 * a sweeping shine, and a row of three calming dots underneath.
 *
 * Props:
 *  - size  : number   — heart diameter in px (default 56).
 *  - label : string   — text below the heart (default "Loading…").
 *  - inline: boolean  — if true, no full-block padding (drop into headers).
 */
export default function HeartLoader({ size = 56, label = 'Loading…', inline = false }) {
  // useId() guarantees the SVG <linearGradient> id is unique even if
  // multiple HeartLoaders mount at the same time (e.g. nested suspense
  // boundaries) — otherwise duplicate ids would resolve to the first
  // gradient and break the others.
  const reactId = useId();
  const gradId = `gh-heart-grad-${reactId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const shineId = `gh-heart-shine-${reactId.replace(/[^a-zA-Z0-9_-]/g, '')}`;

  return (
    <div className={inline ? 'heart-loader heart-loader--inline' : 'heart-loader'}>
      <div className="heart-loader__heart" style={{ width: size, height: size }}>
        <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true">
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#7BA7E1" />
              <stop offset="100%" stopColor="#5B7FDE" />
            </linearGradient>
            <linearGradient id={shineId} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
              <stop offset="50%" stopColor="#ffffff" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            className="heart-loader__path"
            d="M32 54s-20-12-20-27a11 11 0 0120-7.6A11 11 0 0152 27c0 15-20 27-20 27z"
            fill={`url(#${gradId})`}
          />
          <path
            className="heart-loader__shine"
            d="M32 54s-20-12-20-27a11 11 0 0120-7.6A11 11 0 0152 27c0 15-20 27-20 27z"
            fill={`url(#${shineId})`}
          />
        </svg>
      </div>
      {label !== null && (
        <>
          <div className="heart-loader__dots" aria-hidden="true">
            <span /><span /><span />
          </div>
          {label && <div className="heart-loader__label">{label}</div>}
        </>
      )}
    </div>
  );
}
