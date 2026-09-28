/**
 * Encryption — AES-256-GCM via Web Crypto API
 *
 * All operations are async and use the browser's native crypto.subtle.
 * No external dependencies. Keys are derived from passphrases using PBKDF2.
 */

const PBKDF2_ITERATIONS = 100_000;
const KEY_LENGTH = 256;
const ALGORITHM = 'AES-GCM';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toBase64(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

function fromBase64(str) {
  return Uint8Array.from(atob(str), c => c.charCodeAt(0));
}

/**
 * Derive an AES-GCM CryptoKey from a passphrase + salt using PBKDF2.
 * @param {string} passphrase
 * @param {Uint8Array} salt
 * @returns {Promise<CryptoKey>}
 */
async function deriveKey(passphrase, salt) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Encrypt a plaintext string with a passphrase.
 * Generates a fresh random IV and salt for every call.
 *
 * @param {string} plaintext
 * @param {string} passphrase
 * @returns {Promise<{ ciphertext: string, iv: string, salt: string }>}
 */
export async function encrypt(plaintext, passphrase) {
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv   = crypto.getRandomValues(new Uint8Array(12));
  const key  = await deriveKey(passphrase, salt);

  const cipherbuf = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    enc.encode(plaintext)
  );

  return {
    ciphertext: toBase64(cipherbuf),
    iv:         toBase64(iv),
    salt:       toBase64(salt),
  };
}

/**
 * Decrypt data produced by `encrypt()`.
 *
 * @param {string} ciphertext  base64 ciphertext
 * @param {string} passphrase
 * @param {string} iv          base64 IV
 * @param {string} salt        base64 salt
 * @returns {Promise<string>}
 * @throws {Error} if passphrase is wrong or data is corrupted
 */
export async function decrypt(ciphertext, passphrase, iv, salt) {
  const key = await deriveKey(passphrase, fromBase64(salt));

  const plainbuf = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv: fromBase64(iv) },
    key,
    fromBase64(ciphertext)
  );

  return new TextDecoder().decode(plainbuf);
}

/**
 * Generate a random 256-bit key as a base64 string.
 * Useful for app-level encryption that doesn't require a user passphrase.
 *
 * @returns {Promise<string>} base64-encoded key
 */
export async function generateKey() {
  const key = await crypto.subtle.generateKey(
    { name: ALGORITHM, length: KEY_LENGTH },
    true,
    ['encrypt', 'decrypt']
  );
  const raw = await crypto.subtle.exportKey('raw', key);
  return toBase64(raw);
}

/**
 * Encrypt using a raw base64 key (from generateKey) instead of a passphrase.
 * Faster — no PBKDF2 derivation.
 *
 * @param {string} plaintext
 * @param {string} rawKeyBase64
 * @returns {Promise<{ ciphertext: string, iv: string }>}
 */
export async function encryptWithKey(plaintext, rawKeyBase64) {
  const enc = new TextEncoder();
  const iv  = crypto.getRandomValues(new Uint8Array(12));

  const key = await crypto.subtle.importKey(
    'raw',
    fromBase64(rawKeyBase64),
    { name: ALGORITHM },
    false,
    ['encrypt']
  );

  const cipherbuf = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    enc.encode(plaintext)
  );

  return { ciphertext: toBase64(cipherbuf), iv: toBase64(iv) };
}

/**
 * Decrypt using a raw base64 key (from generateKey).
 *
 * @param {string} ciphertext  base64
 * @param {string} rawKeyBase64
 * @param {string} iv          base64
 * @returns {Promise<string>}
 */
export async function decryptWithKey(ciphertext, rawKeyBase64, iv) {
  const key = await crypto.subtle.importKey(
    'raw',
    fromBase64(rawKeyBase64),
    { name: ALGORITHM },
    false,
    ['decrypt']
  );

  const plainbuf = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv: fromBase64(iv) },
    key,
    fromBase64(ciphertext)
  );

  return new TextDecoder().decode(plainbuf);
}
