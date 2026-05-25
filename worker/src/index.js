// Cloudflare Worker — Gemini proxy for GetHelped's AI Companion.
//
// Why this exists:
//   The browser must NEVER hold the Gemini API key — once it's in the
//   client bundle, anyone with devtools can scrape it and burn through
//   your billing quota. On Spark (no Cloud Functions) we host this
//   proxy on Cloudflare Workers (free tier: 100K req/day forever, no
//   credit card required).
//
// What the Worker does:
//   1. CORS pre-flight on OPTIONS.
//   2. POST /chat:
//        a. Verifies the caller's Firebase ID token (jose JWKS verify).
//        b. Rate-limits per uid (in-memory, ~60s window).
//        c. Runs the same crisis classifier the client uses.
//        d. Calls Gemini with a server-only key.
//        e. Returns { reply, classification }.
//   3. Anything else → 404.
//
// Deploy:
//   cd worker
//   npm install
//   wrangler login                              # one-time
//   wrangler secret put GEMINI_API_KEY          # paste the key
//   wrangler deploy                             # gives you a *.workers.dev URL
//
// Then put that URL into the main app's .env as VITE_AI_PROXY_URL=...,
// rebuild, and redeploy hosting.

import { jwtVerify, createRemoteJWKSet } from 'jose';
import { detectCrisisSignals, crisisAcknowledgement } from './crisisDetection.js';

const MODEL = 'gemini-2.5-flash';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

const SAFETY_SETTINGS = [
  { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
  { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
  { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
];

const SYSTEM_PROMPT = `You are GetHelped's AI Companion — a warm, empathetic, attentive listener for someone using a mental health support app for young Indians. You are NOT a therapist or doctor and never pretend to be.

Rules:
- Listen first, validate feelings, then offer gentle perspective. Never lecture.
- Keep replies short (2–4 sentences usually). No essays.
- Never diagnose, prescribe, or give medical/legal advice.
- If the user mentions self-harm, suicide, or being in immediate danger: respond with genuine care, then immediately encourage them to call Tele-MANAS (24×7, 20 languages, dial 14416), Vandrevala (24×7 +91 1860-2662-345), or local emergency services (112). Mention the in-app red Emergency banner.
- If a topic feels heavy or complex (trauma, abuse, ongoing crisis), gently suggest the user reach out to a real human helper through the "Find a Helper" page.
- Do not make up facts. If you don't know, say so plainly.
- Use simple language. ALWAYS mirror the user's language and register naturally: pure English, pure Hindi (Devanagari), or Hinglish/code-mixed. If they switch mid-conversation, follow them. Never lecture them about language choice.
- Never claim to remember past sessions. Don't fabricate identities or specifics.
- You are warm, present, and human-feeling. The goal is for the user to feel heard and a little less alone.`;

const CRISIS_OVERRIDE = `[SAFETY OVERRIDE — the user just shared something that may indicate suicidal ideation or self-harm intent. Your reply MUST:
1. Open with a single short, genuinely caring sentence acknowledging what they shared.
2. Mention that you hear them, and that you're glad they typed this.
3. Clearly suggest one helpline by name and number — choose Tele-MANAS (14416, 24×7, 20 Indian languages) by default.
4. Encourage them to also reach a human helper from "Find a Helper" inside the app.
5. Stay in their language (English, Hindi, or Hinglish — mirror them).
6. Do NOT minimize, do NOT lecture, do NOT give philosophical reframes. Stay short, warm, and concrete.
7. Do NOT refuse to engage. The user needs presence right now, not a refusal screen.]`;

// In-memory rate limiter (one Worker instance scope; resets on cold
// start). Sufficient for abuse prevention; not a hard SLA.
const buckets = new Map(); // uid -> { count, resetAt }
function rateLimit(uid, max = 30, windowMs = 60_000) {
  const now = Date.now();
  const cur = buckets.get(uid);
  if (!cur || cur.resetAt < now) {
    buckets.set(uid, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }
  if (cur.count >= max) return { ok: false, retryAfterMs: cur.resetAt - now };
  cur.count += 1;
  return { ok: true };
}

// Cached JWKS — Firebase publishes them at this URL.
let jwks = null;
function getJWKS() {
  if (!jwks) {
    jwks = createRemoteJWKSet(
      new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'),
    );
  }
  return jwks;
}

async function verifyFirebaseIdToken(token, projectId) {
  const { payload } = await jwtVerify(token, getJWKS(), {
    issuer: `https://securetoken.google.com/${projectId}`,
    audience: projectId,
  });
  if (!payload.sub) throw new Error('Token has no sub claim.');
  return payload.sub; // == uid
}

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

function json(data, init = {}, origin = '*') {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(origin),
      ...(init.headers || {}),
    },
  });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('origin') || '';
    const allowed = (env.ALLOWED_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean);
    const isAllowed = allowed.length === 0 || allowed.includes(origin);
    const respOrigin = isAllowed ? origin : allowed[0] || '*';

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(respOrigin) });
    }

    const url = new URL(request.url);
    if (request.method !== 'POST' || url.pathname !== '/chat') {
      return json({ error: 'Not found.' }, { status: 404 }, respOrigin);
    }

    if (!isAllowed) {
      return json({ error: 'Origin not allowed.' }, { status: 403 }, respOrigin);
    }

    // ---- auth ----
    const authHeader = request.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!token) {
      return json({ error: 'Missing Firebase ID token.' }, { status: 401 }, respOrigin);
    }
    let uid;
    try {
      uid = await verifyFirebaseIdToken(token, env.FIREBASE_PROJECT_ID);
    } catch (e) {
      return json({ error: 'Invalid token: ' + (e?.message || e) }, { status: 401 }, respOrigin);
    }

    // ---- rate limit ----
    const lim = rateLimit(uid);
    if (!lim.ok) {
      return json(
        { error: `Slow down. Retry in ${Math.ceil(lim.retryAfterMs / 1000)}s.` },
        { status: 429 },
        respOrigin,
      );
    }

    // ---- payload ----
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Invalid JSON.' }, { status: 400 }, respOrigin);
    }
    const { history = [], message = '' } = body || {};
    const trimmed = String(message).slice(0, 4000);
    if (!trimmed.trim()) {
      return json({ error: 'message must not be empty.' }, { status: 400 }, respOrigin);
    }

    const trimmedHistory = (Array.isArray(history) ? history : [])
      .slice(-30)
      .map((m) => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: String(m.text ?? '').slice(0, 4000) }],
      }));

    const classification = detectCrisisSignals(trimmed);
    const isCrisis = classification.severity === 'high';
    const systemText = isCrisis
      ? `${CRISIS_OVERRIDE}\n\n${SYSTEM_PROMPT}\n\nLanguage hint: ${classification.lang}. Suggested empathic opener you may rephrase: "${crisisAcknowledgement(classification.lang)}"`
      : SYSTEM_PROMPT;

    const apiKey = env.GEMINI_API_KEY;
    if (!apiKey) {
      return json(
        { error: 'Companion not configured on this deployment.' },
        { status: 503 },
        respOrigin,
      );
    }

    let reply = '';
    try {
      const res = await fetch(`${ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemText }] },
          contents: [
            ...trimmedHistory,
            { role: 'user', parts: [{ text: trimmed }] },
          ],
          generationConfig: {
            temperature: isCrisis ? 0.4 : 0.75,
            topP: 0.9,
            maxOutputTokens: 400,
          },
          safetySettings: SAFETY_SETTINGS,
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        console.error('Gemini error', res.status, text.slice(0, 200));
        // fall through to synthetic crisis fallback below
      } else {
        const j = await res.json();
        reply = j.candidates?.[0]?.content?.parts?.map((p) => p.text).join('').trim() || '';
      }
    } catch (e) {
      console.error('Gemini call exception', e?.message || e);
    }

    if (!reply) {
      if (isCrisis) {
        return json(
          {
            reply:
              crisisAcknowledgement(classification.lang) +
              "Please call Tele-MANAS at 14416 right now — it's 24×7 and free, in many Indian languages. " +
              "I'll be here when you come back. You matter.",
            classification,
            synthetic: true,
          },
          {},
          respOrigin,
        );
      }
      return json(
        { error: 'Empty response from the AI service.' },
        { status: 502 },
        respOrigin,
      );
    }

    return json({ reply, classification }, {}, respOrigin);
  },
};
