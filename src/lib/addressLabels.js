import { getStoredValue, setStoredValue } from './storage'

// ─── Constants ─────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'address-labels-v2'

export const CATEGORIES = [
  { value: 'personal',   label: 'Personal',   color: '#06b6d4' },
  { value: 'exchange',   label: 'Exchange',   color: '#f59e0b' },
  { value: 'defi',       label: 'DeFi',        color: '#8b5cf6' },
  { value: 'nft',        label: 'NFT',         color: '#ec4899' },
  { value: 'custodial',  label: 'Custodial',   color: '#6366f1' },
  { value: 'contract',   label: 'Contract',    color: '#14b8a6' },
  { value: 'other',      label: 'Other',       color: '#6b7280' },
]

export const LABEL_COLORS = [
  { value: '#06b6d4', label: 'Cyan' },
  { value: '#22c55e', label: 'Green' },
  { value: '#f59e0b', label: 'Amber' },
  { value: '#ef4444', label: 'Red' },
  { value: '#8b5cf6', label: 'Purple' },
  { value: '#ec4899', label: 'Pink' },
  { value: '#6366f1', label: 'Indigo' },
  { value: '#14b8a6', label: 'Teal' },
  { value: '#6b7280', label: 'Gray' },
]

export const DEFAULT_TAGS = [
  'hot-wallet', 'cold-storage', 'multisig', 'personal',
  'business', 'trading', 'liquidity', 'validator',
]

// ─── Types (JSDoc) ─────────────────────────────────────────────────────────────
/*
 * @typedef {Object} LabelEntry
 * @property {string}   address   - Stellar public key (G...)
 * @property {string}   label     - Display name
 * @property {string[]} tags      - Arbitrary tags
 * @property {string}   category  - One of CATEGORIES values
 * @property {string}   color     - Hex color from LABEL_COLORS
 * @property {boolean}  favorite  - Starred for quick access
 * @property {string}   notes     - Optional notes
 * @property {string}   network   - Network context
 * @property {string}   createdAt - ISO timestamp
 * @property {string}   updatedAt - ISO timestamp
 */

// ─── In-memory cache ───────────────────────────────────────────────────────────

let _cache = null
let _listeners = new Set()

function notifyListeners() {
  _listeners.forEach((fn) => {
    try { fn(_cache || []) } catch { /* ignore */ }
  })
}

function makeEntry(address, data) {
  return {
    address,
    label: data.label || address.slice(0, 8),
    tags: data.tags || [],
    category: data.category || 'other',
    color: data.color || undefined,
    favorite: !!data.favorite,
    notes: data.notes || '',
    network: data.network || 'all',
    createdAt: data.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

// ─── Persistence ───────────────────────────────────────────────────────────────

async function loadAll() {
  if (_cache) return _cache
  try {
    const stored = await getStoredValue(STORAGE_KEY)
    _cache = Array.isArray(stored) ? stored : []
  } catch {
    _cache = []
  }
  return _cache
}

async function persistAll() {
  try {
    await setStoredValue(STORAGE_KEY, _cache || [])
  } catch { /* ignore */ }
}

// ─── CRUD ──────────────────────────────────────────────────────────────────────

export async function addLabel(address, data) {
  const list = await loadAll()
  const idx = list.findIndex((e) => e.address === address)
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...makeEntry(address, data), updatedAt: new Date().toISOString() }
  } else {
    list.push(makeEntry(address, data))
  }
  _cache = list
  await persistAll()
  notifyListeners()
  return _cache
}

export async function updateLabel(address, data) {
  const list = await loadAll()
  const idx = list.findIndex((e) => e.address === address)
  if (idx < 0) return _cache
  list[idx] = { ...list[idx], ...data, updatedAt: new Date().toISOString() }
  _cache = list
  await persistAll()
  notifyListeners()
  return _cache
}

export async function removeLabel(address) {
  const list = await loadAll()
  _cache = list.filter((e) => e.address !== address)
  await persistAll()
  notifyListeners()
  return _cache
}

export async function getLabel(address) {
  const list = await loadAll()
  return list.find((e) => e.address === address) || null
}

export async function getAllLabels() {
  return loadAll()
}

export async function getLabelsByTag(tag) {
  const list = await loadAll()
  return list.filter((e) => e.tags.includes(tag))
}

export async function getLabelsByCategory(category) {
  const list = await loadAll()
  return list.filter((e) => e.category === category)
}

export async function getFavoriteLabels() {
  const list = await loadAll()
  return list.filter((e) => e.favorite)
}

export async function searchLabels(query) {
  const list = await loadAll()
  const q = query.toLowerCase()
  return list.filter(
    (e) =>
      e.label.toLowerCase().includes(q) ||
      e.address.toLowerCase().includes(q) ||
      e.tags.some((t) => t.toLowerCase().includes(q)) ||
      e.notes.toLowerCase().includes(q)
  )
}

export async function getAllTags() {
  const list = await loadAll()
  const tags = new Set()
  list.forEach((e) => e.tags.forEach((t) => tags.add(t)))
  return Array.from(tags).sort()
}

export async function bulkImport(labels) {
  const list = await loadAll()
  labels.forEach((entry) => {
    const idx = list.findIndex((e) => e.address === entry.address)
    const newEntry = makeEntry(entry.address, entry)
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...newEntry }
    } else {
      list.push(newEntry)
    }
  })
  _cache = list
  await persistAll()
  notifyListeners()
  return _cache
}

// ─── React Hook ────────────────────────────────────────────────────────────────

export function subscribe(fn) {
  _listeners.add(fn)
  return () => _listeners.delete(fn)
}

export function getCachedLabels() {
  return _cache || []
}

export default {
  addLabel,
  updateLabel,
  removeLabel,
  getLabel,
  getAllLabels,
  getLabelsByTag,
  getLabelsByCategory,
  getFavoriteLabels,
  searchLabels,
  getAllTags,
  bulkImport,
  subscribe,
  getCachedLabels,
  CATEGORIES,
  LABEL_COLORS,
  DEFAULT_TAGS,
}
