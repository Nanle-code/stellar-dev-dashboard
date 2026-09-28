/**
 * dashboardLayouts.ts — Issue #341
 * Manages multiple dashboard layouts with save/load/switch/import/export functionality.
 * Enhanced with: layout versioning, history tracking, URL-hash sharing, and strict validation.
 */

import { getStoredValue, setStoredValue } from './storage'
import { getDashboardLayout, saveDashboardLayout } from './userPreferences'
import type { WidgetConfig, WidgetLayout } from '../components/dashboard/types'

/** Schema version for export format — bump when format changes */
export const LAYOUT_SCHEMA_VERSION = 2

export interface DashboardLayout {
  id: string
  name: string
  description?: string
  widgets: WidgetConfig[]
  createdAt: string
  updatedAt: string
  isPreset?: boolean
  isShared?: boolean
  /** Internal schema version for forward-compat checks */
  schemaVersion?: number
  /** Tags for categorisation / search */
  tags?: string[]
}

/** Envelope written to .json files and URL hashes */
export interface LayoutExportEnvelope {
  /** Always 'stellar-dashboard-layout' */
  type: 'stellar-dashboard-layout'
  /** Schema version of this export format */
  version: number
  exportedAt: string
  exportedBy?: string
  layout: DashboardLayout
}

/** A single entry in the layout history ring-buffer */
export interface LayoutHistoryEntry {
  id: string
  layoutId: string
  layoutName: string
  widgets: WidgetConfig[]
  savedAt: string
  /** Human-friendly reason e.g. 'before-switch', 'auto-save' */
  reason?: string
}

export interface LayoutPreset {
  id: string
  name: string
  description: string
  icon: string
  widgets: WidgetConfig[]
  category: 'productivity' | 'monitoring' | 'trading' | 'development' | 'minimal'
}

/** Validation result returned by validateLayoutEnvelope */
export interface LayoutValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

const LAYOUTS_KEY = 'dashboard-layouts-v1'
const ACTIVE_LAYOUT_KEY = 'active-dashboard-layout-v1'
const HISTORY_KEY = 'dashboard-layout-history-v1'
const MAX_HISTORY_ENTRIES = 20

/** All widget types the dashboard knows about */
const KNOWN_WIDGET_TYPES = [
  'balance', 'assets', 'transactions', 'networkStats', 'accountStats',
  'quickActions', 'priceTicker', 'ledgerStats', 'congestionForecast', 'dataInsights', 'portfolio',
]

/**
 * Generate a unique ID for layouts
 */
export function generateLayoutId(): string {
  return `layout-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

/**
 * Create a new empty layout
 */
export function createEmptyLayout(name: string): DashboardLayout {
  return {
    id: generateLayoutId(),
    name,
    widgets: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

/**
 * Load all saved layouts
 */
export async function loadAllLayouts(): Promise<DashboardLayout[]> {
  try {
    const stored = await getStoredValue(LAYOUTS_KEY) as DashboardLayout[] | null
    return stored || []
  } catch {
    return []
  }
}

/**
 * Save a layout (create or update)
 */
export async function saveLayout(layout: DashboardLayout): Promise<DashboardLayout> {
  const layouts = await loadAllLayouts()
  const existingIndex = layouts.findIndex(l => l.id === layout.id)
  
  const updatedLayout = {
    ...layout,
    updatedAt: new Date().toISOString(),
  }
  
  if (existingIndex >= 0) {
    layouts[existingIndex] = updatedLayout
  } else {
    layouts.push(updatedLayout)
  }
  
  await setStoredValue(LAYOUTS_KEY, layouts)
  return updatedLayout
}

/**
 * Delete a layout by ID
 */
export async function deleteLayout(layoutId: string): Promise<void> {
  const layouts = await loadAllLayouts()
  const filtered = layouts.filter(l => l.id !== layoutId)
  await setStoredValue(LAYOUTS_KEY, filtered)
  
  // If deleted layout was active, clear active layout
  const activeId = await getActiveLayoutId()
  if (activeId === layoutId) {
    await setActiveLayout(null)
  }
}

/**
 * Get the active layout ID
 */
export async function getActiveLayoutId(): Promise<string | null> {
  try {
    const stored = await getStoredValue(ACTIVE_LAYOUT_KEY) as string | null
    return stored
  } catch {
    return null
  }
}

/**
 * Set the active layout by ID
 */
export async function setActiveLayout(layoutId: string | null): Promise<void> {
  if (layoutId) {
    await setStoredValue(ACTIVE_LAYOUT_KEY, layoutId)
  } else {
    await setStoredValue(ACTIVE_LAYOUT_KEY, null)
  }
}

/**
 * Get the active layout with its widgets
 */
export async function getActiveLayout(): Promise<DashboardLayout | null> {
  const activeId = await getActiveLayoutId()
  if (!activeId) return null
  
  const layouts = await loadAllLayouts()
  return layouts.find(l => l.id === activeId) || null
}

/**
 * Duplicate an existing layout
 */
export async function duplicateLayout(layoutId: string, newName?: string): Promise<DashboardLayout> {
  const layouts = await loadAllLayouts()
  const original = layouts.find(l => l.id === layoutId)
  
  if (!original) {
    throw new Error('Layout not found')
  }
  
  const duplicated: DashboardLayout = {
    ...original,
    id: generateLayoutId(),
    name: newName || `${original.name} (Copy)`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isPreset: false,
    isShared: false,
  }
  
  await saveLayout(duplicated)
  return duplicated
}

// ─── Layout History ────────────────────────────────────────────────────────────

/**
 * Load the layout history ring-buffer
 */
export async function loadLayoutHistory(): Promise<LayoutHistoryEntry[]> {
  try {
    const stored = await getStoredValue(HISTORY_KEY) as LayoutHistoryEntry[] | null
    return stored || []
  } catch {
    return []
  }
}

/**
 * Push a snapshot to the history ring-buffer (keeps newest MAX_HISTORY_ENTRIES)
 */
export async function pushLayoutHistory(
  layout: DashboardLayout,
  reason: string = 'auto-save'
): Promise<void> {
  const history = await loadLayoutHistory()
  const entry: LayoutHistoryEntry = {
    id: generateLayoutId(),
    layoutId: layout.id,
    layoutName: layout.name,
    widgets: layout.widgets,
    savedAt: new Date().toISOString(),
    reason,
  }
  const updated = [entry, ...history].slice(0, MAX_HISTORY_ENTRIES)
  await setStoredValue(HISTORY_KEY, updated)
}

/**
 * Clear all history entries
 */
export async function clearLayoutHistory(): Promise<void> {
  await setStoredValue(HISTORY_KEY, [])
}

// ─── Validation ────────────────────────────────────────────────────────────────

/**
 * Strictly validate a parsed layout export envelope.
 * Returns { valid, errors[], warnings[] }.
 */
export function validateLayoutEnvelope(parsed: unknown): LayoutValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  if (!parsed || typeof parsed !== 'object') {
    errors.push('Input is not a JSON object.')
    return { valid: false, errors, warnings }
  }

  const obj = parsed as Record<string, unknown>

  // Envelope type
  if (obj.type !== 'stellar-dashboard-layout') {
    errors.push(`Unknown envelope type: "${obj.type}". Expected "stellar-dashboard-layout".`)
  }

  // Version check
  const version = typeof obj.version === 'number' ? obj.version : 0
  if (version < 1) {
    errors.push('Missing or invalid "version" field in export envelope.')
  } else if (version > LAYOUT_SCHEMA_VERSION) {
    warnings.push(`This layout was exported with schema version ${version} (current: ${LAYOUT_SCHEMA_VERSION}). Some features may not be supported.`)
  }

  // Layout object
  if (!obj.layout || typeof obj.layout !== 'object') {
    errors.push('Missing "layout" object in export envelope.')
    return { valid: errors.length === 0, errors, warnings }
  }

  const layout = obj.layout as Record<string, unknown>

  if (typeof layout.name !== 'string' || !layout.name.trim()) {
    errors.push('Layout must have a non-empty "name" string.')
  }
  if (layout.name && (layout.name as string).length > 80) {
    warnings.push('Layout name is longer than 80 characters and will be truncated.')
  }

  if (!Array.isArray(layout.widgets)) {
    errors.push('Layout "widgets" must be an array.')
  } else {
    if (layout.widgets.length === 0) {
      warnings.push('Layout has no widgets — it will create an empty dashboard.')
    }
    if (layout.widgets.length > 20) {
      warnings.push(`Layout has ${layout.widgets.length} widgets. Large layouts may affect performance.`)
    }

    const widgetIds = new Set<string>()
    ;(layout.widgets as unknown[]).forEach((w, i) => {
      if (!w || typeof w !== 'object') {
        errors.push(`Widget at index ${i} is not an object.`)
        return
      }
      const widget = w as Record<string, unknown>

      if (typeof widget.id !== 'string' || !widget.id.trim()) {
        errors.push(`Widget at index ${i} is missing a valid "id".`)
      } else if (widgetIds.has(widget.id as string)) {
        warnings.push(`Duplicate widget id "${widget.id}" found — one will be discarded.`)
      } else {
        widgetIds.add(widget.id as string)
      }

      if (typeof widget.type !== 'string' || !widget.type.trim()) {
        errors.push(`Widget at index ${i} is missing a valid "type".`)
      } else if (!KNOWN_WIDGET_TYPES.includes(widget.type as string)) {
        warnings.push(`Widget type "${widget.type}" is not recognised and will be rendered with a fallback.`)
      }

      if (typeof widget.height !== 'number' || widget.height < 100 || widget.height > 2000) {
        warnings.push(`Widget ${i} has an unusual height (${widget.height}). Clamping to [100, 2000].`)
      }
      if (typeof widget.span !== 'number' || widget.span < 1 || widget.span > 4) {
        warnings.push(`Widget ${i} has an unusual span (${widget.span}). Clamping to [1, 4].`)
      }
    })
  }

  return { valid: errors.length === 0, errors, warnings }
}

/**
 * Sanitise a raw layout object after import — clamp numerics, strip unknowns.
 */
function sanitiseLayout(raw: DashboardLayout): DashboardLayout {
  return {
    ...raw,
    name: (raw.name || 'Imported Layout').slice(0, 80),
    description: raw.description ? raw.description.slice(0, 300) : undefined,
    widgets: (raw.widgets || []).map((w, i) => ({
      id: (w.id || generateLayoutId()).trim(),
      type: (w.type || 'balance').trim(),
      height: Math.max(100, Math.min(2000, Number(w.height) || 260)),
      span: Math.max(1, Math.min(4, Number(w.span) || 1)),
      order: i,
    })),
    tags: Array.isArray(raw.tags) ? raw.tags.slice(0, 10) : undefined,
  }
}

// ─── Export / Import ──────────────────────────────────────────────────────────

/**
 * Export a layout to a versioned JSON envelope string.
 */
export function exportLayout(layout: DashboardLayout): string {
  const envelope: LayoutExportEnvelope = {
    type: 'stellar-dashboard-layout',
    version: LAYOUT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    layout: { ...layout, schemaVersion: LAYOUT_SCHEMA_VERSION },
  }
  return JSON.stringify(envelope, null, 2)
}

/**
 * Encode a layout as a URL-safe base64 string for hash-based sharing.
 *
 * Uses base64url (`-`/`_`, no padding) so the token survives being placed in a
 * URL fragment, and UTF-8-safe so non-Latin layout names don't throw.
 */
export function encodeLayoutForUrl(layout: DashboardLayout): string {
  return encodeBase64Url(exportLayout(layout))
}

/**
 * Decode a layout from a URL hash share token.
 * Returns null if the token is invalid.
 *
 * Accepts both base64url (current) and standard base64 (legacy links), since
 * the base64url alphabet translation is a no-op for standard base64.
 */
export function decodeLayoutFromUrl(token: string): DashboardLayout | null {
  try {
    return importLayout(decodeBase64Url(token))
  } catch {
    return null
  }
}

/** UTF-8 safe base64url encode. */
function encodeBase64Url(input: string): string {
  return btoa(unescape(encodeURIComponent(input)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

/** UTF-8 safe base64url decode; tolerates standard base64 and missing padding. */
function decodeBase64Url(input: string): string {
  const normalised = input.trim().replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalised + '='.repeat((4 - (normalised.length % 4)) % 4)
  return decodeURIComponent(escape(atob(padded)))
}

/**
 * Build a shareable URL with the layout encoded in the hash.
 */
export function buildShareUrl(layout: DashboardLayout): string {
  const token = encodeLayoutForUrl(layout)
  const base = typeof window !== 'undefined' ? window.location.href.split('#')[0] : ''
  return `${base}#layout=${token}`
}

/**
 * Many browsers, proxies and chat clients silently truncate URLs past ~2 KB, so
 * a large layout can produce a share link that no longer opens.
 */
export const MAX_SAFE_SHARE_URL_LENGTH = 8000

export interface ShareUrlDiagnostics {
  url: string
  /** Length of the full share URL. */
  length: number
  /** False when the link is likely to be truncated in transit. */
  isSafe: boolean
  /** User-facing warning, or null when the link is fine. */
  warning: string | null
}

/**
 * Build a share URL and report whether it is likely to survive transit.
 * Callers should surface `warning` so users can fall back to a .json file.
 */
export function buildShareUrlWithDiagnostics(layout: DashboardLayout): ShareUrlDiagnostics {
  const url = buildShareUrl(layout)
  const length = url.length
  const isSafe = length <= MAX_SAFE_SHARE_URL_LENGTH
  return {
    url,
    length,
    isSafe,
    warning: isSafe
      ? null
      : `This layout is large, so the share link (${length.toLocaleString()} characters) may be truncated by some browsers or chat apps. Prefer downloading the .json file instead.`,
  }
}

/**
 * Check current URL hash for an embedded layout and return it if present.
 * Returns null if none found.
 */
export function extractLayoutFromCurrentUrl(): DashboardLayout | null {
  const hash = window.location.hash
  const match = hash.match(/[#&]layout=([^&]+)/)
  if (!match) return null
  return decodeLayoutFromUrl(match[1])
}

/**
 * Decode raw user input (JSON text or a base64 share token) into a parsed
 * object, upgrading the legacy v1 envelope shape on the way through.
 *
 * Shared by importLayout and the import form's live validator so both agree on
 * what counts as parseable input.
 */
export function parseLayoutInput(input: string): unknown {
  let rawJson = input.trim()

  // Auto-detect base64 share token (no curly brace = likely base64)
  if (!rawJson.startsWith('{')) {
    try {
      rawJson = decodeBase64Url(rawJson)
    } catch {
      throw new Error('Input does not look like valid JSON or a share token.')
    }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(rawJson)
  } catch {
    throw new Error('Input is not valid JSON.')
  }

  // Support legacy v1 format (no type field)
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const obj = parsed as Record<string, unknown>
    if (!obj.type && obj.layout) {
      obj.type = 'stellar-dashboard-layout'
      obj.version = obj.version || 1
    }
  }

  return parsed
}

/**
 * Import a layout from a JSON string (raw JSON or base64-encoded share token).
 * Performs strict validation and sanitisation.
 */
export function importLayout(jsonString: string): DashboardLayout {
  const parsed = parseLayoutInput(jsonString)

  const validation = validateLayoutEnvelope(parsed)
  if (!validation.valid) {
    throw new Error(
      `Layout validation failed:\n• ${validation.errors.join('\n• ')}`
    )
  }

  const rawLayout = (parsed as LayoutExportEnvelope).layout
  const sanitised = sanitiseLayout(rawLayout)

  // Assign a fresh ID to prevent collisions with existing layouts
  const imported: DashboardLayout = {
    ...sanitised,
    id: generateLayoutId(),
    name: sanitised.name.endsWith('(Imported)') ? sanitised.name : `${sanitised.name} (Imported)`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isPreset: false,
    isShared: false,
    schemaVersion: LAYOUT_SCHEMA_VERSION,
  }

  return imported
}

// ─── Applying layouts (single source of truth) ────────────────────────────────

/**
 * Resolve the layout the user is currently looking at.
 *
 * Prefers a named saved layout, but falls back to the legacy single-layout
 * store so export still works before the user has ever saved a named layout.
 */
export async function getEffectiveActiveLayout(): Promise<DashboardLayout> {
  const active = await getActiveLayout()
  if (active) return active

  const legacy = await getDashboardLayout()
  const now = new Date().toISOString()
  const widgets: WidgetConfig[] = (legacy || []).map((w, index) => ({
    id: w.id,
    type: w.type,
    height: w.height || 260,
    span: Math.max(1, Number(w.span) || 1),
    order: index,
  }))

  return {
    id: 'active-dashboard-layout',
    name: 'Current Layout',
    description: 'Auto-captured from your current dashboard',
    widgets,
    createdAt: now,
    updatedAt: now,
  }
}

/**
 * Persist `layout` as the active layout and mirror it into the legacy
 * single-layout store so Overview hydrates the same widget set.
 *
 * Every mutation path (import, preset, history restore, share-link accept)
 * should go through here so the two stores can't drift apart.
 */
export async function applyLayout(
  layout: DashboardLayout,
  options: { snapshotPrevious?: boolean; reason?: string } = {}
): Promise<DashboardLayout> {
  const { snapshotPrevious = true, reason = 'before-import' } = options

  if (snapshotPrevious) {
    const previous = await getEffectiveActiveLayout()
    if (previous.widgets.length > 0) {
      await pushLayoutHistory(previous, reason)
    }
  }

  await saveLayout(layout)
  await setActiveLayout(layout.id)
  await saveDashboardLayout(configsToLayouts(layout.widgets))

  return layout
}

/**
 * Snapshot a widget set into history without requiring a saved layout.
 * Used to make drag/resize/add/remove undoable.
 */
export async function snapshotWidgetLayout(
  widgets: WidgetConfig[],
  reason: string = 'before-edit',
  layoutName: string = 'Current Layout',
): Promise<void> {
  if (!widgets || widgets.length === 0) return

  const now = new Date().toISOString()
  await pushLayoutHistory(
    {
      id: 'active-dashboard-layout',
      name: layoutName,
      widgets,
      createdAt: now,
      updatedAt: now,
    },
    reason,
  )
}

/**
 * Preset layouts library
 */
export const PRESET_LAYOUTS: LayoutPreset[] = [
  {
    id: 'preset-default',
    name: 'Default',
    description: 'Balanced overview with essential widgets',
    icon: '📊',
    category: 'productivity',
    widgets: [
      { id: 'balance-preset', type: 'balance', height: 260, span: 1 },
      { id: 'assets-preset', type: 'assets', height: 320, span: 1 },
      { id: 'transactions-preset', type: 'transactions', height: 360, span: 2 },
      { id: 'networkStats-preset', type: 'networkStats', height: 300, span: 1 },
    ],
  },
  {
    id: 'preset-trading',
    name: 'Trading Focus',
    description: 'Market data and portfolio analytics',
    icon: '📈',
    category: 'trading',
    widgets: [
      { id: 'priceTicker-preset', type: 'priceTicker', height: 250, span: 1 },
      { id: 'portfolio-preset', type: 'portfolio', height: 400, span: 2 },
      { id: 'assets-preset', type: 'assets', height: 320, span: 1 },
      { id: 'transactions-preset', type: 'transactions', height: 360, span: 2 },
    ],
  },
  {
    id: 'preset-monitoring',
    name: 'Network Monitor',
    description: 'Network stats and ledger information',
    icon: '🌐',
    category: 'monitoring',
    widgets: [
      { id: 'networkStats-preset', type: 'networkStats', height: 300, span: 2 },
      { id: 'ledgerStats-preset', type: 'ledgerStats', height: 320, span: 2 },
      { id: 'accountStats-preset', type: 'accountStats', height: 400, span: 1 },
    ],
  },
  {
    id: 'preset-minimal',
    name: 'Minimal',
    description: 'Clean layout with just essentials',
    icon: '✨',
    category: 'minimal',
    widgets: [
      { id: 'balance-minimal', type: 'balance', height: 260, span: 1 },
      { id: 'transactions-minimal', type: 'transactions', height: 360, span: 1 },
    ],
  },
  {
    id: 'preset-developer',
    name: 'Developer',
    description: 'Technical details and account info',
    icon: '⚙️',
    category: 'development',
    widgets: [
      { id: 'accountStats-preset', type: 'accountStats', height: 400, span: 1 },
      { id: 'networkStats-preset', type: 'networkStats', height: 300, span: 1 },
      { id: 'transactions-preset', type: 'transactions', height: 360, span: 2 },
      { id: 'ledgerStats-preset', type: 'ledgerStats', height: 320, span: 1 },
    ],
  },
  {
    id: 'preset-productivity',
    name: 'Productivity',
    description: 'Quick actions and recent activity',
    icon: '🚀',
    category: 'productivity',
    widgets: [
      { id: 'quickActions-preset', type: 'quickActions', height: 280, span: 1 },
      { id: 'balance-preset', type: 'balance', height: 260, span: 1 },
      { id: 'transactions-preset', type: 'transactions', height: 360, span: 2 },
      { id: 'assets-preset', type: 'assets', height: 320, span: 1 },
    ],
  },
]

/**
 * Convert WidgetConfig to WidgetLayout for storage
 */
export function configToLayout(config: WidgetConfig): WidgetLayout {
  return {
    id: config.id,
    type: config.type,
    height: config.height,
    span: config.span,
    order: 0,
  }
}

/**
 * Convert WidgetLayout to WidgetConfig
 */
export function layoutToConfig(layout: WidgetLayout): WidgetConfig {
  return {
    id: layout.id,
    type: layout.type,
    height: layout.height,
    span: layout.span,
  }
}

/**
 * Convert array of WidgetConfig to WidgetLayout array
 */
export function configsToLayouts(configs: WidgetConfig[]): WidgetLayout[] {
  return configs.map((config, index) => ({
    id: config.id,
    type: config.type,
    height: config.height,
    span: config.span,
    order: index,
  }))
}

/**
 * Convert array of WidgetLayout to WidgetConfig array
 */
export function layoutsToConfigs(layouts: WidgetLayout[]): WidgetConfig[] {
  return layouts.map(layout => layoutToConfig(layout))
}