import * as StellarSdk from '@stellar/stellar-sdk';
import { Cache, TTL } from '../cache.js';
import { rateLimiter } from '../rateLimiter.js';
import auditTrail from '../auditTrail.js';
import { getCircuitBreaker, type CircuitState } from '../errorHandling/CircuitBreaker';

// ─── Cache setup ──────────────────────────────────────────────────────────────

const stellarCache = new Cache({
  namespace: 'stellar',
  persist: true,
  maxSize: 500,
  defaultTTL: TTL.ACCOUNT,
});

export { stellarCache };

// ─── Network config ───────────────────────────────────────────────────────────

export type NetworkName = 'mainnet' | 'testnet' | 'futurenet' | 'local' | 'custom';


export interface NetworkConfig {
  name: string;
  horizonUrl: string;
  sorobanUrl?: string;
  passphrase: string;
  faucetUrl?: string;
  customHeaders?: Record<string, string>;
  headers?: Record<string, string>;
  capabilities?: import('./types').NetworkCapabilities;
}

export const NETWORKS: Record<NetworkName, NetworkConfig> = {
  mainnet: {
    name: 'Mainnet',
    horizonUrl: 'https://horizon.stellar.org',
    sorobanUrl: 'https://soroban-rpc.stellar.org',
    passphrase: StellarSdk.Networks.PUBLIC,
    capabilities: {
      ledgers: true,
      transactions: true,
      events: true,
      accountOffers: true,
      fullHistory: true,
      defaultReadSource: 'rpc',
    },
  },
  testnet: {
    name: 'Testnet',
    horizonUrl: 'https://horizon-testnet.stellar.org',
    sorobanUrl: 'https://soroban-testnet.stellar.org',
    passphrase: StellarSdk.Networks.TESTNET,
    faucetUrl: 'https://friendbot.stellar.org',
    capabilities: {
      ledgers: true,
      transactions: true,
      events: true,
      accountOffers: true,
      fullHistory: true,
      defaultReadSource: 'rpc',
    },
  },
  futurenet: {
    name: 'Futurenet',
    horizonUrl: 'https://horizon-futurenet.stellar.org',
    sorobanUrl: 'https://soroban-futurenet.stellar.org',
    passphrase: StellarSdk.Networks.FUTURENET,
    faucetUrl: 'https://friendbot-futurenet.stellar.org',
    capabilities: {
      ledgers: true,
      transactions: true,
      events: true,
      accountOffers: true,
      fullHistory: true,
      defaultReadSource: 'rpc',
    },
  },
  local: {
    name: 'Local',
    horizonUrl: 'http://localhost:8000',
    sorobanUrl: 'http://localhost:8000/soroban/rpc',
    passphrase: 'Standalone Network ; February 2017',
    capabilities: {
      ledgers: true,
      transactions: true,
      events: true,
      accountOffers: true,
      fullHistory: true,
      defaultReadSource: 'rpc',
    },
  },
  custom: {
    name: 'Custom',
    horizonUrl: '',
    sorobanUrl: '',
    passphrase: '',
    headers: {},
    capabilities: {
      ledgers: true,
      transactions: true,
      events: true,
      accountOffers: true,
      fullHistory: true,
      defaultReadSource: 'rpc',
    },
  },
};

const CUSTOM_NETWORK_HEADERS_KEY = 'stellar-custom-network-headers';

function getSessionStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  return window.sessionStorage || null;
}

function normalizeHeaders(headers: Record<string, string> = {}): Record<string, string> {
  return Object.entries(headers).reduce<Record<string, string>>((acc, [name, value]) => {
    const trimmedName = String(name || '').trim();
    const trimmedValue = String(value || '').trim();
    if (trimmedName && trimmedValue) {
      acc[trimmedName] = trimmedValue;
    }
    return acc;
  }, {});
}

export function getCustomNetworkAuthHeaders(): Record<string, string> {
  const storage = getSessionStorage();
  if (!storage) return NETWORKS.custom.headers || {};

  try {
    const raw = storage.getItem(CUSTOM_NETWORK_HEADERS_KEY);
    const headers = raw ? normalizeHeaders(JSON.parse(raw)) : {};
    NETWORKS.custom.headers = headers;
    return headers;
  } catch {
    return NETWORKS.custom.headers || {};
  }
}

function saveCustomNetworkAuthHeaders(headers: Record<string, string>) {
  const normalized = normalizeHeaders(headers);
  NETWORKS.custom.headers = normalized;

  const storage = getSessionStorage();
  if (!storage) return;

  if (Object.keys(normalized).length) {
    storage.setItem(CUSTOM_NETWORK_HEADERS_KEY, JSON.stringify(normalized));
  } else {
    storage.removeItem(CUSTOM_NETWORK_HEADERS_KEY);
  }
}

function getNetworkHeaders(network: NetworkName): Record<string, string> {
  if (network === 'custom') return getCustomNetworkAuthHeaders();
  return NETWORKS[network].headers || {};
}

export function withNetworkHeaders(options: RequestInit = {}, network: NetworkName): RequestInit {
  const headers = getNetworkHeaders(network);
  if (!Object.keys(headers).length) return options;

  return {
    ...options,
    headers: {
      ...(options.headers as Record<string, string> | undefined),
      ...headers,
    },
  };
}

function getServerOptions(network: NetworkName) {
  const headers = getNetworkHeaders(network);
  return Object.keys(headers).length ? { headers } : undefined;
}

// ─── Rate Limited Fetch Wrapper ───────────────────────────────────────────────

export async function rateLimitedFetch(
  url: string,
  options?: RequestInit,
  priority: 'high' | 'medium' | 'low' = 'medium',
  extraHeaders?: Record<string, string>
): Promise<Response> {
  const startTime = Date.now();

  // Merge custom network headers (e.g. API keys) without mutating caller options
  const mergedOptions: RequestInit =
    extraHeaders && Object.keys(extraHeaders).length > 0
      ? {
          ...options,
          headers: { ...(options?.headers as Record<string, string> | undefined), ...extraHeaders },
        }
      : (options ?? {});

  try {
    // Log the API call (options without secret headers — sanitized by auditTrail)
    auditTrail.logAPICall(url, mergedOptions.method || 'GET', mergedOptions, {});

    // Check rate limits first
    const check = rateLimiter.checkRequest('stellar_client', rateLimiter.extractEndpoint(url));

    if (!check.allowed) {
      // Queue the request if rate limited
      const response = await rateLimiter.queueRequest(
        { url, options: mergedOptions, priority },
        'stellar_client'
      );
      const responseTime = Date.now() - startTime;

      auditTrail.logAPICall(url, mergedOptions.method || 'GET', mergedOptions, {
        status: response.status,
        responseTime,
        queued: true,
      });

      return response;
    }

    // Execute request immediately if allowed
    const response = await fetch(url, mergedOptions);
    const responseTime = Date.now() - startTime;

    auditTrail.logAPICall(url, mergedOptions.method || 'GET', mergedOptions, {
      status: response.status,
      responseTime,
      queued: false,
    });

    return response;
  } catch (error) {
    auditTrail.logError(error as Error, { url, operation: 'rateLimitedFetch' });
    throw error;
  }
}

// ─── Servers ──────────────────────────────────────────────────────────────────

export function getNetworkDetails(network: NetworkName): NetworkConfig {
  return NETWORKS[network];
}

export function updateCustomNetworkConfig(config: Partial<NetworkConfig>) {
  const { headers, ...networkConfig } = config;
  Object.assign(NETWORKS.custom, networkConfig);
  if (headers) saveCustomNetworkAuthHeaders(headers);
}

/**
 * Switch to a custom network profile (Issue #188).
 * Updates NETWORKS.custom with profile data and creates new clients.
 */
export async function switchToCustomProfile(profileId: string): Promise<void> {
  const { getNetworkProfile } = await import('../userPreferences');
  const profile = await getNetworkProfile(profileId);

  if (!profile) {
    throw new Error(`Network profile "${profileId}" not found`);
  }

  // Update the custom network config
  updateCustomNetworkConfig({
    name: profile.name,
    horizonUrl: profile.horizonUrl,
    sorobanUrl: profile.sorobanUrl,
    passphrase: profile.passphrase,
  });
}

/**
 * Load profiles from storage and return them (Issue #188).
 */
export async function loadCustomNetworkProfiles() {
  const { loadNetworkProfiles } = await import('../userPreferences');
  return loadNetworkProfiles();
}

export function getServer(network: NetworkName = 'testnet'): StellarSdk.Horizon.Server {
  const config = NETWORKS[network];
  return new StellarSdk.Horizon.Server(
    config.horizonUrl || NETWORKS.testnet.horizonUrl,
    getServerOptions(network)
  );
}

/** @deprecated Use getServer directly. */
export const ee = getServer;

export function getSorobanServer(network: NetworkName = 'testnet'): StellarSdk.rpc.Server {
  const config = NETWORKS[network];
  if (network === 'custom' && !config.sorobanUrl) {
    throw new Error('Custom Soroban RPC URL not configured');
  }
  return new StellarSdk.rpc.Server(
    config.sorobanUrl || NETWORKS.testnet.sorobanUrl!,
    getServerOptions(network)
  );
}

export type ProbeStatus = 'up' | 'degraded' | 'down';

export interface ServiceProbeResult {
  url: string;
  status: ProbeStatus;
  latency: number | null;
  statusCode?: number;
  breakerState: CircuitState;
  error?: string;
}

export interface NetworkProbeResult {
  network: NetworkName;
  name: string;
  horizon: ServiceProbeResult;
  soroban: ServiceProbeResult;
}

const PROBE_TIMEOUT_MS = 10_000;
const PROBE_LATENCY_DEGRADED_MS = 1_200;

function resolveProbeStatus(response: Response, latency: number): ProbeStatus {
  if (response.ok) {
    return latency > PROBE_LATENCY_DEGRADED_MS ? 'degraded' : 'up';
  }
  if (response.status >= 500) {
    return 'down';
  }
  return 'degraded';
}

async function probeServiceUrl(
  network: NetworkName,
  url: string,
  serviceLabel: 'horizon' | 'soroban'
): Promise<ServiceProbeResult> {
  const serviceName = `${serviceLabel}:${network}`;
  const breaker = getCircuitBreaker(serviceName, {
    failureThreshold: 4,
    timeout: 15_000,
  });

  if (!url) {
    return {
      url,
      status: 'down',
      latency: null,
      breakerState: breaker.currentState,
      error: 'URL unavailable',
    };
  }

  const start = Date.now();
  let response: Response | null = null;

  try {
    response = await breaker.execute(async () => {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
      try {
        const headResponse = await rateLimitedFetch(
          url,
          { method: 'HEAD', cache: 'no-store', signal: controller.signal },
          'low'
        );

        if (headResponse.status === 405 || headResponse.status === 501) {
          return await rateLimitedFetch(
            url,
            { method: 'GET', cache: 'no-store', signal: controller.signal },
            'low'
          );
        }

        return headResponse;
      } finally {
        window.clearTimeout(timeoutId);
      }
    });

    const latency = Date.now() - start;
    return {
      url,
      status: resolveProbeStatus(response, latency),
      latency,
      statusCode: response.status,
      breakerState: breaker.currentState,
    };
  } catch (error) {
    return {
      url,
      status: 'down',
      latency: null,
      breakerState: breaker.currentState,
      error: String(error),
    };
  }
}

export async function probeAllNetworks(): Promise<NetworkProbeResult[]> {
  const probeKeys = Object.entries(NETWORKS) as [NetworkName, NetworkConfig][];
  const probes = probeKeys.map(async ([network, config]) => {
    const horizon = await probeServiceUrl(network, config.horizonUrl, 'horizon');
    const soroban = await probeServiceUrl(network, config.sorobanUrl || '', 'soroban');

    return {
      network,
      name: config.name,
      horizon,
      soroban,
    };
  });

  return Promise.all(probes);
}


export { StellarSdk };
