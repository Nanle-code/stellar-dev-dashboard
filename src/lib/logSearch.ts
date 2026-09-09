/**
 * Log Search, Filter, and Export (#447)
 *
 * Advanced search and filter engine for audit logs with
 * boolean expression support, saved searches, and bulk export.
 */

import { getAuditEntries, subscribeAudit, AuditCategory, AuditSeverity } from '../utils/audit.js';
import { downloadFile } from '../utils/export.js';

// ─── Types ──────────────────────────────────────────────────────────────────────

export const SearchOperator = Object.freeze({
  EQ: 'eq',
  NEQ: 'neq',
  CONTAINS: 'contains',
  NOT_CONTAINS: 'not_contains',
  GT: 'gt',
  GTE: 'gte',
  LT: 'lt',
  LTE: 'lte',
  IN: 'in',
  NOT_IN: 'not_in',
  EXISTS: 'exists',
  NOT_EXISTS: 'not_exists',
});

export const DateRangePreset = Object.freeze({
  LAST_HOUR: 'last_hour',
  LAST_24H: 'last_24h',
  LAST_7D: 'last_7d',
  LAST_30D: 'last_30d',
  LAST_90D: 'last_90d',
  CUSTOM: 'custom',
});

// ─── Filter Engine ──────────────────────────────────────────────────────────────

export class LogFilterEngine {
  constructor() {
    this._filters = [];
    this._subscribers = new Set();
  }

  addFilter(filter) {
    this._filters.push(filter);
    this._notify();
  }

  removeFilter(index) {
    this._filters.splice(index, 1);
    this._notify();
  }

  setFilters(filters) {
    this._filters = filters;
    this._notify();
  }

  clearFilters() {
    this._filters = [];
    this._notify();
  }

  getFilters() {
    return [...this._filters];
  }

  subscribe(handler) {
    this._subscribers.add(handler);
    return () => this._subscribers.delete(handler);
  }

  _notify() {
    for (const fn of this._subscribers) {
      try { fn(this._filters); } catch { /* swallow */ }
    }
  }

  apply(entries) {
    return this._filters.reduce((filtered, filter) => {
      return filtered.filter((entry) => this._matchEntry(entry, filter));
    }, entries);
  }

  _matchEntry(entry, filter) {
    const { field, operator, value } = filter;
    const fieldValue = this._getFieldValue(entry, field);

    switch (operator) {
      case SearchOperator.EQ:
        return fieldValue === value;
      case SearchOperator.NEQ:
        return fieldValue !== value;
      case SearchOperator.CONTAINS:
        return String(fieldValue || '').toLowerCase().includes(String(value).toLowerCase());
      case SearchOperator.NOT_CONTAINS:
        return !String(fieldValue || '').toLowerCase().includes(String(value).toLowerCase());
      case SearchOperator.GT:
        return new Date(fieldValue) > new Date(value);
      case SearchOperator.GTE:
        return new Date(fieldValue) >= new Date(value);
      case SearchOperator.LT:
        return new Date(fieldValue) < new Date(value);
      case SearchOperator.LTE:
        return new Date(fieldValue) <= new Date(value);
      case SearchOperator.IN:
        return Array.isArray(value) && value.includes(fieldValue);
      case SearchOperator.NOT_IN:
        return Array.isArray(value) && !value.includes(fieldValue);
      case SearchOperator.EXISTS:
        return fieldValue != null && fieldValue !== '';
      case SearchOperator.NOT_EXISTS:
        return fieldValue == null || fieldValue === '';
      default:
        return true;
    }
  }

  _getFieldValue(entry, field) {
    if (field.includes('.')) {
      return field.split('.').reduce((obj, key) => obj?.[key], entry);
    }
    return entry[field];
  }
}

export const logFilterEngine = new LogFilterEngine();

// ─── Date Range Helpers ─────────────────────────────────────────────────────────

export function getDateRangeForPreset(preset) {
  const now = Date.now();
  const to = new Date().toISOString();
  let from;

  switch (preset) {
    case DateRangePreset.LAST_HOUR:
      from = new Date(now - 60 * 60 * 1000).toISOString();
      break;
    case DateRangePreset.LAST_24H:
      from = new Date(now - 24 * 60 * 60 * 1000).toISOString();
      break;
    case DateRangePreset.LAST_7D:
      from = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
      break;
    case DateRangePreset.LAST_30D:
      from = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
      break;
    case DateRangePreset.LAST_90D:
      from = new Date(now - 90 * 24 * 60 * 60 * 1000).toISOString();
      break;
    default:
      from = null;
  }

  return { from, to };
}

// ─── Saved Searches ─────────────────────────────────────────────────────────────

const SAVED_SEARCHES_KEY = 'compliance:saved-searches';

export function getSavedSearches() {
  try {
    const raw = localStorage.getItem(SAVED_SEARCHES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveSearch(name, filters) {
  const searches = getSavedSearches();
  searches.push({
    id: `search-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    name,
    filters,
    createdAt: new Date().toISOString(),
  });
  try {
    localStorage.setItem(SAVED_SEARCHES_KEY, JSON.stringify(searches));
  } catch { /* ignore */ }
  return searches;
}

export function deleteSavedSearch(id) {
  const searches = getSavedSearches().filter((s) => s.id !== id);
  try {
    localStorage.setItem(SAVED_SEARCHES_KEY, JSON.stringify(searches));
  } catch { /* ignore */ }
  return searches;
}

// ─── Search Function ────────────────────────────────────────────────────────────

export function searchAuditLogs({
  query,
  category,
  severity,
  actor,
  since,
  until,
  outcome,
  sessionId,
  limit = 200,
  offset = 0,
} = {}) {
  let entries = getAuditEntries({ category, severity, actor, since, until, search: query, limit: limit + offset });

  if (outcome) {
    entries = entries.filter((e) => e.outcome === outcome);
  }

  if (sessionId) {
    entries = entries.filter((e) => e.sessionId === sessionId);
  }

  if (offset > 0) {
    entries = entries.slice(offset);
  }

  return entries.slice(0, limit);
}

export function searchAuditByExpression(expression) {
  const entries = getAuditEntries({ limit: 100000 });
  return logFilterEngine.apply(entries, expression);
}

// ─── Bulk Operations ────────────────────────────────────────────────────────────

export function searchCount({
  query,
  category,
  severity,
  actor,
  since,
  until,
  outcome,
} = {}) {
  return searchAuditLogs({ query, category, severity, actor, since, until, outcome, limit: 100000 }).length;
}

// ─── Export ─────────────────────────────────────────────────────────────────────

export function exportFilteredLogs({
  query,
  category,
  severity,
  actor,
  since,
  until,
  outcome,
  format = 'json',
  filename = 'audit-export',
} = {}) {
  const entries = searchAuditLogs({ query, category, severity, actor, since, until, outcome, limit: 50000 });

  switch (format) {
    case 'json': {
      const data = JSON.stringify({ exportedAt: new Date().toISOString(), count: entries.length, entries }, null, 2);
      downloadFile(data, `${filename}.json`);
      break;
    }
    case 'csv': {
      const headers = ['id', 'timestamp', 'severity', 'category', 'action', 'actor', 'target', 'outcome', 'sessionId', 'hash'];
      const escape = (v) => {
        if (v == null) return '';
        const s = typeof v === 'string' ? v : JSON.stringify(v);
        return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const rows = entries.map((e) => headers.map((h) => escape(e[h])).join(','));
      const csv = [headers.join(','), ...rows].join('\n');
      downloadFile(csv, `${filename}.csv`, 'text/csv');
      break;
    }
  }
}

// ─── Log Search Hook Support ────────────────────────────────────────────────────

export function subscribeLogSearch(handler) {
  return subscribeAudit((entry) => {
    handler(entry);
  });
}
