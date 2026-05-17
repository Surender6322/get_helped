import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Register() {
  const { register } = useAuth();
  const [role, setRole] = useState('user');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [credentials, setCredentials] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const navigate = useNavigate();

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
    } catch (e) {
      setErr(e.message || 'Registration failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-wrap">
      <section className="auth-hero">
        <div style={{ maxWidth: 540 }}>
          <span className="pill pill-info" style={{ marginBottom: 14 }}>GetHelped</span>
          <h1>Join GetHelped.</h1>
          <p>
            Create a free account as a <strong>User</strong> seeking support, or sign up as a{' '}
            <strong>Helper</strong> — psychology students and volunteers offering peer
            support. Helpers go through a verification step before going live.
          </p>
        </div>
      </section>
      <section className="auth-pane">
        <form className="auth-card" onSubmit={submit}>
          <h2>Create account</h2>
          <p className="sub">Pick the role that fits you best.</p>

          <div className="role-pick">
            <button type="button" className={role === 'user' ? 'active' : ''} onClick={() => setRole('user')}>
              I need support
            </button>
            <button type="button" className={role === 'helper' ? 'active' : ''} onClick={() => setRole('helper')}>
              I want to help
            </button>
          </div>

          <div className="form-row">
            <label>Display name {role === 'user' ? '(can be a nickname)' : ''}</label>
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder={role === 'user' ? 'e.g. Riya, Skyflower, …' : 'e.g. Aarav Sharma'} />
          </div>
          <div className="form-row">
            <label>Email</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="form-row">
            <label>Password</label>
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" />
          </div>
          {role === 'helper' && (
            <div className="form-row">
              <label>Credentials (will be reviewed by admin)</label>
              <textarea
                rows={3}
                value={credentials}
                onChange={(e) => setCredentials(e.target.value)}
                placeholder="e.g. M.A. Psychology, 2nd year, Delhi University. Volunteer at iCall."
              />
            </div>
          )}

          {err && (
            <div className="pill pill-danger" style={{ marginBottom: 10 }}>
              {err}
            </div>
          )}

          <button className="btn btn-primary btn-block" disabled={busy}>
            {busy ? 'Creating…' : 'Create account'}
          </button>
          <div className="switch">
            Already have an account? <Link to="/login">Sign in</Link>
          </div>
        </form>
      </section>
    </div>
  );
}
