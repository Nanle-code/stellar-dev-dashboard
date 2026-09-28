export interface EndpointValidationResult {
  allowed: boolean;
  hostname?: string;
  reason?: string;
}

const DOMAIN_PATTERN = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;

function normalizeDomain(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  let candidate = value.trim().toLowerCase();
  if (!candidate) return null;
  candidate = candidate.replace(/^\*\./, '').replace(/\.$/, '');
  try {
    if (candidate.includes('://')) candidate = new URL(candidate).hostname;
  } catch {
    return null;
  }
  return DOMAIN_PATTERN.test(candidate) ? candidate : null;
}

export function configuredEndpointDomains(): string[] {
  const raw = (import.meta as ImportMeta & { env?: Record<string, unknown> }).env
    ?.VITE_STELLAR_ENDPOINT_ALLOWLIST;
  if (typeof raw !== 'string') return [];
  return raw.split(',').map(normalizeDomain).filter((domain): domain is string => Boolean(domain));
}

export function validateEndpointUrl(
  endpoint: unknown,
  homeDomain: unknown,
  additionalDomains: readonly string[] = configuredEndpointDomains()
): EndpointValidationResult {
  if (typeof endpoint !== 'string' || !endpoint.trim()) {
    return { allowed: false, reason: 'Endpoint URL is missing or invalid.' };
  }
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return { allowed: false, reason: 'Endpoint URL is malformed.' };
  }
  if (url.protocol !== 'https:') {
    return { allowed: false, hostname: url.hostname, reason: 'Only HTTPS endpoints are supported.' };
  }
  if (url.username || url.password) {
    return { allowed: false, hostname: url.hostname, reason: 'Endpoint URLs must not contain credentials.' };
  }
  const hostname = normalizeDomain(url.hostname);
  if (!hostname) return { allowed: false, reason: 'Endpoint hostname is invalid.' };
  const allowedDomains = [homeDomain, ...additionalDomains]
    .map(normalizeDomain)
    .filter((domain): domain is string => Boolean(domain));
  if (allowedDomains.length === 0) {
    return { allowed: false, hostname, reason: 'No valid endpoint domains are configured.' };
  }
  const allowed = allowedDomains.some(domain => hostname === domain || hostname.endsWith('.' + domain));
  return allowed
    ? { allowed: true, hostname }
    : { allowed: false, hostname, reason: 'Domain ' + hostname + ' is not on the endpoint allowlist.' };
}

export function requireAllowedEndpoint(
  endpoint: unknown,
  homeDomain: unknown,
  kind: string,
  additionalDomains?: readonly string[]
): URL {
  const result = validateEndpointUrl(endpoint, homeDomain, additionalDomains);
  if (!result.allowed) {
    const message = 'Blocked unexpected ' + kind + ' endpoint: ' + result.reason;
    console.warn(message, { endpoint, homeDomain });
    throw new Error(message);
  }
  return new URL(endpoint as string);
}
