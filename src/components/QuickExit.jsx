import { useEffect } from 'react';
import { useLocale, t } from '../i18n/strings.js';

// "Quick exit" — a panic button used by every domestic-violence,
// queer-safety, and crisis platform on the web. If the user is being
// surveilled (abusive partner / family / hostel-mate), tapping this
// (or pressing Esc twice quickly) replaces the current tab with a
// neutral page so a glance over the shoulder doesn't reveal that the
// person was on a mental-health support site.
//
// Behaviour:
//   • Click button     → exit immediately
//   • Esc, Esc within 600 ms → exit immediately (keyboard panic)
//
// We use `location.replace` so the user's "back" button doesn't
// resurrect GetHelped. We don't try to clear localStorage or chats —
// a savvy attacker could still find evidence; this is a *cover*, not
// a forensic wipe. We tell users this on the privacy page.

const SAFE_DESTINATION = 'https://www.google.com/search?q=weather';

export default function QuickExit() {
  const { locale } = useLocale();
  useEffect(() => {
    let lastEsc = 0;
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      const now = Date.now();
      if (now - lastEsc < 600) {
        bail();
      }
      lastEsc = now;
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <button
      type="button"
      className="quick-exit-btn"
      onClick={bail}
      aria-label="Quick exit — replace this page with a neutral website. Press Escape twice quickly for the same effect."
      title="Quick exit (Esc Esc) — replaces the page with a neutral site"
    >
      <span aria-hidden="true">↗</span>
      <span className="quick-exit-btn__label">{t(locale, 'quickExit.label')}</span>
    </button>
  );
}

function bail() {
  try {
    history.replaceState(null, '', '/');
  } catch {
    // ignore
  }
  location.replace(SAFE_DESTINATION);
}
