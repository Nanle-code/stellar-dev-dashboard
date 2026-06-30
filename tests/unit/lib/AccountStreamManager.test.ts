import { describe, it, expect, beforeEach, vi } from 'vitest'

// Stub getServer with a fake builder chain so we can assert subscribe behavior
// without making real Horizon HTTP calls.
const closeStream = vi.fn()
const stream = vi.fn(({ onmessage }: { onmessage: (r: unknown) => void; onerror: (e: unknown) => void }) => {
  // Synchronously emit one record so subscribe handlers fire deterministically.
  setTimeout(() => onmessage({ paging_token: '42', amount: '10', from: 'GA', to: 'GB', asset_code: 'XLM', type: 'account_credited' }), 0)
  return closeStream
})
const cursor = vi.fn(() => ({ stream }))
const builder = { cursor }
const forAccount = vi.fn(() => builder)
const fakeServer = {
  effects: () => ({ forAccount }),
  payments: () => ({ forAccount }),
  operations: () => ({ forAccount }),
  transactions: () => ({ forAccount }),
}

vi.mock('../../../src/lib/stellar', () => ({
  getServer: () => fakeServer,
  isValidPublicKey: () => true,
}))

import { AccountStreamManager } from '../../../src/lib/websocket/AccountStreamManager'

describe('AccountStreamManager', () => {
  let mgr: AccountStreamManager

  beforeEach(() => {
    mgr = new AccountStreamManager()
    closeStream.mockClear()
    cursor.mockClear()
    stream.mockClear()
    forAccount.mockClear()
  })

  it('opens an SSE stream when first subscriber attaches', () => {
    const cb = vi.fn()
    mgr.subscribe('GACCOUNT', 'testnet', cb, { channels: ['effects'] })
    expect(forAccount).toHaveBeenCalledWith('GACCOUNT')
    expect(cursor).toHaveBeenCalledWith('now')
    expect(stream).toHaveBeenCalledTimes(1)
  })

  it('shares one connection between multiple subscribers on the same channel', () => {
    mgr.subscribe('GA', 'testnet', vi.fn(), { channels: ['effects'] })
    mgr.subscribe('GA', 'testnet', vi.fn(), { channels: ['effects'] })
    expect(stream).toHaveBeenCalledTimes(1)
  })

  it('opens distinct streams per channel', () => {
    mgr.subscribe('GA', 'testnet', vi.fn(), { channels: ['effects', 'payments'] })
    expect(stream).toHaveBeenCalledTimes(2)
  })

  it('delivers events to all subscribers', async () => {
    const cb = vi.fn()
    mgr.subscribe('GA', 'testnet', cb, { channels: ['effects'] })
    await new Promise((r) => setTimeout(r, 5))
    expect(cb).toHaveBeenCalledTimes(1)
    const event = cb.mock.calls[0][0]
    expect(event.channel).toBe('effects')
    expect(event.accountId).toBe('GA')
    expect(event.network).toBe('testnet')
    expect(event.pagingToken).toBe('42')
  })

  it('closes the underlying stream when the last subscriber leaves', () => {
    const cb1 = vi.fn()
    const cb2 = vi.fn()
    const unsub1 = mgr.subscribe('GA', 'testnet', cb1, { channels: ['effects'] })
    const unsub2 = mgr.subscribe('GA', 'testnet', cb2, { channels: ['effects'] })
    unsub1()
    expect(closeStream).not.toHaveBeenCalled()
    unsub2()
    expect(closeStream).toHaveBeenCalledTimes(1)
  })

  it('disconnectAccount() drops every channel for that account', () => {
    mgr.subscribe('GA', 'testnet', vi.fn(), { channels: ['effects', 'payments'] })
    mgr.subscribe('GB', 'testnet', vi.fn(), { channels: ['effects'] })
    expect(mgr.listActiveStreams()).toHaveLength(3)
    mgr.disconnectAccount('GA')
    const remaining = mgr.listActiveStreams()
    expect(remaining).toHaveLength(1)
    expect(remaining[0].accountId).toBe('GB')
  })

  it('reports per-stream status via onStatusChange', async () => {
    const statuses: string[] = []
    mgr.subscribe('GA', 'testnet', vi.fn(), {
      channels: ['effects'],
      onStatusChange: (change) => statuses.push(change.status),
    })
    await new Promise((r) => setTimeout(r, 5))
    expect(statuses).toContain('connecting')
    expect(statuses).toContain('connected')
  })

  it('listActiveStreams returns one row per (account, channel)', () => {
    mgr.subscribe('GA', 'testnet', vi.fn(), { channels: ['effects', 'payments'] })
    const rows = mgr.listActiveStreams()
    expect(rows).toHaveLength(2)
    expect(rows.map((r) => r.channel).sort()).toEqual(['effects', 'payments'])
  })
})
