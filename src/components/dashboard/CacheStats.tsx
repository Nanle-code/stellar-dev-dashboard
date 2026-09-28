/**
 * CacheStats — Multi-layer cache analytics dashboard
 *
 * Displays:
 *   - Global hit rate across all layers (L1 memory, L2 IDB, L3 SW)
 *   - Per-namespace breakdown with latency histograms
 *   - Size history sparklines
 *   - Service Worker L3 stats
 *   - Cache warming / prefetch progress
 *   - IndexedDB storage summary
 *   - Rate limiter metrics
 *   - Controls: prune, clear all, invalidate tag, warm URLs
 */

import React, { useCallback, useEffect, useState } from 'react';
import Card from './Card';
import { useRateLimiter } from '../../hooks/useRateLimiter';
import { useCacheAnalytics } from '../../hooks/useCacheAnalytics';
import {
  pruneCaches,
  stellarCacheManager,
  realtimeCacheManager,
  sorobanCacheManager,
  priceCacheManager,
} from '../../lib/cacheManager';
import type { NamespaceReport } from '../../lib/cacheAnalytics';

// ─── Formatting helpers ───────────────────────────────────────────────────────

function fmtNum(n: number | undefined | null): string {
  if (n == null) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`;
  return String(Math.round(n));
}

function fmtBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024)        return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function fmtMs(ms: number): string {
  return ms < 1 ? `<1 ms` : `${ms.toFixed(1)} ms`;
}

function fmtRate(r: number): string {
  return `${(r * 100).toFixed(1)}%`;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const tableHeader: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1.4fr repeat(8, 1fr)',
  gap: '8px',
  padding: '8px 14px',
  fontSize: '10px',
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  borderBottom: '1px solid var(--border)',
  alignItems: 'center',
};

const tableRow: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1.4fr repeat(8, 1fr)',
  gap: '8px',
  padding: '10px 14px',
  fontSize: '12px',
  alignItems: 'center',
  borderBottom: '1px solid var(--border)',
};

const statBox: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
};

const statLabel: React.CSSProperties = {
  fontSize: '10px',
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '1px',
};

const statValue: React.CSSProperties = {
  fontFamily: 'var(--font-display)',
  fontSize: '20px',
  fontWeight: 700,
  color: 'var(--text-primary)',
};

const accentValue: React.CSSProperties = {
  ...statValue,
  color: 'var(--cyan, #06b6d4)',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusPill({ online }: { online: boolean }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '6px',
      padding: '2px 8px', borderRadius: '999px', fontSize: '11px',
      background: online ? 'var(--bg-card)' : 'rgba(245,158,11,0.15)',
      color:      online ? 'var(--text-primary)' : 'var(--warning,#f59e0b)',
      border:     `1px solid ${online ? 'var(--border)' : 'rgba(245,158,11,0.4)'}`,
    }}>
      <span style={{
        width: '6px', height: '6px', borderRadius: '50%',
        background: online ? 'var(--success,#22c55e)' : 'var(--warning,#f59e0b)',
      }} />
      {online ? 'online' : 'offline'}
    </span>
  );
}

function LayerBadge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      padding: '1px 6px', borderRadius: '4px', fontSize: '10px',
      fontWeight: 600, background: `${color}22`, color, border: `1px solid ${color}44`,
    }}>
      {label}
    </span>
  );
}

/** Tiny inline sparkline from a size history array */
function Sparkline({ data, width = 80, height = 24 }: {
  data: number[]; width?: number; height?: number;
}) {
  if (!data.length) return <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>—</span>;
  const max = Math.max(...data, 1);
  const pts = data.slice(-20).map((v, i, arr) => {
    const x = (i / (arr.length - 1)) * width;
    const y = height - (v / max) * height;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <polyline points={pts} fill="none" stroke="var(--cyan,#06b6d4)" strokeWidth="1.5" />
    </svg>
  );
}

function NSRow({ ns }: { ns: NamespaceReport }) {
  return (
    <div style={tableRow}>
      <div style={{ fontWeight: 600 }}>{ns.namespace}</div>
      <div>{fmtRate(ns.hitRate)}</div>
      <div>{fmtNum(ns.hits)}</div>
      <div>{fmtNum(ns.misses)}</div>
      <div title="L2 IDB hits">{fmtNum(ns.idbHits)}</div>
      <div title="L3 SW hits">{fmtNum(ns.swHits)}</div>
      <div title="Median get latency">{fmtMs(ns.getLatency.p50)}</div>
      <div>{fmtBytes(ns.currentBytesEstimate)}</div>
      <div>
        <Sparkline data={ns.sizeHistory.map((s) => s.entries)} />
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CacheStats() {
  const {
    global, warming, sw, loading,
    formatRate, invalidateTag, clearAll,
  } = useCacheAnalytics(4_000);

  const { stats: rateLimiterStats } = useRateLimiter();

  const [storage, setStorage] = useState({ appState: 0, apiCache: 0, offlineQueue: 0 });
  const [busy,    setBusy]    = useState(false);
  const [tagInput, setTagInput] = useState('');

  useEffect(() => {
    async function fetchStorage() {
      try {
        const { storageStats } = await import('../../lib/storage');
        const s = await storageStats();
        setStorage(s);
      } catch { /* ignore */ }
    }
    fetchStorage();
    const id = setInterval(fetchStorage, 10_000);
    return () => clearInterval(id);
  }, []);

  const handleClear = async (which: string) => {
    setBusy(true);
    try {
      if (which === 'stellar')  stellarCacheManager.clear();
      else if (which === 'realtime') realtimeCacheManager.clear();
      else if (which === 'soroban')  sorobanCacheManager.clear();
      else if (which === 'price')    priceCacheManager.clear();
      else clearAll();
    } finally {
      setBusy(false);
    }
  };

  const handlePrune = async () => {
    setBusy(true);
    try { await pruneCaches(); } finally { setBusy(false); }
  };

  const handleInvalidateTag = async () => {
    const tag = tagInput.trim();
    if (!tag) return;
    setBusy(true);
    try {
      await invalidateTag(tag);
      setTagInput('');
    } finally {
      setBusy(false);
    }
  };

  const offline = global.namespaces.some((n) =>
    n.namespace === 'stellar' || n.namespace === 'realtime',
  ) && !navigator.onLine;

  const overallHitRate = fmtRate(global.totalHitRate);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* ── Overview ────────────────────────────────────────────────────────── */}
      <Card
        title="Cache overview"
        subtitle="Real-time multi-layer cache (L1 memory → L2 IndexedDB → L3 Service Worker)"
        action={
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <StatusPill online={!offline} />
            <LayerBadge label="L1 Memory"    color="#06b6d4" />
            <LayerBadge label="L2 IndexedDB" color="#8b5cf6" />
            <LayerBadge label="L3 SW"        color="#22c55e" />
            <button type="button" className="btn" disabled={busy} onClick={handlePrune} style={{ fontSize: '12px' }}>
              Prune expired
            </button>
            <button type="button" className="btn" disabled={busy} onClick={() => handleClear('all')} style={{ fontSize: '12px' }}>
              Clear all
            </button>
          </div>
        }
      >
        <div style={{ padding: '14px 18px', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '14px' }}>
          <div style={statBox}>
            <span style={statLabel}>Overall hit rate</span>
            <span style={accentValue}>{overallHitRate}</span>
          </div>
          <div style={statBox}>
            <span style={statLabel}>Total hits</span>
            <span style={statValue}>{fmtNum(global.totalHits)}</span>
          </div>
          <div style={statBox}>
            <span style={statLabel}>Total misses</span>
            <span style={statValue}>{fmtNum(global.totalMisses)}</span>
          </div>
          <div style={statBox}>
            <span style={statLabel}>Warmed keys</span>
            <span style={statValue}>{fmtNum(warming.warmed)}</span>
          </div>
          <div style={statBox}>
            <span style={statLabel}>Prefetched</span>
            <span style={statValue}>{fmtNum(warming.prefetches)}</span>
          </div>
        </div>
      </Card>

      {/* ── Per-namespace table ──────────────────────────────────────────────── */}
      <Card
        title="Per-namespace breakdown"
        subtitle="Hit rates, latency (p50), memory usage and size history per cache manager"
      >
        <div style={tableHeader}>
          <div>Namespace</div>
          <div>Hit rate</div>
          <div>Hits</div>
          <div>Misses</div>
          <div>IDB hits</div>
          <div>SW hits</div>
          <div>p50 get</div>
          <div>Bytes</div>
          <div>Size history</div>
        </div>
        {loading ? (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>
        ) : global.namespaces.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
            No cache activity yet. Make some API calls to populate the dashboard.
          </div>
        ) : (
          global.namespaces.map((ns) => <NSRow key={ns.namespace} ns={ns} />)
        )}
      </Card>

      {/* ── Service Worker (L3) stats ────────────────────────────────────────── */}
      <Card
        title="Service Worker cache (L3)"
        subtitle={sw ? `${sw.apiCacheEntries} cached API responses in SW bucket` : 'SW unavailable or not yet active'}
      >
        <div style={{ padding: '14px 18px', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '14px' }}>
          <div style={statBox}>
            <span style={statLabel}>API hits</span>
            <span style={statValue}>{fmtNum(sw?.apiHits)}</span>
          </div>
          <div style={statBox}>
            <span style={statLabel}>API misses</span>
            <span style={statValue}>{fmtNum(sw?.apiMisses)}</span>
          </div>
          <div style={statBox}>
            <span style={statLabel}>Shell hits</span>
            <span style={statValue}>{fmtNum(sw?.shellHits)}</span>
          </div>
          <div style={statBox}>
            <span style={statLabel}>Evictions</span>
            <span style={statValue}>{fmtNum(sw?.evictions)}</span>
          </div>
          <div style={statBox}>
            <span style={statLabel}>Network errors</span>
            <span style={statValue}>{fmtNum(sw?.networkErrors)}</span>
          </div>
        </div>
      </Card>

      {/* ── Cache warming stats ──────────────────────────────────────────────── */}
      <Card
        title="Cache warming & prefetch"
        subtitle="Startup warming, predictive prefetch and background refresh activity"
      >
        <div style={{ padding: '14px 18px', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '14px' }}>
          <div style={statBox}>
            <span style={statLabel}>Warmed</span>
            <span style={accentValue}>{fmtNum(warming.warmed)}</span>
          </div>
          <div style={statBox}>
            <span style={statLabel}>Skipped (fresh)</span>
            <span style={statValue}>{fmtNum(warming.skipped)}</span>
          </div>
          <div style={statBox}>
            <span style={statLabel}>Failed</span>
            <span style={statValue}>{fmtNum(warming.failed)}</span>
          </div>
          <div style={statBox}>
            <span style={statLabel}>Prefetched</span>
            <span style={statValue}>{fmtNum(warming.prefetches)}</span>
          </div>
          <div style={statBox}>
            <span style={statLabel}>Bg refreshes</span>
            <span style={statValue}>{fmtNum(warming.backgroundRefreshes)}</span>
          </div>
        </div>
      </Card>

      {/* ── Latency detail ───────────────────────────────────────────────────── */}
      {global.namespaces.filter((n) => n.getLatency.count > 0).length > 0 && (
        <Card title="Get latency histograms" subtitle="Percentiles (ms) per namespace — lower is better">
          <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {global.namespaces.filter((n) => n.getLatency.count > 0).map((ns) => (
              <div key={ns.namespace} style={{ display: 'grid', gridTemplateColumns: '1.4fr repeat(4, 1fr)', gap: '8px', fontSize: '12px', alignItems: 'center' }}>
                <span style={{ fontWeight: 600 }}>{ns.namespace}</span>
                <span title="p50 (median)"><span style={{ color: 'var(--text-muted)', marginRight: 4 }}>p50</span>{fmtMs(ns.getLatency.p50)}</span>
                <span title="p95"><span style={{ color: 'var(--text-muted)', marginRight: 4 }}>p95</span>{fmtMs(ns.getLatency.p95)}</span>
                <span title="p99"><span style={{ color: 'var(--text-muted)', marginRight: 4 }}>p99</span>{fmtMs(ns.getLatency.p99)}</span>
                <span title="mean"><span style={{ color: 'var(--text-muted)', marginRight: 4 }}>avg</span>{fmtMs(ns.getLatency.mean)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── Manual invalidation ──────────────────────────────────────────────── */}
      <Card
        title="Manual cache controls"
        subtitle="Invalidate by tag or clear individual namespaces"
      >
        <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Tag invalidation */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Tag name (e.g. account, transactions)"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleInvalidateTag()}
              style={{
                flex: 1, padding: '8px 12px', borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border)', background: 'var(--bg-elevated)',
                color: 'var(--text-primary)', fontSize: '13px',
              }}
            />
            <button type="button" className="btn" disabled={busy || !tagInput.trim()} onClick={handleInvalidateTag}>
              Invalidate tag
            </button>
          </div>

          {/* Per-namespace clear buttons */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {['stellar', 'realtime', 'soroban', 'price'].map((ns) => (
              <button
                key={ns}
                type="button"
                className="btn"
                disabled={busy}
                onClick={() => handleClear(ns)}
                style={{ fontSize: '12px' }}
              >
                Clear {ns}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* ── Rate limiter ─────────────────────────────────────────────────────── */}
      {rateLimiterStats && (
        <Card
          title="Rate limiter metrics"
          subtitle={`Queue depth and throttling (Mode: ${rateLimiterStats.throttleMode})`}
        >
          <div style={{ padding: '14px 18px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
            <div style={statBox}><span style={statLabel}>Queue length</span><span style={statValue}>{fmtNum(rateLimiterStats.totalQueued)}</span></div>
            <div style={statBox}><span style={statLabel}>Queued</span><span style={statValue}>{fmtNum(rateLimiterStats.queuedRequests)}</span></div>
            <div style={statBox}><span style={statLabel}>Dropped</span><span style={statValue}>{fmtNum(rateLimiterStats.droppedRequests)}</span></div>
            <div style={statBox}><span style={statLabel}>Rejected</span><span style={statValue}>{fmtNum(rateLimiterStats.rejectedRequests)}</span></div>
          </div>
          <div style={{ padding: '0 18px 14px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
            <div style={statBox}><span style={statLabel}>High queue</span><span style={statValue}>{fmtNum(rateLimiterStats.queueSizes.high)}</span></div>
            <div style={statBox}><span style={statLabel}>Medium queue</span><span style={statValue}>{fmtNum(rateLimiterStats.queueSizes.medium)}</span></div>
            <div style={statBox}><span style={statLabel}>Low queue</span><span style={statValue}>{fmtNum(rateLimiterStats.queueSizes.low)}</span></div>
          </div>
        </Card>
      )}

      {/* ── IndexedDB storage ────────────────────────────────────────────────── */}
      <Card
        title="IndexedDB storage (L2)"
        subtitle="Persistent records held in browser IndexedDB across namespaces"
      >
        <div style={{ padding: '14px 18px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
          <div style={statBox}><span style={statLabel}>App state rows</span><span style={statValue}>{storage.appState}</span></div>
          <div style={statBox}><span style={statLabel}>API cache rows</span><span style={statValue}>{storage.apiCache}</span></div>
          <div style={statBox}><span style={statLabel}>Offline queue</span><span style={statValue}>{storage.offlineQueue}</span></div>
        </div>
      </Card>
    </div>
  );
}
