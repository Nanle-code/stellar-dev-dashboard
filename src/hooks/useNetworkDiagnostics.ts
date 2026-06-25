import { useEffect, useMemo, useRef, useState } from 'react';

import {
  getNetworkTopology,
  runConnectivityTest,
  type DiagnosticResult,
  type NetworkTopologyNode,
  type NetworkTopologyPath,
} from '../lib/networkDiagnostics';

export type LatencyDegradationAlert = {
  alertId: string;
  createdAt: number;
  severity: 'warning' | 'critical';
  title: string;
  summary: string;
  relatedHosts?: string[];
};

export type NetworkDiagnosticsState = {
  loading: boolean;
  updatedAt: number;
  resultsByHost: Record<string, DiagnosticResult>;
  topology: {
    nodes: NetworkTopologyNode[];
    paths: NetworkTopologyPath[];
  };
  degradedLatency: {
    enabled: boolean;
    isDegraded: boolean;
    score: number;
    avgPingMs: number;
    avgEndpointMs: number;
  };
  alerts: LatencyDegradationAlert[];
};

function toStatusScore(r: DiagnosticResult) {
  // Score 0..100 (higher = worse)
  const pingPenalty = clamp01(r.ping.durationMs / 550) * (r.ping.ok ? 0.7 : 1.0);
  const dnsPenalty = clamp01(r.dnsResolved.durationMs / 400) * (r.dnsResolved.ok ? 0.6 : 1.0);
  const endpointPenalty = clamp01(r.endpointHealth.durationMs / 1400) * (r.endpointHealth.ok ? 0.8 : 1.0);

  // If any hard failures, jump score
  const hardDown = !r.ping.ok || !r.dnsResolved.ok || !r.endpointHealth.ok;
  const base = 0.25 * pingPenalty + 0.25 * dnsPenalty + 0.5 * endpointPenalty;
  const raw = hardDown ? 0.98 : base;
  return Math.round(raw * 100);
}

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

function computeLatencyDegradation(results: Record<string, DiagnosticResult>) {
  const hosts = Object.keys(results);
  if (!hosts.length) {
    return {
      enabled: true,
      isDegraded: false,
      score: 0,
      avgPingMs: 0,
      avgEndpointMs: 0,
    };
  }

  const avgPingMs = hosts.reduce((a, h) => a + results[h].ping.durationMs, 0) / hosts.length;
  const avgEndpointMs =
    hosts.reduce((a, h) => a + results[h].endpointHealth.durationMs, 0) / hosts.length;

  // Heuristic: degraded if latency crosses thresholds.
  const pingFlag = avgPingMs > 350;
  const endpointFlag = avgEndpointMs > 1200;
  const isDegraded = pingFlag || endpointFlag;

  const maxPing = 550;
  const maxEndpoint = 1600;
  const score = Math.round(clamp01(avgPingMs / maxPing) * 55 + clamp01(avgEndpointMs / maxEndpoint) * 45);

  return {
    enabled: true,
    isDegraded,
    score,
    avgPingMs,
    avgEndpointMs,
  };
}

function buildAlerts(results: Record<string, DiagnosticResult>, degraded: NetworkDiagnosticsState['degradedLatency']): LatencyDegradationAlert[] {
  const hosts = Object.keys(results);
  const worst = hosts
    .map((h) => ({ host: h, status: results[h].status, pingOk: results[h].ping.ok, dnsOk: results[h].dnsResolved.ok, apiOk: results[h].endpointHealth.ok }))
    .sort((a, b) => {
      const aDown = a.status === 'down' ? 1 : 0;
      const bDown = b.status === 'down' ? 1 : 0;
      if (aDown !== bDown) return bDown - aDown;
      const aDeg = a.status === 'degraded' ? 1 : 0;
      const bDeg = b.status === 'degraded' ? 1 : 0;
      return bDeg - aDeg;
    });

  if (!degraded.isDegraded) return [];

  const severity: 'warning' | 'critical' = degraded.score >= 75 ? 'critical' : 'warning';

  const relatedHosts = worst
    .filter((x) => x.status !== 'ok')
    .slice(0, 4)
    .map((x) => x.host);

  const createdAt = Date.now();

  return [
    {
      alertId: `network-latency-${severity}-${createdAt}`,
      createdAt,
      severity,
      title: severity === 'critical' ? 'Network outage / severe latency (simulated)' : 'High-latency degradation detected (simulated)',
      summary:
        severity === 'critical'
          ? `Avg ping ${Math.round(degraded.avgPingMs)}ms and avg endpoint ${Math.round(
              degraded.avgEndpointMs
            )}ms. DNS or endpoint probes failed for one or more nodes.`
          : `Avg ping ${Math.round(degraded.avgPingMs)}ms and avg endpoint ${Math.round(degraded.avgEndpointMs)}ms. Latency thresholds exceeded.`,
      relatedHosts: relatedHosts.length ? relatedHosts : undefined,
    },
  ];
}

/**
 * Custom hook: polls simulated network probes and computes degradation alerts.
 */
export function useNetworkDiagnostics(options?: {
  pollingIntervalMs?: number;
  hosts?: string[];
}) {
  const pollingIntervalMs = options?.pollingIntervalMs ?? 8000;

  // Deterministic defaults (UI-friendly, no real network needed)
  const hosts = useMemo(
    () =>
      options?.hosts ?? [
        'horizon.testnet-1',
        'horizon.testnet-2',
        'horizon.testnet-3',
        'horizon.mainnet-1',
        'horizon.mainnet-2',
      ],
    [options?.hosts]
  );

  const topology = useMemo(() => getNetworkTopology(), []);

  const [state, setState] = useState<NetworkDiagnosticsState>(() => {
    return {
      loading: true,
      updatedAt: 0,
      resultsByHost: {},
      topology,
      degradedLatency: {
        enabled: true,
        isDegraded: false,
        score: 0,
        avgPingMs: 0,
        avgEndpointMs: 0,
      },
      alerts: [],
    };
  });

  const lastTickRef = useRef(0);
  const abortRef = useRef({ aborted: false });

  useEffect(() => {
    abortRef.current.aborted = false;

    async function tick() {
      const now = Date.now();
      lastTickRef.current = now;

      setState((s) => ({
        ...s,
        loading: true,
      }));

      const resultsArr: DiagnosticResult[] = await Promise.all(hosts.map((host) => runConnectivityTest(host)));
      if (abortRef.current.aborted) return;

      const resultsByHost = Object.fromEntries(resultsArr.map((r) => [r.host, r]));

      // Precompute degradation and alerts
      const degradedLatency = computeLatencyDegradation(resultsByHost);
      // Score refinement: mix with worst-host score
      const worstScore = Object.values(resultsByHost).reduce((m, r) => Math.max(m, toStatusScore(r)), 0);
      const blendedScore = Math.round(0.6 * degradedLatency.score + 0.4 * worstScore);

      const degradedLatencyFinal = {
        ...degradedLatency,
        score: blendedScore,
        isDegraded: degradedLatency.isDegraded || blendedScore >= 60,
      };

      const alerts = buildAlerts(resultsByHost, degradedLatencyFinal);

      setState({
        loading: false,
        updatedAt: now,
        resultsByHost,
        topology,
        degradedLatency: degradedLatencyFinal,
        alerts,
      });
    }

    tick();
    const id = window.setInterval(tick, pollingIntervalMs);

    return () => {
      abortRef.current.aborted = true;
      window.clearInterval(id);
    };
  }, [hosts, pollingIntervalMs, topology]);

  const nodeStatusRows = useMemo(() => {
    // Map each host result onto topology nodes by zone/labels heuristically.
    // For now, we derive node status from whichever host is closest by index.
    const hostKeys = Object.keys(state.resultsByHost);
    const nodes = state.topology.nodes;

    return nodes.map((n, idx) => {
      const host = hostKeys[idx % Math.max(1, hostKeys.length)];
      const r = host ? state.resultsByHost[host] : undefined;
      const status = r?.status ?? n.status;

      return {
        nodeId: n.id,
        label: n.label,
        kind: n.kind,
        zone: n.zone,
        status,
        latencyMs: r ? r.ping.durationMs : undefined,
        endpointMs: r ? r.endpointHealth.durationMs : undefined,
        lastUpdatedAt: state.updatedAt,
      };
    });
  }, [state.resultsByHost, state.topology.nodes, state.updatedAt]);

  return {
    ...state,
    nodeStatusRows,
    // Simple computed helpers for UI
    sortedAlerts: useMemo(() => [...state.alerts].sort((a, b) => b.createdAt - a.createdAt), [state.alerts]),
  };
}

