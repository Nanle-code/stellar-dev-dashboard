import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const getLatestLedger = vi.fn().mockResolvedValue({ sequence: 1000 })
const getEvents = vi.fn().mockResolvedValue({ events: [], latestLedger: 1001 })

const fakeServer = { getLatestLedger, getEvents }

vi.mock('../../../src/lib/stellar', () => ({
  getSorobanServer: () => fakeServer,
}))

import { ContractStreamManager } from '../../../src/lib/websocket/ContractStreamManager'

describe('ContractStreamManager', () => {
  let mgr: ContractStreamManager

  beforeEach(() => {
    vi.useFakeTimers()
    getLatestLedger.mockClear()
    getEvents.mockClear()
    mgr = new ContractStreamManager()
  })

  afterEach(() => {
    mgr.disconnectAll()
    vi.useRealTimers()
  })

  it('opens a poll session on first subscribe', async () => {
    mgr.subscribe('CCONTRACT', 'testnet', vi.fn())
    // Drain microtasks so the first poll resolves; do not advance fake timers
    // beyond that point or the recurring schedule will fire again.
    await Promise.resolve()
    await Promise.resolve()
    expect(getLatestLedger).toHaveBeenCalled()
    expect(getEvents).toHaveBeenCalledTimes(1)
  })

  it('shares one poller between subscribers on the same contract', async () => {
    mgr.subscribe('CCONTRACT', 'testnet', vi.fn())
    mgr.subscribe('CCONTRACT', 'testnet', vi.fn())
    await Promise.resolve()
    await Promise.resolve()
    expect(getEvents).toHaveBeenCalledTimes(1)
  })

  it('emits each event to subscribers', async () => {
    getEvents.mockResolvedValueOnce({
      events: [{ ledger: 1001, topic: ['x'], value: { ok: true }, contractId: 'CCONTRACT' }],
      latestLedger: 1001,
    })
    const cb = vi.fn()
    mgr.subscribe('CCONTRACT', 'testnet', cb)
    await vi.runOnlyPendingTimersAsync()
    expect(cb).toHaveBeenCalledTimes(1)
    const evt = cb.mock.calls[0][0]
    expect(evt.contractId).toBe('CCONTRACT')
    expect(evt.ledger).toBe(1001)
    expect(evt.channel).toBe('events')
  })

  it('stops polling when last subscriber unsubscribes', async () => {
    const unsub = mgr.subscribe('CCONTRACT', 'testnet', vi.fn(), { pollIntervalMs: 1000 })
    await vi.runOnlyPendingTimersAsync()
    unsub()
    getEvents.mockClear()
    await vi.advanceTimersByTimeAsync(5000)
    expect(getEvents).not.toHaveBeenCalled()
  })

  it('reports current status to onStatusChange listeners', async () => {
    const statuses: string[] = []
    mgr.subscribe('CCONTRACT', 'testnet', vi.fn(), {
      onStatusChange: (c) => statuses.push(c.status),
    })
    await vi.runOnlyPendingTimersAsync()
    expect(statuses).toContain('connecting')
    expect(statuses).toContain('connected')
  })

  it('backs off after errors and reaches reconnecting status', async () => {
    getEvents.mockRejectedValueOnce(new Error('boom'))
    const statuses: string[] = []
    mgr.subscribe('CCONTRACT', 'testnet', vi.fn(), {
      onStatusChange: (c) => statuses.push(c.status),
    })
    await vi.runOnlyPendingTimersAsync()
    expect(statuses).toContain('reconnecting')
  })
})
