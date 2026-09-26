/**
 * SEP-0007 request URI builder and validator.
 *
 * Builds `web+stellar:tx` and `web+stellar:pay` URIs for wallet handoff
 * (deep links, QR codes), parses and validates incoming ones, and signs or
 * verifies them with a domain's URI_REQUEST_SIGNING_KEY.
 *
 * Spec: https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0007.md
 */

import { Keypair, StrKey, xdr as StellarXdr } from '@stellar/stellar-sdk';

export const SEP7_SCHEME = 'web+stellar:';
export const SEP7_MSG_MAX_LENGTH = 300;
export const SEP7_MAX_CHAIN_DEPTH = 7;
export const SEP7_MEMO_TYPES = ['MEMO_TEXT', 'MEMO_ID', 'MEMO_HASH', 'MEMO_RETURN'] as const;

const SIGNATURE_PREFIX = 'stellar.sep.7 - URI Scheme';
const MAX_AMOUNT = '922337203685.4775807';
const MAX_UINT64 = BigInt('18446744073709551615');
const MEMO_TEXT_MAX_BYTES = 28;
const MEMO_HASH_BYTES = 32;
const ED25519_SIGNATURE_BYTES = 64;
const LOCAL_HOSTS = ['localhost', '127.0.0.1', '[::1]'];

const TX_PARAMS = [
  'xdr',
  'replace',
  'callback',
  'pubkey',
  'chain',
  'msg',
  'network_passphrase',
  'origin_domain',
  'signature',
];
const PAY_PARAMS = [
  'destination',
  'amount',
  'asset_code',
  'asset_issuer',
  'memo',
  'memo_type',
  'callback',
  'msg',
  'network_passphrase',
  'origin_domain',
  'signature',
];

export type Sep7Operation = 'tx' | 'pay';
export type Sep7MemoType = (typeof SEP7_MEMO_TYPES)[number];

export type Sep7ErrorCode =
  | 'INVALID_SCHEME'
  | 'UNSUPPORTED_OPERATION'
  | 'DUPLICATE_PARAM'
  | 'MALFORMED_ENCODING'
  | 'MISSING_PARAM'
  | 'INVALID_PARAM'
  | 'INVALID_SIGNATURE'
  | 'UNSUPPORTED_ENVIRONMENT';

export interface Sep7Issue {
  code: Sep7ErrorCode;
  param?: string;
  message: string;
}

export class Sep7Error extends Error {
  readonly issues: Sep7Issue[];

  constructor(issues: Sep7Issue[]) {
    super(issues.map((issue) => issue.message).join('; '));
    this.name = 'Sep7Error';
    this.issues = issues;
  }

  get code(): Sep7ErrorCode {
    return this.issues[0].code;
  }
}

interface Sep7CommonRequest {
  /** Callback URL; the `url:` prefix is added when missing. */
  callback?: string;
  msg?: string;
  networkPassphrase?: string;
  originDomain?: string;
}

export interface Sep7TxRequest extends Sep7CommonRequest {
  xdr: string;
  replace?: string;
  pubkey?: string;
  chain?: string;
}

export interface Sep7PayRequest extends Sep7CommonRequest {
  destination: string;
  amount?: string;
  assetCode?: string;
  assetIssuer?: string;
  memo?: string;
  memoType?: Sep7MemoType;
}

export interface Sep7ParsedUri {
  operation: Sep7Operation;
  /** Decoded parameter values, keyed by their SEP-0007 names. */
  params: Record<string, string>;
  /** Parameters the spec does not define for this operation. */
  unknownParams: string[];
}

export type Sep7ValidationResult =
  | { valid: true; request: Sep7ParsedUri; issues: [] }
  | { valid: false; request: Sep7ParsedUri | null; issues: Sep7Issue[] };

// ---------------------------------------------------------------------------
// Building
// ---------------------------------------------------------------------------

function withUrlPrefix(callback: string): string {
  return callback.startsWith('url:') ? callback : `url:${callback}`;
}

function serialize(operation: Sep7Operation, entries: Array<[string, string | undefined]>): string {
  const query = entries
    .filter(([, value]) => value !== undefined && value !== '')
    .map(([key, value]) => `${key}=${encodeURIComponent(value as string)}`)
    .join('&');
  return `${SEP7_SCHEME}${operation}?${query}`;
}

/**
 * Build a `web+stellar:tx` URI asking a wallet to sign a transaction envelope.
 * Throws a Sep7Error when the request would produce an invalid URI.
 *
 * When `originDomain` is set, pass the result to `signSep7Uri` before handing
 * it to a wallet: wallets reject an `origin_domain` without a `signature`.
 */
export function buildSep7TxUri(request: Sep7TxRequest): string {
  const uri = serialize('tx', [
    ['xdr', request.xdr],
    ['replace', request.replace],
    ['callback', request.callback ? withUrlPrefix(request.callback) : undefined],
    ['pubkey', request.pubkey],
    ['chain', request.chain],
    ['msg', request.msg],
    ['network_passphrase', request.networkPassphrase],
    ['origin_domain', request.originDomain],
  ]);
  assertBuildable(uri);
  return uri;
}

/**
 * Build a `web+stellar:pay` URI requesting a payment to `destination`.
 * Throws a Sep7Error when the request would produce an invalid URI.
 */
export function buildSep7PayUri(request: Sep7PayRequest): string {
  const memoType = request.memo !== undefined && !request.memoType ? 'MEMO_TEXT' : request.memoType;
  const uri = serialize('pay', [
    ['destination', request.destination],
    ['amount', request.amount],
    ['asset_code', request.assetCode],
    ['asset_issuer', request.assetIssuer],
    ['memo', request.memo],
    ['memo_type', memoType],
    ['callback', request.callback ? withUrlPrefix(request.callback) : undefined],
    ['msg', request.msg],
    ['network_passphrase', request.networkPassphrase],
    ['origin_domain', request.originDomain],
  ]);
  assertBuildable(uri);
  return uri;
}

function assertBuildable(uri: string): void {
  // An unsigned origin_domain is expected at build time; signing comes next.
  const result = validateSep7Uri(uri, { allowUnsignedOrigin: true });
  if (!result.valid) {
    throw new Sep7Error(result.issues);
  }
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

/**
 * Split a SEP-0007 URI into its operation and decoded params.
 * Throws a Sep7Error for structural problems (scheme, operation, encoding,
 * duplicate params); use `validateSep7Uri` for the per-field rules.
 *
 * `+` is kept literal rather than read as a space: base64 XDR contains `+`
 * and SEP-0007 encodes spaces as `%20`.
 */
export function parseSep7Uri(uri: string): Sep7ParsedUri {
  if (typeof uri !== 'string' || !uri.startsWith(SEP7_SCHEME)) {
    throw new Sep7Error([
      { code: 'INVALID_SCHEME', message: `URI must start with "${SEP7_SCHEME}"` },
    ]);
  }

  const rest = uri.slice(SEP7_SCHEME.length);
  const queryStart = rest.indexOf('?');
  const operation = queryStart === -1 ? rest : rest.slice(0, queryStart);
  if (operation !== 'tx' && operation !== 'pay') {
    throw new Sep7Error([
      { code: 'UNSUPPORTED_OPERATION', message: `Unsupported SEP-0007 operation "${operation}"` },
    ]);
  }

  // Null prototype so keys like `__proto__` are stored as plain params.
  const params: Record<string, string> = Object.create(null);
  const query = queryStart === -1 ? '' : rest.slice(queryStart + 1);
  for (const pair of query.split('&').filter(Boolean)) {
    const eq = pair.indexOf('=');
    const key = eq === -1 ? pair : pair.slice(0, eq);
    const rawValue = eq === -1 ? '' : pair.slice(eq + 1);
    if (Object.prototype.hasOwnProperty.call(params, key)) {
      throw new Sep7Error([
        {
          code: 'DUPLICATE_PARAM',
          param: key,
          message: `Parameter "${key}" appears more than once`,
        },
      ]);
    }
    try {
      params[key] = decodeURIComponent(rawValue);
    } catch {
      throw new Sep7Error([
        {
          code: 'MALFORMED_ENCODING',
          param: key,
          message: `Parameter "${key}" is not valid URL encoding`,
        },
      ]);
    }
  }

  const known = operation === 'tx' ? TX_PARAMS : PAY_PARAMS;
  return {
    operation,
    params,
    unknownParams: Object.keys(params).filter((key) => !known.includes(key)),
  };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export interface Sep7ValidateOptions {
  /**
   * Accept `origin_domain` without `signature`. Wallets must reject such
   * requests, so only builders set this before signing.
   */
  allowUnsignedOrigin?: boolean;
  /** Internal: nesting level while following `chain`. */
  depth?: number;
}

/**
 * Validate a SEP-0007 URI against the field rules of the spec.
 * Never throws; returns every problem found.
 *
 * This checks structure only. A present `signature` is not verified here,
 * because that needs the domain's URI_REQUEST_SIGNING_KEY from stellar.toml;
 * use `verifySep7Signature` for that.
 */
export function validateSep7Uri(
  uri: string,
  options: Sep7ValidateOptions = {}
): Sep7ValidationResult {
  let request: Sep7ParsedUri;
  try {
    request = parseSep7Uri(uri);
  } catch (error) {
    return { valid: false, request: null, issues: (error as Sep7Error).issues };
  }

  const issues: Sep7Issue[] = [
    ...(request.operation === 'tx'
      ? validateTxParams(request.params, options)
      : validatePayParams(request.params)),
    ...validateCommonParams(uri, request.params, options),
  ];

  return issues.length === 0
    ? { valid: true, request, issues: [] }
    : { valid: false, request, issues };
}

function invalid(param: string, message: string): Sep7Issue {
  return { code: 'INVALID_PARAM', param, message };
}

function missing(param: string): Sep7Issue {
  return { code: 'MISSING_PARAM', param, message: `Parameter "${param}" is required` };
}

function validateTxParams(
  params: Record<string, string>,
  options: Sep7ValidateOptions
): Sep7Issue[] {
  const issues: Sep7Issue[] = [];

  if (!params.xdr) {
    issues.push(missing('xdr'));
  } else if (!isTransactionEnvelope(params.xdr)) {
    issues.push(invalid('xdr', 'xdr is not a base64 TransactionEnvelope'));
  }

  if (params.replace !== undefined && !isBalancedReplace(params.replace)) {
    issues.push(invalid('replace', 'replace identifiers must match on both sides of ";"'));
  }

  if (params.pubkey !== undefined && !StrKey.isValidEd25519PublicKey(params.pubkey)) {
    issues.push(invalid('pubkey', 'pubkey is not a valid Stellar public key'));
  }

  if (params.chain !== undefined) {
    const depth = (options.depth ?? 0) + 1;
    if (depth > SEP7_MAX_CHAIN_DEPTH) {
      issues.push(invalid('chain', `chain is nested more than ${SEP7_MAX_CHAIN_DEPTH} levels`));
    } else {
      const nested = validateSep7Uri(params.chain, { depth });
      if (!nested.valid) {
        issues.push(
          invalid('chain', `chain is not a valid SEP-0007 request: ${nested.issues[0].message}`)
        );
      }
    }
  }

  return issues;
}

function validatePayParams(params: Record<string, string>): Sep7Issue[] {
  const issues: Sep7Issue[] = [];

  if (!params.destination) {
    issues.push(missing('destination'));
  } else if (!isPaymentDestination(params.destination)) {
    issues.push(
      invalid(
        'destination',
        'destination is not an account ID, muxed account or federation address'
      )
    );
  }

  if (params.amount !== undefined && !isValidAmount(params.amount)) {
    issues.push(
      invalid(
        'amount',
        `amount must be a positive number with at most 7 decimals, up to ${MAX_AMOUNT}`
      )
    );
  }

  issues.push(...validateAsset(params.asset_code, params.asset_issuer));
  issues.push(...validateMemo(params.memo, params.memo_type));
  return issues;
}

function validateAsset(code: string | undefined, issuer: string | undefined): Sep7Issue[] {
  if (code === undefined) {
    return issuer === undefined
      ? []
      : [invalid('asset_issuer', 'asset_issuer requires asset_code')];
  }
  if (!/^[a-zA-Z0-9]{1,12}$/.test(code)) {
    return [invalid('asset_code', 'asset_code must be 1-12 alphanumeric characters')];
  }
  if (issuer === undefined) {
    return code === 'XLM' ? [] : [missing('asset_issuer')];
  }
  return StrKey.isValidEd25519PublicKey(issuer)
    ? []
    : [invalid('asset_issuer', 'asset_issuer is not a valid Stellar public key')];
}

function validateMemo(memo: string | undefined, memoType: string | undefined): Sep7Issue[] {
  if (memoType !== undefined && !(SEP7_MEMO_TYPES as readonly string[]).includes(memoType)) {
    return [invalid('memo_type', `memo_type must be one of ${SEP7_MEMO_TYPES.join(', ')}`)];
  }
  if (memo === undefined) {
    return memoType === undefined ? [] : [missing('memo')];
  }

  switch (memoType ?? 'MEMO_TEXT') {
    case 'MEMO_TEXT':
      return new TextEncoder().encode(memo).length <= MEMO_TEXT_MAX_BYTES
        ? []
        : [invalid('memo', `MEMO_TEXT must be at most ${MEMO_TEXT_MAX_BYTES} bytes`)];
    case 'MEMO_ID':
      return /^\d+$/.test(memo) && BigInt(memo) <= MAX_UINT64
        ? []
        : [invalid('memo', 'MEMO_ID must be an unsigned 64-bit integer')];
    default:
      return base64ByteLength(memo) === MEMO_HASH_BYTES
        ? []
        : [invalid('memo', `${memoType} must be base64 encoding ${MEMO_HASH_BYTES} bytes`)];
  }
}

function validateCommonParams(
  uri: string,
  params: Record<string, string>,
  options: Sep7ValidateOptions
): Sep7Issue[] {
  const issues: Sep7Issue[] = [];

  if (params.callback !== undefined && !isValidCallback(params.callback)) {
    issues.push(
      invalid(
        'callback',
        'callback must be "url:" followed by an https URL (http only for localhost)'
      )
    );
  }

  if (params.msg !== undefined && params.msg.length > SEP7_MSG_MAX_LENGTH) {
    issues.push(invalid('msg', `msg must be at most ${SEP7_MSG_MAX_LENGTH} characters`));
  }

  if (params.network_passphrase !== undefined && params.network_passphrase.trim() === '') {
    issues.push(invalid('network_passphrase', 'network_passphrase must not be empty'));
  }

  if (params.origin_domain !== undefined) {
    if (!isFullyQualifiedDomain(params.origin_domain)) {
      issues.push(invalid('origin_domain', 'origin_domain is not a fully qualified domain name'));
    }
    if (params.signature === undefined && !options.allowUnsignedOrigin) {
      issues.push(missing('signature'));
    }
  }

  if (params.signature !== undefined) {
    if (params.origin_domain === undefined) {
      issues.push(invalid('signature', 'signature requires origin_domain'));
    }
    if (!splitSignature(uri)) {
      issues.push(invalid('signature', 'signature must be the last parameter'));
    }
    if (base64ByteLength(params.signature) !== ED25519_SIGNATURE_BYTES) {
      issues.push(invalid('signature', 'signature must be a base64 ed25519 signature'));
    }
  }

  return issues;
}

function isTransactionEnvelope(value: string): boolean {
  try {
    StellarXdr.TransactionEnvelope.fromXDR(value, 'base64');
    return true;
  } catch {
    return false;
  }
}

function isBalancedReplace(value: string): boolean {
  const parts = value.split(';');
  if (parts.length !== 2) return false;

  const fieldRefs = parts[0].split(',').map((entry) => entry.split(':'));
  const hintRefs = parts[1].split(',').map((entry) => entry.split(':'));
  if ([...fieldRefs, ...hintRefs].some((pair) => pair.length < 2 || !pair[0] || !pair[1])) {
    return false;
  }

  const used = new Set(fieldRefs.map(([, ref]) => ref));
  const hinted = new Set(hintRefs.map(([ref]) => ref));
  return used.size === hinted.size && [...used].every((ref) => hinted.has(ref));
}

function isPaymentDestination(value: string): boolean {
  if (StrKey.isValidEd25519PublicKey(value) || StrKey.isValidMed25519PublicKey(value)) {
    return true;
  }
  const [name, domain, ...extra] = value.split('*');
  return extra.length === 0 && !!name && domain !== undefined && isFullyQualifiedDomain(domain);
}

function isValidAmount(value: string): boolean {
  const match = /^(\d{1,12})(?:\.(\d{1,7}))?$/.exec(value);
  if (!match) return false;
  const stroops = BigInt(match[1] + (match[2] ?? '').padEnd(7, '0'));
  return stroops > BigInt(0) && stroops <= BigInt(MAX_AMOUNT.replace('.', ''));
}

function isValidCallback(value: string): boolean {
  if (!value.startsWith('url:')) return false;
  let url: URL;
  try {
    url = new URL(value.slice('url:'.length));
  } catch {
    return false;
  }
  // The wallet POSTs the signed XDR here, so plain http is only allowed for local development.
  return (
    url.protocol === 'https:' || (url.protocol === 'http:' && LOCAL_HOSTS.includes(url.hostname))
  );
}

function isFullyQualifiedDomain(value: string): boolean {
  if (value.length > 253) return false;
  const labels = value.replace(/\.$/, '').split('.');
  return (
    labels.length >= 2 &&
    labels.every((label) => /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/.test(label)) &&
    /[a-zA-Z]/.test(labels[labels.length - 1])
  );
}

function base64ByteLength(value: string): number {
  try {
    return base64ToBytes(value).length;
  } catch {
    return -1;
  }
}

// ---------------------------------------------------------------------------
// Request signing
// ---------------------------------------------------------------------------

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(value) || value.length % 4 !== 0) {
    throw new Error('not base64');
  }
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

/** Payload per SEP-0007: 35 zero bytes, a 4, then the prefix and the URI. */
function signaturePayload(unsignedUri: string): Uint8Array {
  const text = new TextEncoder().encode(SIGNATURE_PREFIX + unsignedUri);
  const payload = new Uint8Array(36 + text.length);
  payload[35] = 4;
  payload.set(text, 36);
  return payload;
}

/** Split `...&signature=<value>` off the end of a URI; null if not last. */
function splitSignature(uri: string): { unsigned: string; signature: string } | null {
  const marker = '&signature=';
  const index = uri.lastIndexOf(marker);
  if (index === -1) return null;
  const encoded = uri.slice(index + marker.length);
  if (encoded.includes('&')) return null;
  try {
    return { unsigned: uri.slice(0, index), signature: decodeURIComponent(encoded) };
  } catch {
    return null;
  }
}

/**
 * Sign a SEP-0007 URI with the secret matching the origin domain's
 * URI_REQUEST_SIGNING_KEY and append `signature` as the last param.
 */
export function signSep7Uri(uri: string, signer: Keypair): string {
  const request = parseSep7Uri(uri);
  if (request.params.signature !== undefined) {
    throw new Sep7Error([invalid('signature', 'URI is already signed')]);
  }
  if (!request.params.origin_domain) {
    throw new Sep7Error([missing('origin_domain')]);
  }
  if (!signer.canSign()) {
    throw new Sep7Error([invalid('signature', 'signing keypair has no secret key')]);
  }

  const signature = signer.sign(Buffer.from(signaturePayload(uri)));
  return `${uri}&signature=${encodeURIComponent(bytesToBase64(signature))}`;
}

/**
 * Check a signed SEP-0007 URI against a URI_REQUEST_SIGNING_KEY.
 * Returns false for unsigned, malformed or tampered URIs.
 *
 * Fetching stellar.toml from `origin_domain` to get the key, and alerting the
 * user when that key changes, is the caller's job.
 */
export function verifySep7Signature(uri: string, signingKey: string): boolean {
  if (!StrKey.isValidEd25519PublicKey(signingKey)) return false;

  const parts = splitSignature(uri);
  if (!parts) return false;

  let signature: Uint8Array;
  try {
    signature = base64ToBytes(parts.signature);
  } catch {
    return false;
  }
  if (signature.length !== ED25519_SIGNATURE_BYTES) return false;

  try {
    // stellar-base's verify calls Buffer#toJSON on the signature, so a plain Uint8Array won't do.
    return Keypair.fromPublicKey(signingKey).verify(
      Buffer.from(signaturePayload(parts.unsigned)),
      Buffer.from(signature)
    );
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Handoff
// ---------------------------------------------------------------------------

/**
 * Hand a SEP-0007 URI to the wallet registered for `web+stellar:`.
 * Validates first so a broken request never reaches the wallet.
 */
export function openSep7Uri(uri: string): void {
  if (typeof window === 'undefined' || !window.location) {
    throw new Sep7Error([
      {
        code: 'UNSUPPORTED_ENVIRONMENT',
        message: 'Opening a SEP-0007 URI requires a browser environment',
      },
    ]);
  }
  const result = validateSep7Uri(uri);
  if (!result.valid) {
    throw new Sep7Error(result.issues);
  }
  window.location.href = uri;
}
