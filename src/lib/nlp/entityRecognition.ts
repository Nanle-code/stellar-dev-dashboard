/**
 * Entity recognition for the Natural Language Transaction Builder (#551).
 *
 * Extracts the concrete values a Stellar operation needs (addresses, amounts,
 * asset codes, memos) out of free text, and resolves aliases against the
 * address book, known issuers, and learned corrections.
 *
 * Every extractor returns a confidence score. Confidence is deliberately
 * conservative: a literal G... key scores 1.0, an alias resolved from a
 * confirmed correction scores high, and an unresolved bare name scores low so
 * the UI highlights it for review rather than submitting something wrong.
 */

import type {
  AmountRef,
  AssetRef,
  Correction,
  DestinationRef,
  ResolutionContext,
} from "./types";

// ─── Address handling ────────────────────────────────────────────────────────

const PUBLIC_KEY_RE = /\bG[A-Z2-7]{55}\b/g;
const MUXED_KEY_RE = /\bM[A-Z2-7]{68}\b/g;
const CONTRACT_ID_RE = /\bC[A-Z2-7]{55}\b/g;
const FEDERATION_RE = /\b[A-Za-z0-9._%+-]+\*[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
const BALANCE_ID_RE = /\b[0-9a-f]{72}\b/gi;

/**
 * Structural check only. Full checksum validation lives in
 * src/lib/validation.ts and is applied downstream by validateOperation().
 */
export function looksLikePublicKey(value: string): boolean {
  return /^G[A-Z2-7]{55}$/.test(value);
}

export function looksLikeMuxedKey(value: string): boolean {
  return /^M[A-Z2-7]{68}$/.test(value);
}

export function looksLikeContractId(value: string): boolean {
  return /^C[A-Z2-7]{55}$/.test(value);
}

function matchAll(text: string, re: RegExp): string[] {
  const out: string[] = [];
  const local = new RegExp(re.source, re.flags.includes("g") ? re.flags : `${re.flags}g`);
  let m: RegExpExecArray | null;
  while ((m = local.exec(text)) !== null) out.push(m[0]);
  return out;
}

export function extractPublicKeys(text: string): string[] {
  return matchAll(text, PUBLIC_KEY_RE);
}

export function extractMuxedKeys(text: string): string[] {
  return matchAll(text, MUXED_KEY_RE);
}

export function extractContractIds(text: string): string[] {
  return matchAll(text, CONTRACT_ID_RE);
}

export function extractFederationAddresses(text: string): string[] {
  return matchAll(text, FEDERATION_RE);
}

export function extractBalanceId(text: string): string | undefined {
  return matchAll(text, BALANCE_ID_RE)[0];
}

// ─── Amounts ─────────────────────────────────────────────────────────────────

const NUMBER_WORDS: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  fifteen: 15,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  hundred: 100,
  thousand: 1000,
  million: 1000000,
};

const MAGNITUDE_SUFFIX: Record<string, number> = {
  k: 1e3,
  m: 1e6,
  b: 1e9,
};

/** Stellar amounts carry at most 7 decimal places. */
export function normalizeAmount(value: number): string {
  if (!Number.isFinite(value)) return "0";
  const fixed = value.toFixed(7);
  return fixed.replace(/\.?0+$/, "") || "0";
}

/**
 * Extracts the first quantity from text. Handles digits with separators
 * ("1,500.50"), magnitude suffixes ("1.5k"), and small number words ("five").
 */
export function extractAmount(text: string): AmountRef | undefined {
  const numeric = text.match(
    /(?<![A-Za-z0-9.])(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)\s*([kmb])?\b/i,
  );

  if (numeric) {
    const digits = numeric[1].replace(/,/g, "");
    const suffix = numeric[2]?.toLowerCase();
    const base = parseFloat(digits);
    const multiplier = suffix ? (MAGNITUDE_SUFFIX[suffix] ?? 1) : 1;
    if (Number.isFinite(base)) {
      return { value: normalizeAmount(base * multiplier), raw: numeric[0].trim() };
    }
  }

  const worded = text
    .toLowerCase()
    .match(
      new RegExp(`\\b(${Object.keys(NUMBER_WORDS).join("|")})\\b(?:\\s+(hundred|thousand|million))?`),
    );

  if (worded) {
    const base = NUMBER_WORDS[worded[1]];
    const scale = worded[2] ? NUMBER_WORDS[worded[2]] : 1;
    if (base !== undefined) {
      return { value: normalizeAmount(base * scale), raw: worded[0] };
    }
  }

  return undefined;
}

/** Extracts a price expressed as "at 0.5 USDC each" or "at a price of 0.5". */
export function extractPrice(text: string): string | undefined {
  const m = text.match(
    /\b(?:at|for|price\s+of|@)\s+(\d+(?:\.\d+)?)\s*(?:[A-Za-z]{1,12}\s*)?(?:each|per|apiece)?/i,
  );
  if (!m) return undefined;
  const n = parseFloat(m[1]);
  return Number.isFinite(n) ? normalizeAmount(n) : undefined;
}

// ─── Assets ──────────────────────────────────────────────────────────────────

const NATIVE_ALIASES = ["xlm", "lumen", "lumens", "native", "stellar lumens"];

/**
 * Words shaped like asset codes that are almost never asset codes in context.
 * Prevents "SEND" or "TO" from being read as a credit asset.
 */
const ASSET_CODE_STOPWORDS = new Set([
  "SEND",
  "PAY",
  "TO",
  "FROM",
  "FOR",
  "AND",
  "THE",
  "WITH",
  "AT",
  "OF",
  "ON",
  "MY",
  "ALL",
  "NEW",
  "SET",
  "ADD",
  "BUY",
  "GET",
  "USE",
  "VIA",
  "MEMO",
  "TRUST",
  "LINE",
  "ACCOUNT",
  "BALANCE",
  "OFFER",
  "PRICE",
  "EACH",
  "THEN",
  "ALSO",
  "PLUS",
]);

export function isNativeAssetWord(word: string): boolean {
  return NATIVE_ALIASES.includes(word.toLowerCase().trim());
}

/** Codes are 1-12 alphanumerics; 1-4 is alphanum4, 5-12 is alphanum12. */
export function assetTypeForCode(code: string): AssetRef["assetType"] {
  return code.length <= 4 ? "credit_alphanum4" : "credit_alphanum12";
}

/**
 * Resolves an asset token to an AssetRef, consulting known issuers and
 * corrections for the issuer of a credit asset.
 */
export function resolveAsset(
  token: string,
  ctx: ResolutionContext = {},
): { asset: AssetRef; confidence: number } {
  const trimmed = token.trim().replace(/^["']|["']$/g, "");

  if (isNativeAssetWord(trimmed)) {
    return { asset: { assetType: "native" }, confidence: 1 };
  }

  const explicit = trimmed.match(/^([A-Za-z0-9]{1,12}):(G[A-Z2-7]{55})$/);
  if (explicit) {
    const code = explicit[1].toUpperCase();
    return {
      asset: {
        assetType: assetTypeForCode(code),
        assetCode: code,
        assetIssuer: explicit[2],
      },
      confidence: 1,
    };
  }

  const code = trimmed.toUpperCase();
  if (!/^[A-Z0-9]{1,12}$/.test(code) || ASSET_CODE_STOPWORDS.has(code)) {
    return {
      asset: { assetType: "native" },
      confidence: 0.2,
    };
  }

  const corrected = lookupCorrection(ctx.corrections, code.toLowerCase(), "issuer");
  const issuer = corrected ?? ctx.knownIssuers?.[code];

  return {
    asset: {
      assetType: assetTypeForCode(code),
      assetCode: code,
      assetIssuer: issuer,
      issuerUnresolved: !issuer,
    },
    confidence: issuer ? (corrected ? 0.95 : 0.9) : 0.55,
  };
}

/**
 * Finds an asset token adjacent to an amount, e.g. "500 XLM" or "500 USDC".
 * Falls back to any standalone code-shaped token.
 */
export function extractAssetToken(text: string, amountRaw?: string): string | undefined {
  if (amountRaw) {
    const escaped = amountRaw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const after = text.match(
      new RegExp(`${escaped}\\s+(?:of\\s+)?([A-Za-z0-9]{1,12}(?::G[A-Z2-7]{55})?)`, "i"),
    );
    if (after) return after[1];
  }

  const explicit = text.match(/\b([A-Za-z0-9]{1,12}:G[A-Z2-7]{55})\b/);
  if (explicit) return explicit[1];

  const native = text.match(new RegExp(`\\b(${NATIVE_ALIASES.join("|")})\\b`, "i"));
  if (native) return native[1];

  const codes = matchAll(text, /\b[A-Z0-9]{2,12}\b/g).filter(
    (c) => !ASSET_CODE_STOPWORDS.has(c) && !looksLikePublicKey(c),
  );
  return codes[0];
}

// ─── Memos ───────────────────────────────────────────────────────────────────

export const MEMO_TEXT_MAX_BYTES = 28;

export function memoByteLength(memo: string): number {
  return new TextEncoder().encode(memo).length;
}

/**
 * Extracts a memo. Quoted text wins; otherwise a trailing "for X" or
 * "with memo X" phrase is used.
 */
export function extractMemo(
  text: string,
): { memo: string; memoType: "text" | "id"; confidence: number } | undefined {
  const quoted = text.match(/(?:memo|note|reference|ref)\s*(?:of|:)?\s*["']([^"']+)["']/i);
  if (quoted) {
    return { memo: quoted[1].trim(), memoType: "text", confidence: 0.95 };
  }

  const memoId = text.match(/\bmemo\s*(?:id)?\s*(?:of|:)?\s*(\d{1,20})\b/i);
  if (memoId) {
    return { memo: memoId[1], memoType: "id", confidence: 0.9 };
  }

  const keyword = text.match(
    /\b(?:with\s+)?(?:memo|note|reference|ref)\s*(?:of|:)?\s+([^,;]{1,40}?)(?=\s*(?:$|,|;|\band\b|\bthen\b))/i,
  );
  if (keyword) {
    return { memo: keyword[1].trim().replace(/^["']|["']$/g, ""), memoType: "text", confidence: 0.85 };
  }

  const bareQuoted = text.match(/["']([^"']{1,40})["']\s*$/);
  if (bareQuoted) {
    return { memo: bareQuoted[1].trim(), memoType: "text", confidence: 0.7 };
  }

  const forPhrase = text.match(/\bfor\s+([a-z][a-z0-9 _-]{1,30})\s*$/i);
  if (forPhrase) {
    const candidate = forPhrase[1].trim();
    if (!/^(?:it|me|him|her|them|us|that|this|now|later|free)$/i.test(candidate)) {
      return { memo: candidate, memoType: "text", confidence: 0.6 };
    }
  }

  return undefined;
}

// ─── Corrections ─────────────────────────────────────────────────────────────

/** Returns the highest-confirmation correction for a key, if any. */
export function lookupCorrection(
  corrections: Correction[] | undefined,
  key: string,
  kind: Correction["kind"],
): string | undefined {
  if (!corrections?.length) return undefined;
  const matches = corrections
    .filter((c) => c.kind === kind && c.key === key.toLowerCase())
    .sort((a, b) => b.hits - a.hits || b.updatedAt - a.updatedAt);
  return matches[0]?.value;
}

// ─── Destination resolution ──────────────────────────────────────────────────

/** Words that follow a destination preposition but are not names. */
const NOT_A_NAME = new Set([
  "the",
  "my",
  "his",
  "her",
  "their",
  "our",
  "this",
  "that",
  "a",
  "an",
  "it",
  "them",
  "account",
  "address",
  "wallet",
]);

/**
 * Resolves a destination phrase to a public key where possible.
 * A bare name that cannot be resolved is returned with kind "alias" and low
 * confidence so the UI can prompt for the real address.
 */
export function resolveDestination(
  raw: string,
  ctx: ResolutionContext = {},
): { destination: DestinationRef; confidence: number } {
  const cleaned = raw.trim().replace(/^["']|["']$/g, "").replace(/[.,;!?]+$/, "");

  if (looksLikePublicKey(cleaned)) {
    return {
      destination: { raw: cleaned, resolved: cleaned, kind: "publicKey" },
      confidence: 1,
    };
  }

  if (looksLikeMuxedKey(cleaned)) {
    return {
      destination: { raw: cleaned, resolved: cleaned, kind: "muxed" },
      confidence: 1,
    };
  }

  if (FEDERATION_RE.test(cleaned)) {
    FEDERATION_RE.lastIndex = 0;
    const corrected = lookupCorrection(ctx.corrections, cleaned.toLowerCase(), "destination");
    return {
      destination: {
        raw: cleaned,
        resolved: corrected,
        kind: "federation",
      },
      confidence: corrected ? 0.95 : 0.75,
    };
  }
  FEDERATION_RE.lastIndex = 0;

  const key = cleaned.toLowerCase();
  if (!key || NOT_A_NAME.has(key)) {
    return { destination: { raw: cleaned, kind: "unknown" }, confidence: 0.1 };
  }

  const corrected = lookupCorrection(ctx.corrections, key, "destination");
  if (corrected) {
    return {
      destination: { raw: cleaned, resolved: corrected, kind: "alias" },
      confidence: 0.95,
    };
  }

  const fromBook = ctx.addressBook?.[key];
  if (fromBook) {
    return {
      destination: { raw: cleaned, resolved: fromBook, kind: "alias" },
      confidence: 0.9,
    };
  }

  return { destination: { raw: cleaned, kind: "alias" }, confidence: 0.35 };
}