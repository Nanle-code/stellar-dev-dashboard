/**
 * HMAC signature helpers for inbound automation webhooks.
 *
 * Signatures use the format: t=<unix-seconds>,v1=<hex-hmac>
 * The signed payload is `${timestamp}.${rawBody}`.
 */

const SIGNATURE_PREFIX = 't=';
const VERSION_PREFIX = ',v1=';
const DEFAULT_TOLERANCE_SECONDS = 300;

interface VerifyWebhookSignatureOptions {
  toleranceSeconds?: number;
  now?: number;
}

type ParsedSignature =
  | { ok: false; reason: string }
  | { ok: true; timestamp: number; signature: string };

function encodeUtf8(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function timingSafeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) {
    return false;
  }

  let mismatch = 0;
  for (let i = 0; i < left.length; i += 1) {
    mismatch |= left.charCodeAt(i) ^ right.charCodeAt(i);
  }
  return mismatch === 0;
}

async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Web Crypto API is not available in this environment');
  }

  const key = await crypto.subtle.importKey(
    'raw',
    encodeUtf8(secret) as BufferSource,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign('HMAC', key, encodeUtf8(payload) as BufferSource);
  return toHex(signature);
}

export function parseWebhookSignatureHeader(headerValue: string): ParsedSignature {
  if (typeof headerValue !== 'string' || !headerValue.trim()) {
    return { ok: false, reason: 'missing_signature' };
  }

  const timestampPart = headerValue.match(/(?:^|,|\s)t=(\d+)/)?.[1];
  const signaturePart = headerValue.match(/(?:^|,|\s)v1=([a-f0-9]+)/i)?.[1];

  if (!timestampPart || !signaturePart) {
    return { ok: false, reason: 'malformed_signature' };
  }

  const timestamp = Number.parseInt(timestampPart, 10);
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return { ok: false, reason: 'invalid_timestamp' };
  }

  return {
    ok: true,
    timestamp,
    signature: signaturePart.toLowerCase(),
  };
}

export async function signWebhookPayload(
  rawBody: string,
  secret: string,
  timestamp?: number,
): Promise<string> {
  if (typeof rawBody !== 'string') {
    throw new TypeError('rawBody must be a string');
  }
  if (typeof secret !== 'string' || !secret) {
    throw new TypeError('secret must be a non-empty string');
  }

  const ts = timestamp ?? Math.floor(Date.now() / 1000);
  const signedPayload = `${ts}.${rawBody}`;
  const digest = await hmacSha256Hex(secret, signedPayload);
  return `${SIGNATURE_PREFIX}${ts}${VERSION_PREFIX}${digest}`;
}

export async function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string,
  secret: string,
  options: VerifyWebhookSignatureOptions = {},
): Promise<{ valid: boolean; reason?: string; timestamp?: number }> {
  if (typeof rawBody !== 'string') {
    return { valid: false, reason: 'invalid_body' };
  }
  if (typeof secret !== 'string' || !secret) {
    return { valid: false, reason: 'invalid_secret' };
  }

  const parsed = parseWebhookSignatureHeader(signatureHeader);
  if (!parsed.ok) {
    return { valid: false, reason: parsed.reason };
  }

  const toleranceSeconds = options.toleranceSeconds ?? DEFAULT_TOLERANCE_SECONDS;
  const now = options.now ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - parsed.timestamp) > toleranceSeconds) {
    return { valid: false, reason: 'timestamp_out_of_tolerance' };
  }

  const signedPayload = `${parsed.timestamp}.${rawBody}`;
  let expected;
  try {
    expected = await hmacSha256Hex(secret, signedPayload);
  } catch {
    return { valid: false, reason: 'unsupported_environment' };
  }

  if (!timingSafeEqual(expected, parsed.signature)) {
    return { valid: false, reason: 'signature_mismatch' };
  }

  return { valid: true, timestamp: parsed.timestamp };
}

export async function signWebhookPayloadObject(
  payload: Record<string, unknown>,
  secret: string,
  timestamp?: number,
): Promise<{ rawBody: string; signature: string }> {
  const rawBody = JSON.stringify(payload);
  const signature = await signWebhookPayload(rawBody, secret, timestamp);
  return { rawBody, signature };
}
