/**
 * #972 — SEP-0001 stellar.toml Inspector and Validator
 *
 * Fetches a domain's `/.well-known/stellar.toml`, reports transport-level
 * diagnostics (HTTPS, CORS, content type, size), validates it against the
 * SEP-1 field requirements, and cross-checks `[[CURRENCIES]]` entries
 * against Horizon.
 *
 * Reuses anchorService.parseToml() (src/lib/anchors.ts) for TOML parsing,
 * validateEndpointUrl() (src/lib/endpointAllowlist.ts) for the #836
 * anti-phishing allowlist, and fetchAccount()/getServer() (src/lib/stellar.ts)
 * for the Horizon cross-check.
 */
import anchorService from './anchors';
import { validateEndpointUrl, type EndpointValidationResult } from './endpointAllowlist';
import { fetchAccount, type NetworkName } from './stellar';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface TomlTransportInfo {
  url: string;
  https: boolean;
  status: number;
  ok: boolean;
  corsHeaderPresent: boolean;
  corsHeaderValue: string | null;
  contentType: string | null;
  sizeBytes: number;
  fetchDurationMs: number;
}

export type TomlFieldSeverity = 'error' | 'warning';

export interface TomlFieldIssue {
  field: string;
  message: string;
  severity: TomlFieldSeverity;
}

export interface TomlEndpointCheck {
  field: string;
  value: string;
  validation: EndpointValidationResult;
}

export interface CurrencyCrossCheck {
  code: string | undefined;
  issuer: string | undefined;
  issuerExists: boolean;
  homeDomainMatches: boolean | null;
  issuerHomeDomain: string | null;
  mismatchReason: string | null;
}

export interface StellarTomlInspection {
  domain: string;
  network: NetworkName;
  transport: TomlTransportInfo;
  raw: string;
  parsed: Record<string, unknown>;
  fieldIssues: TomlFieldIssue[];
  endpointChecks: TomlEndpointCheck[];
  currencyChecks: CurrencyCrossCheck[];
  isValid: boolean;
  inspectedAt: string;
}

// ─── SEP-1 required/known fields ───────────────────────────────────────────

/**
 * SEP-1 top-level fields this inspector understands. Not exhaustive of the
 * spec, but covers the fields most integration issues trace back to.
 */
const KNOWN_ENDPOINT_FIELDS = [
  'WEB_AUTH_ENDPOINT',
  'TRANSFER_SERVER',
  'TRANSFER_SERVER_SEP0024',
  'KYC_SERVER',
  'DIRECT_PAYMENT_SERVER',
  'ANCHOR_QUOTE_SERVER',
] as const;

function isValidStellarPublicKey(value: unknown): boolean {
  return typeof value === 'string' && /^G[A-Z2-7]{55}$/.test(value);
}

function validateNetworkPassphrase(toml: Record<string, unknown>): TomlFieldIssue[] {
  const issues: TomlFieldIssue[] = [];
  const passphrase = toml.NETWORK_PASSPHRASE;
  if (passphrase === undefined) {
    issues.push({
      field: 'NETWORK_PASSPHRASE',
      message: 'NETWORK_PASSPHRASE is missing. Wallets cannot confirm which network this file describes.',
      severity: 'warning',
    });
  } else if (typeof passphrase !== 'string' || !passphrase.trim()) {
    issues.push({
      field: 'NETWORK_PASSPHRASE',
      message: 'NETWORK_PASSPHRASE must be a non-empty string.',
      severity: 'error',
    });
  }
  return issues;
}

function validateSigningKey(toml: Record<string, unknown>): TomlFieldIssue[] {
  const issues: TomlFieldIssue[] = [];
  const signingKey = toml.SIGNING_KEY;
  if (signingKey === undefined) {
    issues.push({
      field: 'SIGNING_KEY',
      message: 'SIGNING_KEY is missing. SEP-10 authentication and response verification will not be possible.',
      severity: 'warning',
    });
  } else if (!isValidStellarPublicKey(signingKey)) {
    issues.push({
      field: 'SIGNING_KEY',
      message: 'SIGNING_KEY is not a valid Stellar public key (expected a 56-character "G..." address).',
      severity: 'error',
    });
  }
  return issues;
}

function validateVersion(toml: Record<string, unknown>): TomlFieldIssue[] {
  const issues: TomlFieldIssue[] = [];
  if (toml.VERSION !== undefined && typeof toml.VERSION !== 'string') {
    issues.push({
      field: 'VERSION',
      message: 'VERSION should be a string (e.g. "2.7.0").',
      severity: 'warning',
    });
  }
  return issues;
}

function validateCurrencies(toml: Record<string, unknown>): TomlFieldIssue[] {
  const issues: TomlFieldIssue[] = [];
  const currencies = toml.CURRENCIES;
  if (!Array.isArray(currencies)) return issues;

  currencies.forEach((currency, index) => {
    if (typeof currency !== 'object' || currency === null) {
      issues.push({
        field: `CURRENCIES[${index}]`,
        message: 'Currency entry is not a valid table.',
        severity: 'error',
      });
      return;
    }
    const entry = currency as Record<string, unknown>;
    if (!entry.code) {
      issues.push({
        field: `CURRENCIES[${index}].code`,
        message: 'Currency entry is missing a "code" field.',
        severity: 'error',
      });
    }
    if (!entry.issuer) {
      issues.push({
        field: `CURRENCIES[${index}].issuer`,
        message: 'Currency entry is missing an "issuer" field.',
        severity: 'error',
      });
    } else if (!isValidStellarPublicKey(entry.issuer)) {
      issues.push({
        field: `CURRENCIES[${index}].issuer`,
        message: `Issuer "${String(entry.issuer)}" is not a valid Stellar public key.`,
        severity: 'error',
      });
    }
  });

  return issues;
}

/** Validates SEP-1 required/known fields. Field-level, no network calls. */
export function validateSep1Fields(toml: Record<string, unknown>): TomlFieldIssue[] {
  return [
    ...validateNetworkPassphrase(toml),
    ...validateSigningKey(toml),
    ...validateVersion(toml),
    ...validateCurrencies(toml),
  ];
}

/**
 * Validates every known SEP endpoint URL found in the parsed TOML against
 * the #836 anti-phishing allowlist (validateEndpointUrl), keyed by home
 * domain.
 */
export function checkEndpointsAgainstAllowlist(
  toml: Record<string, unknown>,
  homeDomain: string
): TomlEndpointCheck[] {
  const checks: TomlEndpointCheck[] = [];
  for (const field of KNOWN_ENDPOINT_FIELDS) {
    const value = toml[field];
    if (typeof value !== 'string' || !value.trim()) continue;
    checks.push({
      field,
      value,
      validation: validateEndpointUrl(value, homeDomain),
    });
  }
  return checks;
}

/**
 * Cross-checks each `[[CURRENCIES]]` entry's issuer against Horizon:
 * confirms the issuer account exists and that its `home_domain` matches
 * the domain being inspected.
 */
export async function crossCheckCurrenciesAgainstHorizon(
  toml: Record<string, unknown>,
  domain: string,
  network: NetworkName
): Promise<CurrencyCrossCheck[]> {
  const currencies = Array.isArray(toml.CURRENCIES) ? toml.CURRENCIES : [];
  const results: CurrencyCrossCheck[] = [];

  for (const currency of currencies) {
    if (typeof currency !== 'object' || currency === null) continue;
    const entry = currency as Record<string, unknown>;
    const code = typeof entry.code === 'string' ? entry.code : undefined;
    const issuer = typeof entry.issuer === 'string' ? entry.issuer : undefined;

    if (!issuer || !isValidStellarPublicKey(issuer)) {
      results.push({
        code,
        issuer,
        issuerExists: false,
        homeDomainMatches: null,
        issuerHomeDomain: null,
        mismatchReason: 'Issuer is missing or not a valid public key; skipped Horizon lookup.',
      });
      continue;
    }

    try {
      const account = await fetchAccount(issuer, network);
      const issuerHomeDomain = account.home_domain ?? null;
      const homeDomainMatches = issuerHomeDomain
        ? issuerHomeDomain.toLowerCase() === domain.toLowerCase()
        : null;
      results.push({
        code,
        issuer,
        issuerExists: true,
        homeDomainMatches,
        issuerHomeDomain,
        mismatchReason:
          homeDomainMatches === false
            ? `Issuer's home_domain ("${issuerHomeDomain}") does not match "${domain}".`
            : homeDomainMatches === null
              ? 'Issuer account has no home_domain set.'
              : null,
      });
    } catch {
      results.push({
        code,
        issuer,
        issuerExists: false,
        homeDomainMatches: null,
        issuerHomeDomain: null,
        mismatchReason: `Issuer account "${issuer}" was not found on ${network}.`,
      });
    }
  }

  return results;
}

/**
 * Fetches `/.well-known/stellar.toml` for `domain` directly (not through
 * anchorService.fetchStellarToml, which discards transport metadata) so we
 * can report HTTPS use, the CORS header, content type, and payload size.
 */
async function fetchTomlWithTransportInfo(domain: string): Promise<{ transport: TomlTransportInfo; raw: string }> {
  const url = `https://${domain}/.well-known/stellar.toml`;
  const start = performance.now();
  const response = await fetch(url, { method: 'GET', headers: { Accept: 'text/plain' } });
  const fetchDurationMs = Math.round(performance.now() - start);
  const raw = await response.text();

  const transport: TomlTransportInfo = {
    url,
    https: true, // this inspector only ever requests https:// — see note below
    status: response.status,
    ok: response.ok,
    corsHeaderPresent: response.headers.has('access-control-allow-origin'),
    corsHeaderValue: response.headers.get('access-control-allow-origin'),
    contentType: response.headers.get('content-type'),
    sizeBytes: new TextEncoder().encode(raw).length,
    fetchDurationMs,
  };

  if (!response.ok) {
    throw new Error(`Fetching stellar.toml for ${domain} failed with HTTP ${response.status}.`);
  }

  return { transport, raw };
}

/**
 * Runs the full SEP-1 inspection for a home domain: fetch, transport
 * diagnostics, SEP-1 field validation, endpoint-allowlist checks, and a
 * Horizon cross-check of `[[CURRENCIES]]` issuers.
 */
export async function inspectStellarToml(
  domain: string,
  network: NetworkName = 'testnet'
): Promise<StellarTomlInspection> {
  const trimmedDomain = domain.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
  if (!trimmedDomain) {
    throw new Error('A home domain is required to inspect a stellar.toml file.');
  }

  const { transport, raw } = await fetchTomlWithTransportInfo(trimmedDomain);
  const parsed = anchorService.parseToml(raw) as Record<string, unknown>;

  const fieldIssues = validateSep1Fields(parsed);
  const endpointChecks = checkEndpointsAgainstAllowlist(parsed, trimmedDomain);
  const currencyChecks = await crossCheckCurrenciesAgainstHorizon(parsed, trimmedDomain, network);

  const hasBlockedEndpoint = endpointChecks.some((check) => !check.validation.allowed);
  const hasFieldError = fieldIssues.some((issue) => issue.severity === 'error');

  return {
    domain: trimmedDomain,
    network,
    transport,
    raw,
    parsed,
    fieldIssues,
    endpointChecks,
    currencyChecks,
    isValid: !hasFieldError && !hasBlockedEndpoint,
    inspectedAt: new Date().toISOString(),
  };
}

/** Serializes an inspection result to a JSON string for export. */
export function exportInspectionAsJson(inspection: StellarTomlInspection): string {
  const { raw: _raw, ...exportable } = inspection;
  return JSON.stringify(exportable, null, 2);
}
