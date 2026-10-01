/**
 * Sensitive value classification (#839)
 * =====================================
 * Determines whether a value shown in the UI is secret-adjacent (secret key,
 * signed/unsigned transaction envelope, recovery phrase, or bearer token) and
 * therefore requires an explicit confirmation before it can be copied to the
 * system clipboard.
 *
 * Never throws: non-string input is reported as `kind: 'none'`.
 */

export type SensitiveKind =
  | 'secret-key'
  | 'signed-xdr'
  | 'unsigned-xdr'
  | 'mnemonic'
  | 'jwt'
  | 'none';

export interface SensitivityVerdict {
  sensitive: boolean;
  kind: SensitiveKind;
  reason: string;
}

const SECRET_KEY_RE = /\bS[A-Z2-7]{55}\b/;
const JWT_RE = /\beyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/;
// Stellar transaction envelopes are base64 XDR and begin with the 4-byte
// version/type header, which base64-encodes to the "AAAA" prefix.
const XDR_RE = /^[A-Za-z0-9+/]{80,}={0,2}$/;

const MNEMONIC_WORD_RE = /^[a-z]{3,8}$/;

function looksLikeMnemonic(value: string): boolean {
  const words = value.trim().toLowerCase().split(/\s+/);
  if (![12, 15, 18, 21, 24].includes(words.length)) return false;
  return words.every((word) => MNEMONIC_WORD_RE.test(word));
}

/**
 * Classify a value. `explicitSensitive` lets callers force a confirmation even
 * when the heuristics do not recognise the format (e.g. a custom secret field).
 */
export function classifySensitiveValue(value: unknown, explicitSensitive = false): SensitivityVerdict {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return { sensitive: explicitSensitive, kind: 'none', reason: explicitSensitive ? 'flagged by caller' : 'empty value' };
  }

  const trimmed = value.trim();

  if (SECRET_KEY_RE.test(trimmed)) {
    return { sensitive: true, kind: 'secret-key', reason: 'Stellar secret key' };
  }

  if (JWT_RE.test(trimmed)) {
    return { sensitive: true, kind: 'jwt', reason: 'Bearer/JWT token' };
  }

  if (looksLikeMnemonic(trimmed)) {
    return { sensitive: true, kind: 'mnemonic', reason: 'Recovery phrase' };
  }

  if (XDR_RE.test(trimmed) && trimmed.startsWith('AAAA')) {
    // Envelopes with a signature are the higher-risk variant.
    const kind: SensitiveKind = trimmed.length > 200 ? 'signed-xdr' : 'unsigned-xdr';
    return {
      sensitive: true,
      kind,
      reason: kind === 'signed-xdr' ? 'Signed transaction envelope (XDR)' : 'Transaction envelope (XDR)',
    };
  }

  return { sensitive: explicitSensitive, kind: 'none', reason: explicitSensitive ? 'flagged by caller' : 'not sensitive' };
}

/** Convenience predicate used by UI components. */
export function isSensitiveValue(value: unknown, explicitSensitive = false): boolean {
  return classifySensitiveValue(value, explicitSensitive).sensitive;
}

/** Human-readable confirmation prompt for a classification. */
export function confirmationPromptFor(verdict: SensitivityVerdict): string {
  switch (verdict.kind) {
    case 'secret-key':
      return 'This is your secret key. Anyone who sees it can control your funds.';
    case 'signed-xdr':
      return 'This signed transaction can be submitted as-is. Only share it with the intended network.';
    case 'unsigned-xdr':
      return 'This transaction envelope is unsigned, but it still reveals your intent and account.';
    case 'mnemonic':
      return 'This is your recovery phrase and grants full wallet access.';
    case 'jwt':
      return 'This token authenticates a session. Do not share it.';
    default:
      return 'This value may contain sensitive data.';
  }
}
