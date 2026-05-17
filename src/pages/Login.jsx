import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
    } catch (e) {
      setErr(e.message || 'Login failed');
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
        <form className="auth-card" onSubmit={submit}>
          <h2>Sign in</h2>
          <p className="sub">Use your registered email and password.</p>
          <div className="form-row">
            <label>Email</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
          <div className="form-row">
            <label>Password</label>
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </div>
          {err && (
            <div className="pill pill-danger" style={{ marginBottom: 10 }}>
              {err}
            </div>
          )}
          <button className="btn btn-primary btn-block" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
          <div className="switch">
            New here? <Link to="/register">Create an account</Link>
          </div>
        </form>
      </section>
    </div>
  );
}
