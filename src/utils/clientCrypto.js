// Optional client-side encryption for journal entries. WebCrypto
// AES-GCM-256, with a key derived from a user passphrase via PBKDF2.
//
// Threat model & honest scope:
// - Firestore is already encrypted at rest by Google. The value of
//   adding a client-side layer is *zero-knowledge*: we never see plain
//   text, so a compromised admin token or future government request
//   yields ciphertext only.
// - The passphrase NEVER leaves the device. We persist a salt + KDF
//   parameters in localStorage; the derived key is held in
//   sessionStorage (so a tab close clears it) and re-derived on
//   demand when the user types the passphrase.
// - Forgot the passphrase → encrypted entries are unrecoverable.
//   This is the cost of zero-knowledge. The toggle is opt-in and the
//   UI shouts about this trade-off.
//
// Storage layout (localStorage):
//   gh_e2e_v1: { salt, iter, kdf: 'PBKDF2-SHA256' }   (created on first enable)
//
// Encrypted payload shape (in Firestore body field):
//   { e: 1, iv: <base64>, ct: <base64> }

const CONFIG_KEY = 'gh_e2e_v1';
const SESSION_KEY = 'gh_e2e_session_key_v1';
const ALG = { name: 'AES-GCM', length: 256 };
const KDF_ITER = 200_000; // ~200ms on a mid-tier phone in 2026

function b64encode(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}
function b64decode(s) {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

export function isEncryptionConfigured() {
  return !!localStorage.getItem(CONFIG_KEY);
}

export function isEncryptionUnlocked() {
  return !!sessionStorage.getItem(SESSION_KEY);
}

async function importKeyMaterial(passphrase) {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
}

async function deriveKey(passphrase, salt, iterations = KDF_ITER) {
  const km = await importKeyMaterial(passphrase);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    km,
    ALG,
    true,
    ['encrypt', 'decrypt'],
  );
}

async function exportRawKey(key) {
  const raw = await crypto.subtle.exportKey('raw', key);
  return b64encode(raw);
}

async function importRawKey(rawB64) {
  const raw = b64decode(rawB64);
  return crypto.subtle.importKey('raw', raw, ALG, true, ['encrypt', 'decrypt']);
}

// First-time setup: pick a fresh salt, derive a key, persist config + session.
export async function enableEncryption(passphrase) {
  if (isEncryptionConfigured()) {
    throw new Error('Encryption already configured. Use unlockEncryption().');
  }
  if (!passphrase || passphrase.length < 6) {
    throw new Error('Passphrase must be at least 6 characters.');
  }
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKey(passphrase, salt);
  localStorage.setItem(
    CONFIG_KEY,
    JSON.stringify({
      salt: b64encode(salt.buffer),
      iter: KDF_ITER,
      kdf: 'PBKDF2-SHA256',
      v: 1,
    }),
  );
  sessionStorage.setItem(SESSION_KEY, await exportRawKey(key));
}

// Unlock for this session: re-derive the key from passphrase+saved salt.
export async function unlockEncryption(passphrase) {
  const cfg = JSON.parse(localStorage.getItem(CONFIG_KEY) || 'null');
  if (!cfg) throw new Error('Encryption not configured yet.');
  const key = await deriveKey(passphrase, b64decode(cfg.salt), cfg.iter || KDF_ITER);
  // Round-trip a known plaintext to verify the passphrase is correct
  // before "unlocking".
  const testIv = crypto.getRandomValues(new Uint8Array(12));
  const testEnc = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: testIv },
    key,
    new TextEncoder().encode('ok'),
  );
  const testDec = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: testIv },
    key,
    testEnc,
  );
  if (new TextDecoder().decode(testDec) !== 'ok') {
    throw new Error('Wrong passphrase.');
  }
  sessionStorage.setItem(SESSION_KEY, await exportRawKey(key));
}

export function lockEncryption() {
  sessionStorage.removeItem(SESSION_KEY);
}

// HARD reset — destroys the salt + session key. Anything previously
// encrypted with this passphrase is now unrecoverable.
export function resetEncryption() {
  localStorage.removeItem(CONFIG_KEY);
  sessionStorage.removeItem(SESSION_KEY);
}

async function getSessionKey() {
  const raw = sessionStorage.getItem(SESSION_KEY);
  if (!raw) throw new Error('Encryption is locked. Enter your passphrase.');
  return importRawKey(raw);
}

export async function encryptString(plaintext) {
  const key = await getSessionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plaintext),
  );
  return { e: 1, iv: b64encode(iv.buffer), ct: b64encode(ct) };
}

export async function decryptString(payload) {
  if (!payload || payload.e !== 1) return null; // not encrypted
  const key = await getSessionKey();
  const iv = b64decode(payload.iv);
  const ct = b64decode(payload.ct);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
  return new TextDecoder().decode(plain);
}

// Returns true if a value looks like an encrypted payload, not plaintext.
export function looksEncrypted(v) {
  return v && typeof v === 'object' && v.e === 1 && typeof v.iv === 'string' && typeof v.ct === 'string';
}
