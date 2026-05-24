// Server-side proxy for the AI Companion's Gemini calls.
//
// Why this exists: Vite expands `import.meta.env.VITE_*` at build time,
// so any key we put in the client bundle is publicly readable. For a
// mental-health app — where any teen with devtools can scrape the
// bundle and abuse the key — that's unacceptable.
//
// This function:
//   • Authenticates the caller via Firebase Auth (callable function)
//   • Rate-limits per uid (30 calls/min — generous, a real conversation
//     never hits this)
//   • Runs server-side crisis detection
//   • Calls Gemini with a server-only API key (firebase functions:secrets:set GEMINI_API_KEY)
//   • Returns { reply, classification } — never exposes the key
//
// IMPORTANT: After deploying this for the first time:
//   1. Generate a NEW Gemini key at https://aistudio.google.com/apikey
//   2. firebase functions:secrets:set GEMINI_API_KEY    (paste new key)
//   3. Revoke the OLD key in Google AI Studio (the one previously bundled)
//   4. Remove VITE_GEMINI_API_KEY from .env (no longer needed in client)
//   5. Rebuild + redeploy hosting so the bundle no longer contains it

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { detectCrisisSignals, crisisAcknowledgement } from './crisisDetection.js';
import { rateLimit } from './rateLimit.js';

const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');
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

export const companionChat = onCall(
  {
    region: 'asia-south1',
    secrets: [GEMINI_API_KEY],
    cors: true,
    maxInstances: 5,
    timeoutSeconds: 30,
    memory: '256MiB',
  },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError('unauthenticated', 'Sign in to use the AI Companion.');
    }

    const limit = rateLimit(uid, { max: 30, windowMs: 60_000 });
    if (!limit.ok) {
      throw new HttpsError(
        'resource-exhausted',
        `You're sending messages a little fast. Please wait ${Math.ceil(limit.retryAfterMs / 1000)}s.`,
      );
    }

    const { history = [], message = '' } = request.data || {};
    const trimmed = String(message).slice(0, 4000);
    if (!trimmed.trim()) {
      throw new HttpsError('invalid-argument', 'Message must not be empty.');
    }

    // Bound history aggressively — anything beyond ~30 turns isn't
    // useful context and just inflates tokens.
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

    const apiKey = GEMINI_API_KEY.value();
    if (!apiKey) {
      throw new HttpsError(
        'failed-precondition',
        'Companion is not configured on this deployment.',
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
        throw new HttpsError(
          'unavailable',
          `Gemini ${res.status}: ${text.slice(0, 160)}`,
        );
      }
      const json = await res.json();
      reply = json.candidates?.[0]?.content?.parts?.map((p) => p.text).join('').trim() || '';
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      console.error('companionChat: Gemini call failed', err);
    }

    if (!reply) {
      // If Gemini blocked the response, never leave the user with a refusal.
      if (isCrisis) {
        return {
          reply:
            crisisAcknowledgement(classification.lang) +
            "Please call Tele-MANAS at 14416 right now — it's 24×7 and free, in many Indian languages. " +
            "I'll be here when you come back. You matter.",
          classification,
          synthetic: true,
        };
      }
      throw new HttpsError('unavailable', 'Empty response from the AI service.');
    }

    return { reply, classification };
  },
);
