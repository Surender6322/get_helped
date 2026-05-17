import { useState } from 'react';
import { getHelplines } from '../services/api.js';

export default function EmergencyButton() {
  const [open, setOpen] = useState(false);
  const helplines = getHelplines();

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

      {open && (
        <div className="modal-back" onClick={() => setOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <button className="close" onClick={() => setOpen(false)} aria-label="Close">×</button>
            <h3>You are not alone.</h3>
            <p className="muted">
              If you or someone you know is in immediate danger, please call your local
              emergency services. Below are free helplines staffed by trained counsellors.
            </p>
            <div className="stack mt-3">
              {helplines.map((h) => (
                <div
                  key={h.tel}
                  className="row between"
                  style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 10 }}
                >
                  <div>
                    <div style={{ fontWeight: 600 }}>{h.name}</div>
                    {h.hours && <div className="muted" style={{ fontSize: 12 }}>{h.hours}</div>}
                  </div>
                  <a className="btn btn-danger btn-sm" href={`tel:${h.tel.replace(/\s/g, '')}`}>
                    Call {h.tel}
                  </a>
                </div>
              ))}
            </div>
            <p className="muted mt-3" style={{ fontSize: 12 }}>
              GetHelped is not a substitute for professional medical care or emergency services.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
