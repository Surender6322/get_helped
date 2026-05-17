import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { updateProfile, changePassword } from '../services/api.js';
import { HELPER_TAGS } from '../utils/helperTags.js';

export default function Profile() {
  const { user } = useAuth();

  // ---------- profile form ----------
  const [displayName, setDisplayName] = useState(user.displayName || '');
  const [bio, setBio] = useState(user.bio || '');
  const [credentials, setCredentials] = useState(user.credentials || '');
  const [tags, setTags] = useState(user.tags || []);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileBusy, setProfileBusy] = useState(false);

  const toggleTag = (t) => {
    setTags((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));
    setProfileSaved(false);
  };

  const submitProfile = async (e) => {
    e.preventDefault();
    setProfileBusy(true);
    setProfileSaved(false);
    const patch = { displayName };
    if (user.role === 'helper') {
      patch.bio = bio;
      patch.credentials = credentials;
      patch.tags = tags;
    }
    try {
      await updateProfile(user.uid, patch);
      setProfileSaved(true);
    } finally {
      setProfileBusy(false);
    }
  };

  // ---------- password form ----------
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwSaved, setPwSaved] = useState(false);

  const submitPassword = async (e) => {
    e.preventDefault();
    setPwError('');
    setPwSaved(false);
    if (newPassword.length < 6) {
      setPwError('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError('New passwords do not match.');
      return;
    }
    if (newPassword === currentPassword) {
      setPwError('New password must be different from current password.');
      return;
    }
    setPwBusy(true);
    try {
      await changePassword({ currentPassword, newPassword });
      setPwSaved(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPwError(err.message || 'Could not update password.');
    } finally {
      setPwBusy(false);
    }
  };

  return (
    <div>
      <div className="page-h">
        <div>
          <h1>Your profile</h1>
          <p>Update how you appear in GetHelped and manage your password.</p>
        </div>
        <span className="pill pill-info">{user.role}</span>
      </div>

      <div className="stack" style={{ maxWidth: 640 }}>
        <form className="card" onSubmit={submitProfile}>
          <div className="card-h"><h3>Profile details</h3></div>
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
              <div className="form-row">
                <label>Specializations (helps users find the right helper)</label>
                <div className="mood-row" style={{ gap: 6 }}>
                  {HELPER_TAGS.map((t) => (
                    <button
                      type="button"
                      key={t.key}
                      className={`mood-chip ${tags.includes(t.key) ? 'active' : ''}`}
                      onClick={() => toggleTag(t.key)}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="row" style={{ gap: 8 }}>
                <span className="pill pill-info">verified: {String(!!user.verified)}</span>
                <span className="pill pill-info">available: {String(!!user.available)}</span>
              </div>
            </>
          )}
          <div className="row mt-3" style={{ gap: 12 }}>
            <button className="btn btn-primary" disabled={profileBusy}>
              {profileBusy ? 'Saving…' : 'Save changes'}
            </button>
            {profileSaved && <span className="pill pill-success">Saved</span>}
          </div>
        </form>

        <form className="card" onSubmit={submitPassword}>
          <div className="card-h"><h3>Change password</h3></div>
          <p className="muted" style={{ fontSize: 13, marginTop: -4 }}>
            For your security we re-verify your current password before saving the new one.
          </p>
          <div className="form-row">
            <label>Current password</label>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>
          <div className="form-row">
            <label>New password</label>
            <input
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="At least 6 characters"
            />
          </div>
          <div className="form-row">
            <label>Confirm new password</label>
            <input
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
          <div className="row mt-3" style={{ gap: 12, flexWrap: 'wrap' }}>
            <button className="btn btn-primary" disabled={pwBusy}>
              {pwBusy ? 'Updating…' : 'Update password'}
            </button>
            {pwSaved && <span className="pill pill-success">Password updated</span>}
            {pwError && <span className="pill pill-danger">{pwError}</span>}
          </div>
        </form>
      </div>
    </div>
  );
}
