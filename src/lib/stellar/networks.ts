import * as StellarSdk from '@stellar/stellar-sdk';
import { Cache, TTL } from '../cache.js';
import { rateLimiter } from '../rateLimiter.js';
import auditTrail from '../auditTrail.js';
import { getCircuitBreaker, type CircuitState } from '../errorHandling/CircuitBreaker';
import {
  coalesceRequest,
  createHorizonFetchKey,
  installSdkGetCoalescing,
} from './requestCoalescing.js';
import {
  type NetworkName,
  type NetworkConfig,
  NETWORKS as CORE_NETWORKS,
  getServer as coreGetServer,
  getSorobanServer as coreGetSorobanServer,
  updateCustomNetworkConfig as coreUpdateCustomNetworkConfig,
} from '@stellar-dev-dashboard/core';

export type { NetworkName, NetworkConfig };

export const NETWORKS = CORE_NETWORKS;

const stellarCache = new Cache({
  namespace: 'stellar',
  persist: true,
  maxSize: 500,
  defaultTTL: TTL.ACCOUNT,
});

export { stellarCache };

function isConfiguredHorizonUrl(value: string): boolean {
  try {
    const requestUrl = new URL(value);
    return Object.values(NETWORKS).some((config) => {
      if (!config.horizonUrl) return false;
      const baseUrl = new URL(config.horizonUrl);
      const basePath = baseUrl.pathname.replace(/\/$/, '');
      return (
        requestUrl.origin === baseUrl.origin &&
        (!basePath ||
          requestUrl.pathname === basePath ||
          requestUrl.pathname.startsWith(`${basePath}/`))
      );
    });
  } catch {
    return false;
  }
}

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

export async function rateLimitedFetch(
  url: string,
  options?: RequestInit,
  priority: 'high' | 'medium' | 'low' = 'medium',
  extraHeaders?: Record<string, string>
): Promise<Response> {
  const startTime = Date.now();

  const mergedOptions: RequestInit =
    extraHeaders && Object.keys(extraHeaders).length > 0
      ? {
          ...options,
          headers: { ...(options?.headers as Record<string, string> | undefined), ...extraHeaders },
        }
      : (options ?? {});

  try {
    auditTrail.logAPICall(url, mergedOptions.method || 'GET', mergedOptions, {});

    const requestKey = isConfiguredHorizonUrl(url)
      ? createHorizonFetchKey(url, mergedOptions, { priority })
      : null;
    const execute = async (
      signal?: AbortSignal
    ): Promise<{ response: Response; queued: boolean }> => {
      const requestOptions = signal ? { ...mergedOptions, signal } : mergedOptions;
      const check = rateLimiter.checkRequest('stellar_client', rateLimiter.extractEndpoint(url));
      if (!check.allowed) {
        const response = await rateLimiter.queueRequest(
          { url, options: requestOptions, priority },
          'stellar_client'
        );
        return { response: response as Response, queued: true };
      }
      return { response: await fetch(url, requestOptions), queued: false };
    };
    const result: { response: Response; queued: boolean } = requestKey
      ? await coalesceRequest<{ response: Response; queued: boolean }>(
          requestKey,
          execute,
          mergedOptions.signal ?? undefined
        )
      : await execute(mergedOptions.signal ?? undefined);
    const response =
      requestKey && typeof result.response.clone === 'function'
        ? result.response.clone()
        : result.response;
    const responseTime = Date.now() - startTime;

    auditTrail.logAPICall(url, mergedOptions.method || 'GET', mergedOptions, {
      status: response.status,
      responseTime,
      queued: result.queued,
    });

    return response;
  } catch (error) {
    auditTrail.logError(error as Error, { url, operation: 'rateLimitedFetch' });
    throw error;
  }
}

export function getNetworkDetails(network: NetworkName): NetworkConfig {
  return NETWORKS[network];
}

export function updateCustomNetworkConfig(config: Partial<NetworkConfig>) {
  coreUpdateCustomNetworkConfig(config);
  const { headers, ...networkConfig } = config;
  Object.assign(NETWORKS.custom, networkConfig);
  if (headers) saveCustomNetworkAuthHeaders(headers);
}

export async function switchToCustomProfile(profileId: string): Promise<void> {
  const { getNetworkProfile } = await import('../userPreferences');
  const profile = await getNetworkProfile(profileId);

  if (!profile) {
    throw new Error(`Network profile "${profileId}" not found`);
  }

  updateCustomNetworkConfig({
    name: profile.name,
    horizonUrl: profile.horizonUrl,
    sorobanUrl: profile.sorobanUrl,
    passphrase: profile.passphrase,
  });
}

export async function loadCustomNetworkProfiles() {
  const { loadNetworkProfiles } = await import('../userPreferences');
  return loadNetworkProfiles();
}

export function getServer(network: NetworkName = 'testnet'): StellarSdk.Horizon.Server {
  const config = NETWORKS[network];
  const server = new StellarSdk.Horizon.Server(
    config.horizonUrl || NETWORKS.testnet.horizonUrl,
    getServerOptions(network)
  );
  installSdkGetCoalescing(
    server.httpClient as any,
    `horizon:${server.serverURL.toString()}:${JSON.stringify(getNetworkHeaders(network))}`
  );
  return server;
}

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