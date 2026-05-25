import { useState } from 'react';
import { getHelplines } from '../services/api.js';
import { useEscapeKey } from '../hooks/useEscapeKey.js';

export default function EmergencyButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="emergency-banner mb-4">
        <span>
          <strong>In crisis or having thoughts of self-harm?</strong>{' '}
          You are not alone — help is one tap away.
        </span>
        <button className="btn btn-danger btn-sm" onClick={() => setOpen(true)}>
          Get Emergency Help
        </button>
      </div>

      {open && <CrisisModal onClose={() => setOpen(false)} />}
    </>
  );
}

// Crisis modal — INTENTIONALLY does NOT close on backdrop click.
// In acute distress, accidental taps should not dismiss the lifeline.
// The user must tap an explicit "I'm safer for now" button or press Esc.
//
// Source: Forasoft 2026 mental-health-app guidance — "surface a
// non-dismissible interstitial" — and Common Sense Media's Wysa review,
// which flagged easy-to-dismiss crisis screens as "unacceptable".
export function CrisisModal({ onClose, title, lead }) {
  useEscapeKey(onClose);
  const helplines = getHelplines();

  return (
    <div
      className="modal-back crisis-back"
      role="dialog"
      aria-modal="true"
      aria-labelledby="crisis-title"
    >
      <div className="modal crisis-modal" role="document">
        <h3 id="crisis-title" style={{ marginTop: 0 }}>
          {title || 'You are not alone.'}
        </h3>
        <p className="muted" style={{ marginTop: 4 }}>
          {lead ||
            'If you or someone you know is in immediate danger, please call your local emergency services. The numbers below are free, confidential, and staffed by trained counsellors.'}
        </p>

        <div className="stack mt-3">
          {helplines.map((h) => (
            <div
              key={h.tel}
              className="row between"
              style={{
                padding: 12,
                border: '1px solid var(--border)',
                borderRadius: 10,
                gap: 12,
                flexWrap: 'wrap',
              }}
            >
              <div style={{ minWidth: 0, flex: '1 1 220px' }}>
                <div style={{ fontWeight: 600 }}>{h.name}</div>
                <div className="muted" style={{ fontSize: 12 }}>
                  {h.hours}
                  {h.langs ? ` · ${h.langs}` : ''}
                </div>
                {h.alt && (
                  <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>
                    Also: {h.alt}
                  </div>
                )}
              </div>
              <a
                className="btn btn-danger btn-sm"
                href={`tel:${h.tel.replace(/\s/g, '')}`}
              >
                Call {h.tel}
              </a>
            </div>
          ))}
        </div>

        <div
          className="row mt-4"
          style={{ justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}
        >
          <button
            className="btn btn-ghost"
            onClick={onClose}
            autoFocus
          >
            I'm safer for now
          </button>
        </div>

        <p className="muted mt-3" style={{ fontSize: 12 }}>
          GetHelped is not a substitute for professional medical care or emergency services.
        </p>
      </div>
    </div>
  );
}
