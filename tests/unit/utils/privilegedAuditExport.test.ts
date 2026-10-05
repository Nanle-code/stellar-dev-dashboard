import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  exportPrivilegedAudit,
  AuditExportError,
  PRIVILEGED_CATEGORIES,
  PRIVILEGED_SEVERITIES,
} from '../../../src/utils/privilegedAuditExport';
import {
  recordAudit,
  clearAuditLog,
  AuditCategory,
  AuditSeverity,
} from '../../../src/utils/audit';

// ── Setup / teardown ──────────────────────────────────────────────────────────

beforeEach(() => {
  clearAuditLog();
});

// ── Helpers ───────────────────────────────────────────────────────────────────

async function seedPrivilegedEntries() {
  await recordAudit({
    action: 'mainnet.transaction.submit',
    category: AuditCategory.TRANSACTION,
    severity: AuditSeverity.HIGH,
    actor: 'GABC1234',
    outcome: 'success',
  });
  await recordAudit({
    action: 'settings.network.switch',
    category: AuditCategory.CONFIG,
    severity: AuditSeverity.MEDIUM,
    actor: 'GABC1234',
    outcome: 'success',
  });
  await recordAudit({
    action: 'contract.invoke',
    category: AuditCategory.CONTRACT,
    severity: AuditSeverity.HIGH,
    actor: 'GXYZ9999',
    outcome: 'success',
  });
}

async function seedMixedEntries() {
  // privileged
  await recordAudit({
    action: 'wallet.connect',
    category: AuditCategory.WALLET,
    severity: AuditSeverity.INFO,
    actor: 'GABC1234',
    outcome: 'success',
  });
  // non-privileged
  await recordAudit({
    action: 'page.view',
    category: AuditCategory.ANALYTICS,
    severity: AuditSeverity.INFO,
    actor: 'GABC1234',
    outcome: 'success',
  });
  // non-privileged
  await recordAudit({
    action: 'network.monitor',
    category: AuditCategory.NETWORK,
    severity: AuditSeverity.INFO,
    outcome: 'success',
  });
}

// ── PRIVILEGED_CATEGORIES / PRIVILEGED_SEVERITIES ─────────────────────────────

describe('privileged classification', () => {
  it('PRIVILEGED_CATEGORIES includes transaction, contract, config, admin, security, wallet', () => {
    expect(PRIVILEGED_CATEGORIES.has(AuditCategory.TRANSACTION)).toBe(true);
    expect(PRIVILEGED_CATEGORIES.has(AuditCategory.CONTRACT)).toBe(true);
    expect(PRIVILEGED_CATEGORIES.has(AuditCategory.CONFIG)).toBe(true);
    expect(PRIVILEGED_CATEGORIES.has(AuditCategory.ADMIN)).toBe(true);
    expect(PRIVILEGED_CATEGORIES.has(AuditCategory.SECURITY)).toBe(true);
    expect(PRIVILEGED_CATEGORIES.has(AuditCategory.WALLET)).toBe(true);
  });

  it('PRIVILEGED_CATEGORIES does not include analytics or network', () => {
    expect(PRIVILEGED_CATEGORIES.has(AuditCategory.ANALYTICS)).toBe(false);
    expect(PRIVILEGED_CATEGORIES.has(AuditCategory.NETWORK)).toBe(false);
  });

  it('PRIVILEGED_SEVERITIES includes high and critical', () => {
    expect(PRIVILEGED_SEVERITIES.has(AuditSeverity.HIGH)).toBe(true);
    expect(PRIVILEGED_SEVERITIES.has(AuditSeverity.CRITICAL)).toBe(true);
  });
});

// ── Primary flow ──────────────────────────────────────────────────────────────

describe('exportPrivilegedAudit — primary flow', () => {
  it('returns only privileged entries in JSON format', async () => {
    await seedMixedEntries();

    const result = await exportPrivilegedAudit({ format: 'json', verifyChain: false });

    expect(result.format).toBe('json');
    expect(result.entryCount).toBe(1); // only wallet.connect is privileged
    const rows = JSON.parse(result.content);
    expect(Array.isArray(rows)).toBe(true);
    expect(rows.every((r: { category: string }) => PRIVILEGED_CATEGORIES.has(r.category) ||
      PRIVILEGED_SEVERITIES.has(r.severity))).toBe(true);
  });

  it('returns privileged entries in CSV format', async () => {
    await seedPrivilegedEntries();

    const result = await exportPrivilegedAudit({ format: 'csv', verifyChain: false });

    expect(result.format).toBe('csv');
    expect(result.entryCount).toBe(3);
    const lines = result.content.split('\n');
    // header + 3 data rows
    expect(lines.length).toBe(4);
    expect(lines[0]).toContain('id');
    expect(lines[0]).toContain('action');
    expect(lines[0]).toContain('hash');
  });

  it('includes chainHeadHash from the most recent privileged entry', async () => {
    await seedPrivilegedEntries();

    const result = await exportPrivilegedAudit({ format: 'json', verifyChain: false });

    expect(typeof result.chainHeadHash).toBe('string');
    expect(result.chainHeadHash).not.toBe('');
    // The chain head should match the hash in the first (most recent) exported row
    const rows = JSON.parse(result.content);
    expect(result.chainHeadHash).toBe(rows[0].hash);
  });

  it('exportedAt is a valid ISO-8601 timestamp', async () => {
    await seedPrivilegedEntries();
    const result = await exportPrivilegedAudit({ format: 'json', verifyChain: false });
    expect(new Date(result.exportedAt).toISOString()).toBe(result.exportedAt);
  });

  it('actor filter restricts entries to the specified actor', async () => {
    await seedPrivilegedEntries(); // GABC1234 has 2 entries, GXYZ9999 has 1

    const result = await exportPrivilegedAudit({
      format: 'json',
      actor: 'GXYZ9999',
      verifyChain: false,
    });

    const rows = JSON.parse(result.content);
    expect(rows.every((r: { actor: string }) => r.actor === 'GXYZ9999')).toBe(true);
    expect(result.entryCount).toBe(1);
  });

  it('returns empty content with entryCount 0 when no privileged entries exist', async () => {
    // Seed only non-privileged entries
    await recordAudit({ action: 'page.view', category: AuditCategory.ANALYTICS, severity: AuditSeverity.INFO, outcome: 'success' });

    const result = await exportPrivilegedAudit({ format: 'json', verifyChain: false });

    expect(result.entryCount).toBe(0);
    expect(result.chainHeadHash).toBe('0');
    const rows = JSON.parse(result.content);
    expect(rows).toHaveLength(0);
  });

  it('chainVerified is false when verifyChain option is false', async () => {
    const result = await exportPrivilegedAudit({ verifyChain: false });
    expect(result.chainVerified).toBe(false);
  });

  it('chainVerified is true when verifyChain is true and chain is intact', async () => {
    await seedPrivilegedEntries();
    const result = await exportPrivilegedAudit({ verifyChain: true });
    expect(result.chainVerified).toBe(true);
  });
});

// ── Boundary cases ────────────────────────────────────────────────────────────

describe('exportPrivilegedAudit — boundary cases', () => {
  it('boundary: since === until returns only entries at that exact timestamp', async () => {
    await seedPrivilegedEntries();

    // Get the actual entries to find a real timestamp
    const full = await exportPrivilegedAudit({ format: 'json', verifyChain: false });
    const rows = JSON.parse(full.content);
    if (rows.length === 0) return; // nothing to test

    const ts = rows[0].timestamp;
    const result = await exportPrivilegedAudit({ since: ts, until: ts, format: 'json', verifyChain: false });
    const filtered = JSON.parse(result.content);
    expect(filtered.every((r: { timestamp: string }) => r.timestamp === ts)).toBe(true);
  });

  it('boundary: empty audit log returns zero entries and "0" chain head', async () => {
    const result = await exportPrivilegedAudit({ verifyChain: false });
    expect(result.entryCount).toBe(0);
    expect(result.chainHeadHash).toBe('0');
  });

  it('boundary: high-severity entry from non-privileged category is included', async () => {
    // NETWORK is not a privileged category, but HIGH severity overrides that
    await recordAudit({
      action: 'network.anomaly.detected',
      category: AuditCategory.NETWORK,
      severity: AuditSeverity.HIGH,
      outcome: 'failure',
    });

    const result = await exportPrivilegedAudit({ format: 'json', verifyChain: false });
    const rows = JSON.parse(result.content);
    expect(rows.some((r: { action: string }) => r.action === 'network.anomaly.detected')).toBe(true);
  });

  it('boundary: default format is json', async () => {
    const result = await exportPrivilegedAudit({ verifyChain: false });
    expect(result.format).toBe('json');
  });
});

// ── Failure cases ─────────────────────────────────────────────────────────────

describe('exportPrivilegedAudit — failure cases', () => {
  it('failure: throws AuditExportError for unsupported format', async () => {
    await expect(
      exportPrivilegedAudit({ format: 'xml' as 'json', verifyChain: false }),
    ).rejects.toThrow(AuditExportError);

    await expect(
      exportPrivilegedAudit({ format: 'xml' as 'json', verifyChain: false }),
    ).rejects.toThrow('INVALID_FORMAT');
  });

  it('failure: throws AuditExportError for invalid "since" timestamp', async () => {
    await expect(
      exportPrivilegedAudit({ since: 'not-a-date', verifyChain: false }),
    ).rejects.toThrow(AuditExportError);

    await expect(
      exportPrivilegedAudit({ since: 'not-a-date', verifyChain: false }),
    ).rejects.toThrow('INVALID_TIME_RANGE');
  });

  it('failure: throws AuditExportError for invalid "until" timestamp', async () => {
    await expect(
      exportPrivilegedAudit({ until: 'bad-date', verifyChain: false }),
    ).rejects.toThrow(AuditExportError);
  });

  it('failure: throws AuditExportError when since is after until', async () => {
    await expect(
      exportPrivilegedAudit({
        since: '2026-12-31T00:00:00.000Z',
        until: '2026-01-01T00:00:00.000Z',
        verifyChain: false,
      }),
    ).rejects.toThrow(AuditExportError);

    await expect(
      exportPrivilegedAudit({
        since: '2026-12-31T00:00:00.000Z',
        until: '2026-01-01T00:00:00.000Z',
        verifyChain: false,
      }),
    ).rejects.toThrow('INVALID_TIME_RANGE');
  });

  it('failure: throws AuditExportError with CHAIN_INTEGRITY_FAILURE when chain is broken', async () => {
    await seedPrivilegedEntries();

    // Tamper with the audit chain by directly mocking verifyAuditChain
    const auditModule = await import('../../../src/utils/audit');
    const spy = vi.spyOn(auditModule, 'verifyAuditChain').mockResolvedValueOnce({
      valid: false,
      brokenAt: 1,
      reason: 'hash mismatch',
    });

    await expect(
      exportPrivilegedAudit({ verifyChain: true }),
    ).rejects.toThrow(AuditExportError);

    await expect(
      exportPrivilegedAudit({ verifyChain: true }),
    ).rejects.toThrow('CHAIN_INTEGRITY_FAILURE');

    spy.mockRestore();
  });

  it('AuditExportError carries the correct code', async () => {
    let caught: AuditExportError | null = null;
    try {
      await exportPrivilegedAudit({ format: 'xml' as 'json', verifyChain: false });
    } catch (err) {
      caught = err as AuditExportError;
    }
    expect(caught).not.toBeNull();
    expect(caught!.code).toBe('INVALID_FORMAT');
    expect(caught!.name).toBe('AuditExportError');
    expect(caught instanceof Error).toBe(true);
  });
});
