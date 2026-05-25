# GetHelped — AI Proxy Worker

Cloudflare Worker that proxies AI Companion calls to Google Gemini, so
the API key never lives in the browser bundle. This is the
**Spark-compatible alternative** to a Firebase Cloud Function.

## What you get

- **Free forever** on Cloudflare's Workers free tier (100,000 requests/day).
- **No credit card required** — Cloudflare doesn't ask for one to use the free tier.
- Same security as a Cloud Function: Firebase ID token verification,
  per-uid rate limit (30 req/min), server-side crisis classifier,
  explicit Gemini safety settings, synthetic crisis fallback.

## One-time setup (10 minutes)

```bash
# 1. Sign up at https://dash.cloudflare.com/sign-up (free, no card)

# 2. Install dependencies and login
cd worker
npm install
npx wrangler login          # opens browser for Cloudflare auth

# 3. Set the Gemini API key as a SECRET (never logged, never bundled)
#    Get a NEW key at https://aistudio.google.com/apikey
#    (and revoke the old one that was previously bundled)
npx wrangler secret put GEMINI_API_KEY
# It will prompt for the value — paste your new key, hit enter.

# 4. Deploy
npx wrangler deploy
```

The deploy prints something like:

```
Uploaded gethelped-ai-proxy (1.92 sec)
Published gethelped-ai-proxy (3.11 sec)
  https://gethelped-ai-proxy.your-username.workers.dev
```

## Wire the URL into the main app

Add the printed URL to the **main project's** `.env`:

```bash
# In ../  (the GetHelped root, not this folder)
VITE_AI_PROXY_URL=https://gethelped-ai-proxy.your-username.workers.dev
```

Then from the GetHelped root:

```bash
npm run build
firebase deploy --only hosting
```

## Verify

```bash
# (Replace YOUR_TOKEN with a Firebase ID token from any signed-in user;
# get one in browser devtools: await firebase.auth().currentUser.getIdToken())
curl -X POST https://gethelped-ai-proxy.your-username.workers.dev/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"message":"hi"}'
```

Expect `{"reply": "...", "classification": {...}}`.

## Re-deploy after code changes

```bash
cd worker
npx wrangler deploy
```

## Updating the Gemini key

```bash
cd worker
npx wrangler secret put GEMINI_API_KEY
# paste new value
# next request automatically uses it (no redeploy needed)
```

## Logs / debug

```bash
cd worker
npx wrangler tail
```

## Tightening CORS (recommended after first deploy)

By default `wrangler.toml` allows requests only from
`https://get-helped.web.app`. If you set up a custom domain or need to
test from localhost, override:

```bash
npx wrangler deploy --var ALLOWED_ORIGIN:"https://get-helped.web.app,http://localhost:5173"
```
