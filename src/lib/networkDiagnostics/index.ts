/*
 * Issue #432: Advanced Network Monitoring and Diagnostics
 *
 * This module provides lightweight, simulation-based connectivity diagnostics
 * primitives for the Stellar Dev Dashboard.
 */

export type EndpointHealth = {
  endpoint: string;
  status: number;
  ok: boolean;
  durationMs: number;
  error?: string;
}

export interface DiagnosticResult {
  host: string;
  ping: {
    ok: boolean;
    durationMs: number;
    error?: string;
  };
  status: 'ok' | 'degraded' | 'down';
  dnsResolved: {
    ok: boolean;
    durationMs: number;
    records?: string[];
    error?: string;
  };
  endpointHealth: EndpointHealth;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashToSeed(input: string) {
  // FNV-1a-ish
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function healthFromSignals(args: {
  pingOk: boolean;
  dnsOk: boolean;
  endpointOk: boolean;
  pingMs: number;
  endpointMs: number;
}): DiagnosticResult['status'] {
  const { pingOk, dnsOk, endpointOk, pingMs, endpointMs } = args;
  if (!pingOk || !dnsOk || !endpointOk) return 'down';
  // Degraded latency heuristic
  if (pingMs > 350 || endpointMs > 1200) return 'degraded';
  return 'ok';
}

/**
 * Simulates DNS + endpoint health checks for a given host.
 *
 * Note: This is intentionally simulated/deterministic so the UI can be
 * exercised without requiring real networking access.
 */
export async function runConnectivityTest(host: string): Promise<DiagnosticResult> {
  const now = Date.now();

  // Bucket time so results evolve gradually.
  const bucket = Math.floor(now / 10_000);
  const rnd = mulberry32(hashToSeed(`${host}-${bucket}`));

  // Simulate DNS
  const dnsDurationMs = Math.round(20 + rnd() * 220);
  const dnsOk = rnd() > 0.12;
  const dnsRecords = dnsOk
    ? [`${host}.resolver-${Math.floor(rnd() * 9999)}.local`, `lb-${Math.floor(rnd() * 9999)}.stellar.example`]
    : undefined;

  // Simulate ping/TCP handshake
  const pingDurationMs = Math.round(90 + rnd() * 520);
  const pingOk = rnd() > 0.10;

  // Simulate endpoint health (API)
  const endpoint = `https://api.${host}.stellar.example`;
  const endpointDurationMs = Math.round(120 + rnd() * 1350);
  const endpointOk = rnd() > 0.14;

  const statusCode = endpointOk ? 200 : rnd() > 0.5 ? 503 : 429;

  // Lightweight deterministic error messages
  const dnsError = dnsOk ? undefined : 'DNS resolution failure';
  const pingError = pingOk ? undefined : 'TCP handshake timeout';
  const endpointError = endpointOk ? undefined : 'API endpoint returned error';

  const overallStatus = healthFromSignals({
    pingOk,
    dnsOk,
    endpointOk,
    pingMs: pingDurationMs,
    endpointMs: endpointDurationMs,
  });

  // Optional artificial delay so the async nature is visible in UI
  await new Promise((r) => setTimeout(r, 80 + Math.floor(rnd() * 120)));

  return {
    host,
    ping: {
      ok: pingOk,
      durationMs: pingDurationMs,
      error: pingError,
    },
    status: overallStatus,
    dnsResolved: {
      ok: dnsOk,
      durationMs: dnsDurationMs,
      records: dnsRecords,
      error: dnsError,
    },
    endpointHealth: {
      endpoint,
      ok: endpointOk,
      durationMs: endpointDurationMs,
      status: statusCode,
      error: endpointError,
    },
  };
}

export type NetworkTopologyNode = {
  id: string;
  kind: 'core' | 'edge';
  label: string;
  zone: string;
  status: 'ok' | 'degraded' | 'down';
};

export type NetworkTopologyPath = {
  id: string;
  from: string;
  to: string;
  hops: string[];
  estimatedLatencyMs: number;
  degradedRisk: 'low' | 'medium' | 'high';
};

/**
 * Returns a simulated network topology model.
 */
export function getNetworkTopology(): {
  nodes: NetworkTopologyNode[];
  paths: NetworkTopologyPath[];
} {
  const nodes: NetworkTopologyNode[] = [
    { id: 'core-1', kind: 'core', label: 'Core Routing A', zone: 'us-east-1', status: 'ok' },
    { id: 'core-2', kind: 'core', label: 'Core Routing B', zone: 'eu-west-1', status: 'ok' },
    { id: 'edge-1', kind: 'edge', label: 'Edge Gateway 1', zone: 'us-east-1', status: 'ok' },
    { id: 'edge-2', kind: 'edge', label: 'Edge Gateway 2', zone: 'us-west-2', status: 'ok' },
    { id: 'edge-3', kind: 'edge', label: 'Edge Gateway 3', zone: 'eu-central-1', status: 'ok' },
    { id: 'edge-4', kind: 'edge', label: 'Edge Gateway 4', zone: 'ap-singapore-1', status: 'ok' },
  ];

  const paths: NetworkTopologyPath[] = [
    {
      id: 'path-1',
      from: 'edge-1',
      to: 'core-1',
      hops: ['edge-1', 'core-1'],
      estimatedLatencyMs: 140,
      degradedRisk: 'low',
    },
    {
      id: 'path-2',
      from: 'edge-2',
      to: 'core-1',
      hops: ['edge-2', 'core-1'],
      estimatedLatencyMs: 210,
      degradedRisk: 'medium',
    },
    {
      id: 'path-3',
      from: 'edge-3',
      to: 'core-2',
      hops: ['edge-3', 'core-2'],
      estimatedLatencyMs: 230,
      degradedRisk: 'medium',
    },
    {
      id: 'path-4',
      from: 'edge-4',
      to: 'core-2',
      hops: ['edge-4', 'core-2'],
      estimatedLatencyMs: 320,
      degradedRisk: 'high',
    },
    {
      id: 'path-5',
      from: 'edge-2',
      to: 'core-2',
      hops: ['edge-2', 'core-1', 'core-2'],
      estimatedLatencyMs: 365,
      degradedRisk: 'high',
    },
  ];

  return { nodes, paths };
}

