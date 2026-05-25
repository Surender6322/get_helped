// Minimal i18n: a flat key/value lookup per locale, no library required.
//
// We intentionally stay scrappy — i18n libraries (react-intl, i18next)
// are heavyweight for a 20-string surface. If the catalog grows past
// ~150 strings, swap in i18next. For now this is enough.
//
// Usage:
//   import { t, useLocale } from '../i18n/strings.js';
//   const { locale, setLocale } = useLocale();
//   t(locale, 'auth.signIn')

import { useEffect, useState } from 'react';

const KEY = 'gethelped_locale';

export const SUPPORTED = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिन्दी' },
];

const en = {
  'common.loading': 'Loading…',
  'common.cancel': 'Cancel',
  'common.save': 'Save',
  'common.delete': 'Delete',

  'nav.dashboard': 'Dashboard',
  'nav.helpers': 'Find a Helper',
  'nav.chats': 'My Chats',
  'nav.companion': 'AI Companion',
  'nav.wall': 'Wall of Support',
  'nav.journal': 'Journal',
  'nav.mood': 'Mood Tracker',
  'nav.safety': 'Safety Plan',
  'nav.library': 'Library',
  'nav.profile': 'Profile',

  'auth.signIn': 'Sign in',
  'auth.signUp': 'Create account',
  'auth.signOut': 'Sign out',

  'crisis.title': 'You are not alone.',
  'crisis.imSafer': "I'm safer for now",

  'mood.howAreYou': 'How are you feeling right now?',
  'mood.checkin.title': "A few rough days in a row. That's a lot to carry.",
  'mood.checkin.body':
    'Nothing has to be wrong with you for it to feel this heavy. Want a low-pressure way to talk it through?',

  'wall.softpause.title': 'Take a breath',
  'wall.softpause.body':
    'Once posted, your message goes to the Wall right away. Identities are anonymous — but the words stay until you delete them. Still want to share?',
  'wall.softpause.holdOn': 'Hold on, let me re-read',
  'wall.softpause.post': 'Post it anyway',

  'quickExit.label': 'Quick exit',
};

const hi = {
  'common.loading': 'लोड हो रहा है…',
  'common.cancel': 'रद्द करें',
  'common.save': 'सेव करें',
  'common.delete': 'मिटाएँ',

  'nav.dashboard': 'डैशबोर्ड',
  'nav.helpers': 'हेल्पर खोजें',
  'nav.chats': 'मेरी चैट्स',
  'nav.companion': 'AI साथी',
  'nav.wall': 'सपोर्ट वॉल',
  'nav.journal': 'जर्नल',
  'nav.mood': 'मूड ट्रैकर',
  'nav.safety': 'सेफ्टी प्लान',
  'nav.library': 'लाइब्रेरी',
  'nav.profile': 'प्रोफ़ाइल',

  'auth.signIn': 'साइन इन',
  'auth.signUp': 'अकाउंट बनाएं',
  'auth.signOut': 'साइन आउट',

  'crisis.title': 'तुम अकेले नहीं हो।',
  'crisis.imSafer': 'मैं अभी ठीक हूँ',

  'mood.howAreYou': 'अभी कैसा महसूस हो रहा है?',
  'mood.checkin.title': 'लगातार कुछ कठिन दिन। यह संभालना आसान नहीं है।',
  'mood.checkin.body':
    'यह ज़रूरी नहीं कि तुममें कुछ "ग़लत" हो — यह बस भारी है। कम दबाव वाली बातचीत कर लें?',

  'wall.softpause.title': 'एक गहरी साँस ले लो',
  'wall.softpause.body':
    'पोस्ट करने पर तुम्हारा मैसेज सीधे वॉल पर चला जाएगा। पहचान गुप्त रहेगी, लेकिन शब्द तब तक रहेंगे जब तक तुम मिटा न दो। अब भी पोस्ट करना है?',
  'wall.softpause.holdOn': 'रुको, एक बार और पढ़ लेता/लेती हूँ',
  'wall.softpause.post': 'फिर भी पोस्ट करो',

  'quickExit.label': 'जल्दी बाहर',
};

const CATALOG = { en, hi };

export function t(locale, key, fallback = key) {
  return CATALOG[locale]?.[key] ?? CATALOG.en[key] ?? fallback;
}

// React hook so any component can read & change the locale.
let currentLocale = (typeof localStorage !== 'undefined' && localStorage.getItem(KEY)) || 'en';
const subs = new Set();

export function getLocale() {
  return currentLocale;
}
export function setLocale(next) {
  if (!CATALOG[next]) return;
  currentLocale = next;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    // ignore (private mode)
  }
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('lang', next);
  }
  subs.forEach((s) => s(next));
}

export function useLocale() {
  const [locale, set] = useState(currentLocale);
  useEffect(() => {
    subs.add(set);
    return () => subs.delete(set);
  }, []);
  return { locale, setLocale };
}
