// Thin client for Google's Gemini API, used by the in-app AI Companion.
//
// We call generativelanguage.googleapis.com directly from the browser.
// The API key MUST be domain-restricted in Google Cloud Console for any
// non-demo deployment. Without restriction, anyone can scrape the bundle
// and rack up free-tier quota.

const KEY = import.meta.env.VITE_GEMINI_API_KEY || '';
const MODEL = 'gemini-2.5-flash';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

const SYSTEM_PROMPT = `You are GetHelped's AI Companion — a warm, empathetic, attentive listener for someone using a mental health support app for young Indians. You are NOT a therapist or doctor and never pretend to be.

Rules:
- Listen first, validate feelings, then offer gentle perspective. Never lecture.
- Keep replies short (2–4 sentences usually). No essays.
- Never diagnose, prescribe, or give medical/legal advice.
- If the user mentions self-harm, suicide, or being in immediate danger: respond with genuine care, then immediately encourage them to call iCall (+91 9152987821), Vandrevala (24×7 +91 1860-2662-345), or local emergency services (112). Mention the in-app red Emergency banner.
- If a topic feels heavy or complex (trauma, abuse, ongoing crisis), gently suggest the user reach out to a real human helper through the "Find a Helper" page.
- Do not make up facts. If you don't know, say so plainly.
- Use simple language. Mirror the user's language naturally (English / Hindi / Hinglish are all welcome).
- Never claim to remember past sessions. Don't fabricate identities or specifics.
- You are warm, present, and human-feeling. The goal is for the user to feel heard and a little less alone.`;

export const isCompanionConfigured = () => !!KEY;

export async function chatWithCompanion({ history, message, signal }) {
  if (!KEY) throw new Error('Gemini API key not configured. See README.');

  const contents = [
    ...history.map((m) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.text }],
    })),
    { role: 'user', parts: [{ text: message }] },
  ];

  const res = await fetch(`${ENDPOINT}?key=${encodeURIComponent(KEY)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents,
      generationConfig: { temperature: 0.75, topP: 0.9, maxOutputTokens: 400 },
      // Gemini's safety settings — we leave defaults; the system prompt
      // already redirects severe content to professional help.
    }),
  });

  if (!res.ok) {
    let text = await res.text().catch(() => '');
    throw new Error(`Gemini error ${res.status}: ${text.slice(0, 200)}`);
  }
  const json = await res.json();
  const reply =
    json.candidates?.[0]?.content?.parts?.map((p) => p.text).join('').trim() || '';
  if (!reply) throw new Error('Empty response from Gemini.');
  return reply;
}
