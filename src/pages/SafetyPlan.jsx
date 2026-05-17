// Crisis Safety Plan — based on Stanley & Brown's Safety Planning
// Intervention. A guided 6-step form whose data is private to the user.

import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { saveSafetyPlan, getSafetyPlan, getHelplines } from '../services/api.js';

const STEPS = [
  {
    key: 'warning_signs',
    title: '1. Warning signs',
    help: 'Thoughts, feelings, situations or behaviours that mean a crisis may be developing for you.',
    placeholder: 'e.g. Trouble sleeping, isolating from friends, feeling hopeless…',
  },
  {
    key: 'coping_strategies',
    title: '2. Internal coping strategies',
    help: "Things you can do on your own to take your mind off the crisis — without contacting another person.",
    placeholder: 'e.g. Walk for 15 minutes, listen to a calming playlist, take a hot shower…',
  },
  {
    key: 'distractions',
    title: '3. People & places that distract you',
    help: 'Friends or social settings (not for support, just distraction) that help you take a break.',
    placeholder: 'e.g. Cafe near hostel, my cousin Aman, a movie marathon…',
  },
  {
    key: 'support_people',
    title: '4. People I can ask for support',
    help: "Trusted people you can reach out to. Add a name plus how to contact them.",
    placeholder: 'e.g. Mom (+91 ...), Best friend Riya (Instagram), my aunt who lives nearby…',
  },
  {
    key: 'professionals',
    title: '5. Professionals & helplines',
    help: 'Doctors, therapists or 24×7 helplines you trust. We added the helplines below — feel free to add your own.',
    placeholder: 'e.g. Dr. Kapoor — Apollo, +91 ...',
  },
  {
    key: 'safety_environment',
    title: '6. Making my environment safer',
    help: "Steps to limit access to anything you might use to harm yourself.",
    placeholder: 'e.g. Give my medicines to my flatmate, lock kitchen drawer key with hostel warden…',
  },
];

export default function SafetyPlan() {
  const { user } = useAuth();
  const [plan, setPlan] = useState({});
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const helplines = getHelplines();

  useEffect(() => {
    let mounted = true;
    (async () => {
      const p = await getSafetyPlan(user.uid);
      if (mounted) {
        setPlan(p || {});
        setLoaded(true);
      }
    })();
    return () => { mounted = false; };
  }, [user.uid]);

  const onChange = (key, value) => {
    setPlan((p) => ({ ...p, [key]: value }));
    setSaved(false);
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await saveSafetyPlan({ uid: user.uid, plan });
      setSaved(true);
    } finally {
      setBusy(false);
    }
  };

  if (!loaded) return <div className="loader">Loading your plan…</div>;

  const filledSteps = STEPS.filter((s) => (plan[s.key] || '').trim()).length;

  return (
    <div>
      <div className="page-h">
        <div>
          <h1>Safety plan</h1>
          <p>
            A personal "in case of emergency" map you build for yourself. Private to you,
            never shared. Print it or keep it open on your phone.
          </p>
        </div>
        <span className="pill pill-info">
          {filledSteps} / {STEPS.length} steps filled
        </span>
      </div>

      <div className="card mb-4" style={{ background: 'var(--primary-50)' }}>
        <strong>Why a safety plan?</strong>{' '}
        <span className="muted" style={{ fontSize: 14 }}>
          Crises rarely give a clear warning. Having steps written down — when you're calm — makes
          it much easier to find your way out when you're not.
        </span>
      </div>

      <form onSubmit={submit} className="stack">
        {STEPS.map((s) => (
          <div key={s.key} className="card">
            <h3 style={{ margin: '0 0 4px' }}>{s.title}</h3>
            <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>{s.help}</p>
            <textarea
              rows={4}
              value={plan[s.key] || ''}
              onChange={(e) => onChange(s.key, e.target.value)}
              placeholder={s.placeholder}
            />
            {s.key === 'professionals' && (
              <div className="mt-3" style={{ background: 'var(--bg)', padding: 10, borderRadius: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                  Trusted helplines (always free, always available):
                </div>
                {helplines.map((h) => (
                  <div key={h.tel} className="row between" style={{ fontSize: 13 }}>
                    <span>{h.name}</span>
                    <a href={`tel:${h.tel.replace(/\s/g, '')}`}>{h.tel}</a>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        <div className="card row between" style={{ position: 'sticky', bottom: 0 }}>
          <span className="muted" style={{ fontSize: 13 }}>
            {saved ? '✓ Saved. Your plan is ready when you need it.' : 'Saved entirely on your account — no one else can read this page.'}
          </span>
          <div className="row" style={{ gap: 8 }}>
            <button type="button" className="btn btn-ghost" onClick={() => window.print()}>
              Print
            </button>
            <button className="btn btn-primary" disabled={busy}>
              {busy ? 'Saving…' : 'Save plan'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
