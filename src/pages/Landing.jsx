import { Link } from 'react-router-dom';
import { isDemo } from '../services/api.js';

export default function Landing() {
  return (
    <div className="auth-wrap">
      <section className="auth-hero">
        <div style={{ maxWidth: 540 }}>
          <span className="pill pill-info" style={{ marginBottom: 14 }}>GetHelped</span>
          <h1>Mental health support, when you need it most.</h1>
          <p>
            A safe, anonymous space where students and individuals can talk in real time
            with trained psychology helpers. No judgment, no waitlists — just someone to listen.
          </p>
          <div className="row mt-4" style={{ flexWrap: 'wrap' }}>
            <Link to="/register" className="btn btn-primary">Get started</Link>
            <Link to="/login" className="btn btn-ghost">I already have an account</Link>
          </div>

          <div className="grid grid-3 mt-4">
            <Feature title="Real-time chat" desc="Connect instantly with available helpers." />
            <Feature title="Stay anonymous" desc="Talk without sharing your identity." />
            <Feature title="Verified helpers" desc="Every helper is reviewed and approved." />
          </div>

          {isDemo && (
            <div
              className="mt-4"
              style={{
                background: '#fff',
                border: '1px solid var(--border)',
                borderRadius: 12,
                padding: 14,
                fontSize: 13,
              }}
            >
              <strong>Demo mode is on.</strong> Try these accounts:
              <ul style={{ margin: '8px 0 0 18px', padding: 0 }}>
                <li><code>riya@gethelped.app</code> / <code>user123</code> (User)</li>
                <li><code>aarav@gethelped.app</code> / <code>helper123</code> (Helper, verified)</li>
                <li><code>meera@gethelped.app</code> / <code>helper123</code> (Helper, pending)</li>
                <li><code>admin@gethelped.app</code> / <code>admin123</code> (Admin)</li>
              </ul>
            </div>
          )}
        </div>
      </section>
      <section className="auth-pane">
        <div className="auth-card">
          <h2>Welcome</h2>
          <p className="sub">
            GetHelped connects help seekers with trained psychology students &
            volunteers in a safe, real-time environment.
          </p>
          <Link to="/register" className="btn btn-primary btn-block">Create your free account</Link>
          <Link to="/login" className="btn btn-ghost btn-block" style={{ marginTop: 10 }}>Sign in</Link>
          <p className="switch">Confidential · Free for users · Built with React + Firebase</p>
        </div>
      </section>
    </div>
  );
}

function Feature({ title, desc }) {
  return (
    <div className="card" style={{ padding: 14 }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{title}</div>
      <div className="muted" style={{ fontSize: 13 }}>{desc}</div>
    </div>
  );
}
