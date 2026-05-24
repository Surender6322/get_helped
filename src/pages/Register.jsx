import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Register() {
  const { register } = useAuth();
  const [role, setRole] = useState('user');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [credentials, setCredentials] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const navigate = useNavigate();

  const pwdScore = useMemo(() => scorePassword(password), [password]);

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    if (password.length < 6) {
      setErr('Password must be at least 6 characters.');
      return;
    }
    setBusy(true);
    try {
      const u = await register({
        email: email.trim(),
        password,
        role,
        displayName: displayName.trim() || (role === 'user' ? 'Anonymous User' : 'Helper'),
        credentials: role === 'helper' ? credentials.trim() : undefined,
      });
      const dest = u.role === 'helper' ? '/helper' : '/app';
      navigate(dest);
    } catch (e2) {
      setErr(humanize(e2.message) || 'Registration failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-wrap">
      <section className="auth-hero">
        <div style={{ maxWidth: 560 }}>
          <span className="pill pill-info" style={{ marginBottom: 14 }}>GetHelped</span>
          <h1>You're not alone.</h1>
          <p>
            Take the first step. Whether you're seeking support or offering a kind ear,
            you'll find a calm, safe space here — no waitlists, no judgement.
          </p>

          <ul className="trust-list mt-4">
            <li><span className="tick">✓</span> Free for everyone seeking support</li>
            <li><span className="tick">✓</span> Stay completely anonymous if you want</li>
            <li><span className="tick">✓</span> Helpers are reviewed before going live</li>
            <li><span className="tick">✓</span> Your conversations are private &amp; encrypted in transit</li>
          </ul>
        </div>
      </section>

      <section className="auth-pane">
        <form className="auth-card auth-card--register" onSubmit={submit} noValidate>
          <h2>Create your account</h2>
          <p className="sub">It takes about 30 seconds. Pick what brings you here.</p>

          <div className="role-pick role-pick--rich">
            <button
              type="button"
              className={role === 'user' ? 'active' : ''}
              onClick={() => setRole('user')}
              aria-pressed={role === 'user'}
            >
              <span className="role-emoji" aria-hidden="true">🤍</span>
              <span className="role-title">I need support</span>
              <span className="role-sub">Talk privately to a trained helper</span>
            </button>
            <button
              type="button"
              className={role === 'helper' ? 'active' : ''}
              onClick={() => setRole('helper')}
              aria-pressed={role === 'helper'}
            >
              <span className="role-emoji" aria-hidden="true">🤝</span>
              <span className="role-title">I want to help</span>
              <span className="role-sub">Volunteer as a peer helper (verification required)</span>
            </button>
          </div>

          <div className="form-row">
            <label htmlFor="reg-name">
              Display name
              <span className="form-hint">
                {role === 'user'
                  ? "Use a nickname if you'd like — you don't have to share your real name."
                  : 'Your real name builds trust with people you support.'}
              </span>
            </label>
            <input
              id="reg-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={role === 'user' ? 'e.g. Riya, Skyflower, …' : 'e.g. Aarav Sharma'}
              autoComplete="nickname"
            />
          </div>

          <div className="form-row">
            <label htmlFor="reg-email">Email</label>
            <input
              id="reg-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
            />
          </div>

          <div className="form-row">
            <label htmlFor="reg-pwd">Password</label>
            <div className="pwd-wrap">
              <input
                id="reg-pwd"
                type={showPwd ? 'text' : 'password'}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                autoComplete="new-password"
              />
              <button
                type="button"
                className="pwd-toggle"
                onClick={() => setShowPwd((v) => !v)}
                aria-label={showPwd ? 'Hide password' : 'Show password'}
                tabIndex={-1}
              >
                {showPwd ? 'Hide' : 'Show'}
              </button>
            </div>
            {password.length > 0 && (
              <div className={`pwd-meter pwd-meter--${pwdScore.level}`}>
                <span /><span /><span /><span />
                <em>{pwdScore.label}</em>
              </div>
            )}
          </div>

          {role === 'helper' && (
            <div className="form-row">
              <label htmlFor="reg-creds">
                Credentials
                <span className="form-hint">An admin will review this before you can take chats.</span>
              </label>
              <textarea
                id="reg-creds"
                rows={3}
                value={credentials}
                onChange={(e) => setCredentials(e.target.value)}
                placeholder="e.g. M.A. Psychology, 2nd year, Delhi University. Volunteer at iCall."
              />
            </div>
          )}

          {err && (
            <div className="form-error" role="alert">
              {err}
            </div>
          )}

          <button className="btn btn-primary btn-block" disabled={busy}>
            {busy ? 'Creating your account…' : 'Create account'}
          </button>

          <p className="switch">
            Already have an account? <Link to="/login">Sign in</Link>
          </p>
          <p className="auth-footnote">
            By creating an account you agree to our community guidelines.
            We will never share your conversations.
          </p>
        </form>
      </section>
    </div>
  );
}

// Lightweight password-strength heuristic. Not a security boundary — Firebase
// Auth still enforces a 6-char minimum — this is purely a UX nudge.
function scorePassword(pwd) {
  if (!pwd) return { level: 'empty', label: '' };
  let s = 0;
  if (pwd.length >= 6) s++;
  if (pwd.length >= 10) s++;
  if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) s++;
  if (/\d/.test(pwd)) s++;
  if (/[^A-Za-z0-9]/.test(pwd)) s++;
  if (pwd.length < 6) return { level: 'too-short', label: 'Too short — 6+ characters' };
  if (s <= 2) return { level: 'weak', label: 'Weak' };
  if (s === 3) return { level: 'fair', label: 'Fair' };
  if (s === 4) return { level: 'good', label: 'Good' };
  return { level: 'strong', label: 'Strong' };
}

// Translate Firebase's terse error messages into something a non-technical
// user can act on.
function humanize(msg) {
  if (!msg) return msg;
  const m = msg.toLowerCase();
  if (m.includes('email-already-in-use')) return 'An account with this email already exists. Try signing in.';
  if (m.includes('invalid-email')) return "That doesn't look like a valid email address.";
  if (m.includes('weak-password')) return 'Please choose a stronger password (at least 6 characters).';
  if (m.includes('network')) return 'Network problem. Check your connection and try again.';
  return msg;
}
