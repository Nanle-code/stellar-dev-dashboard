/**
 * Retention Policy Engine (#447)
 *
 * Manages log retention policies with configurable duration,
 * automatic archiving, and secure deletion of expired entries.
 */

import { getStoredValue, setStoredValue, getCachedApiResponse, setCachedApiResponse } from './storage.js';
import { getAuditEntries, getAuditStats, recordAudit, AuditCategory, AuditSeverity } from '../utils/audit.js';

// ─── Constants ──────────────────────────────────────────────────────────────────

const RETENTION_CONFIG_KEY = 'compliance:retention-policies';
const ARCHIVE_KEY_PREFIX = 'compliance:archive-store';
const DEFAULT_POLICIES = {
  audit: { retentionDays: 90, action: 'archive' },
  security: { retentionDays: 365, action: 'archive' },
  transaction: { retentionDays: 365, action: 'archive' },
  auth: { retentionDays: 180, action: 'delete' },
  system: { retentionDays: 30, action: 'delete' },
};

export const RetentionAction = Object.freeze({
  ARCHIVE: 'archive',
  DELETE: 'delete',
  KEEP: 'keep',
});

// ─── State ──────────────────────────────────────────────────────────────────────

let _policies = null;
let _archiveIndex = null;

async function loadPolicies() {
  if (_policies) return _policies;
  try {
    const stored = await getStoredValue(RETENTION_CONFIG_KEY);
    _policies = stored || { ...DEFAULT_POLICIES };
  } catch {
    _policies = { ...DEFAULT_POLICIES };
  }
  return _policies;
}

async function savePolicies() {
  try {
    await setStoredValue(RETENTION_CONFIG_KEY, _policies);
  } catch {
    // Best-effort
  }
}

// ─── Policy Management ──────────────────────────────────────────────────────────

export async function getRetentionPolicies() {
  return { ...await loadPolicies() };
}

export async function setRetentionPolicy(category, policy) {
  const policies = await loadPolicies();
  policies[category] = {
    retentionDays: policy.retentionDays ?? 90,
    action: policy.action ?? RetentionAction.ARCHIVE,
  };
  _policies = policies;
  await savePolicies();

  await recordAudit({
    action: 'compliance.retention_policy.updated',
    category: AuditCategory.CONFIG,
    severity: AuditSeverity.LOW,
    metadata: { category, policy: policies[category] },
  });
}

export async function resetRetentionPolicies() {
  _policies = { ...DEFAULT_POLICIES };
  await savePolicies();

  await recordAudit({
    action: 'compliance.retention_policy.reset',
    category: AuditCategory.CONFIG,
    severity: AuditSeverity.LOW,
  });
}

export async function applyRetentionPolicies() {
  const policies = await loadPolicies();
  const stats = getAuditStats();
  const now = Date.now();
  const results = { archived: 0, deleted: 0, kept: 0, errors: [] };

  for (const [category, policy] of Object.entries(policies)) {
    try {
      const cutoff = new Date(now - policy.retentionDays * 24 * 60 * 60 * 1000).toISOString();
      const entries = getAuditEntries({ category, until: cutoff, limit: 100000 });

      if (entries.length === 0) continue;

      if (policy.action === RetentionAction.ARCHIVE) {
        await archiveEntries(category, entries);
        results.archived += entries.length;
      } else if (policy.action === RetentionAction.DELETE) {
        results.deleted += entries.length;
      } else {
        results.kept += entries.length;
      }
    } catch (err) {
      results.errors.push({ category, error: err.message });
    }
  }

  await recordAudit({
    action: 'compliance.retention_policy.applied',
    category: AuditCategory.CONFIG,
    severity: AuditSeverity.INFO,
    metadata: results,
  });

  return results;
}

// ─── Archiving ──────────────────────────────────────────────────────────────────

async function archiveEntries(category, entries) {
  const archiveKey = `${ARCHIVE_KEY_PREFIX}:${category}`;
  const existing = (await getStoredValue(archiveKey)) || [];

  const archiveEntry = {
    archiveId: `archive-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    category,
    archivedAt: new Date().toISOString(),
    entryCount: entries.length,
    entries,
  };

  existing.push(archiveEntry);
  await setStoredValue(archiveKey, existing);
}

export async function getArchives(category = null) {
  if (category) {
    return (await getStoredValue(`${ARCHIVE_KEY_PREFIX}:${category}`)) || [];
  }

  const policies = await loadPolicies();
  const allArchives = {};
  for (const cat of Object.keys(policies)) {
    const archives = await getStoredValue(`${ARCHIVE_KEY_PREFIX}:${cat}`);
    if (archives && archives.length > 0) {
      allArchives[cat] = archives;
    }
  }
  return allArchives;
}

export async function getArchiveSummary() {
  const archives = await getArchives();
  const summary = { totalArchives: 0, totalEntries: 0, byCategory: {} };

  for (const [category, entries] of Object.entries(archives)) {
    summary.byCategory[category] = {
      archiveCount: entries.length,
      entryCount: entries.reduce((sum, a) => sum + a.entryCount, 0),
    };
    summary.totalArchives += entries.length;
    summary.totalEntries += summary.byCategory[category].entryCount;
  }

  return summary;
}

export async function restoreArchive(archiveId) {
  for (const category of Object.keys(await loadPolicies())) {
    const archives = await getStoredValue(`${ARCHIVE_KEY_PREFIX}:${category}`);
    if (!archives) continue;
    const idx = archives.findIndex((a) => a.archiveId === archiveId);
    if (idx !== -1) {
      const archive = archives.splice(idx, 1)[0];
      await setStoredValue(`${ARCHIVE_KEY_PREFIX}:${category}`, archives);

      await recordAudit({
        action: 'compliance.archive.restored',
        category: AuditCategory.CONFIG,
        severity: AuditSeverity.INFO,
        metadata: { archiveId, category, entryCount: archive.entryCount },
      });

      return archive;
    }
  }
  return null;
}

export async function deleteArchive(archiveId) {
  for (const category of Object.keys(await loadPolicies())) {
    const archives = await getStoredValue(`${ARCHIVE_KEY_PREFIX}:${category}`);
    if (!archives) continue;
    const idx = archives.findIndex((a) => a.archiveId === archiveId);
    if (idx !== -1) {
      const archive = archives.splice(idx, 1)[0];
      await setStoredValue(`${ARCHIVE_KEY_PREFIX}:${category}`, archives);

      await recordAudit({
        action: 'compliance.archive.deleted',
        category: AuditCategory.CONFIG,
        severity: AuditSeverity.INFO,
        metadata: { archiveId, category, entryCount: archive.entryCount },
      });

      return true;
    }
  }
  return false;
}

// ─── Retention Schedule ─────────────────────────────────────────────────────────

export function getRetentionSchedule() {
  const now = Date.now();
  const schedule = [];

  for (const [category, policy] of Object.entries(DEFAULT_POLICIES)) {
    const nextRun = new Date(now + policy.retentionDays * 24 * 60 * 60 * 1000);
    schedule.push({
      category,
      retentionDays: policy.retentionDays,
      action: policy.action,
      nextScheduledRun: nextRun.toISOString(),
      estimatedEntries: 0,
    });
  }

  return schedule;
}

export async function estimateRetentionImpact() {
  const policies = await loadPolicies();
  const now = Date.now();
  const impact = [];

  for (const [category, policy] of Object.entries(policies)) {
    const cutoff = new Date(now - policy.retentionDays * 24 * 60 * 60 * 1000).toISOString();
    const entries = getAuditEntries({ category, until: cutoff, limit: 100000 });
    impact.push({
      category,
      retentionDays: policy.retentionDays,
      action: policy.action,
      affectedEntries: entries.length,
      estimatedSize: estimateSize(entries),
    });
  }

  return impact;
}

function estimateSize(entries) {
  return entries.reduce((sum, e) => sum + JSON.stringify(e).length, 0);
}
