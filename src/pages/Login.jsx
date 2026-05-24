import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      const u = await login({ email: email.trim(), password });
      const dest = u.role === 'admin' ? '/admin' : u.role === 'helper' ? '/helper' : '/app';
      navigate(dest);
    } catch (e2) {
      setErr(humanize(e2.message) || 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-wrap">
      <section className="auth-hero">
        <div style={{ maxWidth: 540 }}>
          <span className="pill pill-info" style={{ marginBottom: 14 }}>GetHelped</span>
          <h1>Welcome back.</h1>
          <p>Pick up where you left off — your conversations are private and secure.</p>
        </div>
      </section>
      <section className="auth-pane">
        <form className="auth-card" onSubmit={submit} noValidate>
          <h2>Sign in</h2>
          <p className="sub">Use your registered email and password.</p>

          <div className="form-row">
            <label htmlFor="login-email">Email</label>
            <input
              id="login-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
            />
          </div>

          <div className="form-row">
            <label htmlFor="login-pwd">Password</label>
            <div className="pwd-wrap">
              <input
                id="login-pwd"
                type={showPwd ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
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
          </div>

          {err && (
            <div className="form-error" role="alert">
              {err}
            </div>
          )}

          <button className="btn btn-primary btn-block" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>

          <p className="switch">
            New here? <Link to="/register">Create an account</Link>
          </p>
        </form>
      </section>
    </div>
  );
}

function humanize(msg) {
  if (!msg) return msg;
  const m = msg.toLowerCase();
  if (m.includes('user-not-found') || m.includes('invalid-credential') || m.includes('wrong-password')) {
    return "We couldn't sign you in with those details. Please check and try again.";
  }
  if (m.includes('invalid-email')) return "That doesn't look like a valid email address.";
  if (m.includes('too-many-requests')) return 'Too many attempts. Please wait a minute and try again.';
  if (m.includes('network')) return 'Network problem. Check your connection and try again.';
  return msg;
}
