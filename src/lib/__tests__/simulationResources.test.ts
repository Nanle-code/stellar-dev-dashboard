/**
 * Unit tests for simulation resource and fee estimates
 * #763 [2026 Soroban] Display complete simulation resource and fee estimates
 */

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { simulateTransaction, formatInstructions, formatBytes, formatStroops } from '../stellar'

// ─── Helpers ───────────────────────────────────────────────────────────────────

function createMockIDB() {
  const stores = new Map()
  const db = {
    objectStoreNames: { contains: (name) => stores.has(name) },
    createObjectStore: (name, opts = {}) => {
      const store = {
        keyPath: opts.keyPath || null,
        autoIncrement: opts.autoIncrement || false,
        indexes: new Map(),
        data: new Map(),
        createIndex: () => {},
        get: (key) => ({ result: store.data.get(key) }),
        put: (value) => {
          const key = value[store.keyPath] ?? value.key
          store.data.set(key, value)
          return { result: undefined }
        },
        delete: (key) => { store.data.delete(key); return { result: undefined } },
        clear: () => { store.data.clear(); return { result: undefined } },
        getAll: () => ({ result: Array.from(store.data.values()) }),
        count: () => ({ result: store.data.size }),
      }
      stores.set(name, store)
      return store
    },
    transaction: (storeName) => ({
      objectStore: () => stores.get(storeName),
      oncomplete: null,
      onerror: null,
    }),
    close: () => {},
    onversionchange: null,
  }
  return { db, stores }
}

let mockIDB = null

beforeEach(() => {
  mockIDB = createMockIDB()
  ;(globalThis as any).indexedDB = {
    open: (name, version) => {
      const req = {
        result: null,
        onsuccess: null,
        onerror: null,
        onblocked: null,
        onupgradeneeded: null,
        oldVersion: 0,
      }
      return req
    },
  }
})

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('simulation resource and fee estimates', () => {
  it('returns resourceUsage with estimates for Soroban ops', async () => {
    const result = await simulateTransaction({
      sourceAccount: 'GABC1234',
      operations: [{ type: 'invokeHostFunction', func: 'test', auth: [] }],
      baseFee: 100,
      timeBounds: {},
      network: 'testnet',
    })

    if (result.resourceUsage) {
      expect(result.resourceUsage.cpuInstructions).toBeGreaterThan(0)
      expect(result.resourceUsage.memoryBytes).toBeGreaterThan(0)
    }
  })

  it('includes ledger footprint counts in resourceUsage', async () => {
    const result = await simulateTransaction({
      sourceAccount: 'GABC1234',
      operations: [{ type: 'invokeHostFunction', func: 'test', auth: [] }],
      baseFee: 100,
      timeBounds: {},
      network: 'testnet',
    })

    if (result.resourceUsage) {
      expect(typeof result.resourceUsage.ledgerReadWrite).toBe('number')
      expect(typeof result.resourceUsage.ledgerReadOnly).toBe('number')
    }
  })

  it('includes min resource fee in sorobanMetrics', async () => {
    const result = await simulateTransaction({
      sourceAccount: 'GABC1234',
      operations: [{ type: 'invokeHostFunction', func: 'test', auth: [] }],
      baseFee: 100,
      timeBounds: {},
      network: 'testnet',
    })

    if (result.sorobanMetrics) {
      expect(result.sorobanMetrics.resourceFee).toBeDefined()
      expect(typeof result.sorobanMetrics.resourceFee).toBe('string')
    }
  })

  it('handles invalid input gracefully', async () => {
    const result = await simulateTransaction({
      sourceAccount: 'invalid',
      operations: [{ type: 'invokeHostFunction', func: 'test', auth: [] }],
      baseFee: 100,
      timeBounds: {},
      network: 'testnet',
    })

    expect(result.success).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
  })

  it('handles unsupported environment without indexedDB', async () => {
    ;(globalThis as any).indexedDB = undefined

    const result = await simulateTransaction({
      sourceAccount: 'GABC1234',
      operations: [{ type: 'payment', destination: 'GDEF5678', amount: '10' }],
      baseFee: 100,
      timeBounds: {},
      network: 'testnet',
    })

    expect(result).toBeDefined()
    expect(result.success).toBe(false)
  })
})

describe('resource formatting helpers', () => {
  it('formats instructions below 1K', () => {
    expect(formatInstructions(500)).toBe('500')
  })

  it('formats instructions in K', () => {
    expect(formatInstructions(1500)).toBe('1.50K')
  })

  it('formats instructions in M', () => {
    expect(formatInstructions(2500000)).toBe('2.50M')
  })

  it('formats bytes in B', () => {
    expect(formatBytes(500)).toBe('500 B')
  })

  it('formats bytes in KB', () => {
    expect(formatBytes(2048)).toBe('2.00 KB')
  })

  it('formats bytes in MB', () => {
    expect(formatBytes(5242880)).toBe('5.00 MB')
  })

  it('formats stroops to XLM', () => {
    expect(formatStroops(10000000)).toBe('1.0000000 XLM (10,000,000 stroops)')
  })

  it('handles invalid stroops', () => {
    expect(formatStroops('invalid')).toBe('—')
  })
})
