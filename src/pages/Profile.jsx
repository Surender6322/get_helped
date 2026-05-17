import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { updateProfile } from '../services/api.js';

export default function Profile() {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState(user.displayName || '');
  const [bio, setBio] = useState(user.bio || '');
  const [credentials, setCredentials] = useState(user.credentials || '');
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setSaved(false);
    const patch = { displayName };
    if (user.role === 'helper') {
      patch.bio = bio;
      patch.credentials = credentials;
    }
    try {
      await updateProfile(user.uid, patch);
      setSaved(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="page-h">
        <div>
          <h1>Your profile</h1>
          <p>Update how you appear in GetHelped.</p>
        </div>
        <span className="pill pill-info">{user.role}</span>
      </div>

      <form className="card" onSubmit={submit} style={{ maxWidth: 640 }}>
        <div className="form-row">
          <label>Email</label>
          <input value={user.email} disabled />
        </div>
        <div className="form-row">
          <label>Display name</label>
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </div>
        {user.role === 'helper' && (
          <>
            <div className="form-row">
              <label>Credentials (visible to admin)</label>
              <textarea rows={3} value={credentials} onChange={(e) => setCredentials(e.target.value)} />
            </div>
            <div className="form-row">
              <label>Public bio (visible to users)</label>
              <textarea rows={3} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="A few sentences about your approach…" />
            </div>
            <div className="row" style={{ gap: 8 }}>
              <span className="pill pill-info">verified: {String(!!user.verified)}</span>
              <span className="pill pill-info">available: {String(!!user.available)}</span>
            </div>
          </>
        )}
        <div className="row mt-3" style={{ gap: 12 }}>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save changes'}
          </button>
          {saved && <span className="pill pill-success">Saved</span>}
        </div>
      </form>
    </div>
  );
}
