/**
 * Integration tests for the ledger live region (#872): the component wires the
 * notification store to a polite ARIA live region without overwhelming users.
 */

import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import LedgerLiveRegion from '../LedgerLiveRegion'
import { notificationStore } from '../../../lib/websocket/notificationStore'
import { DEFAULT_WINDOW_MS } from '../../../lib/ledgerAnnouncements'
import { DEFAULT_CLEAR_AFTER_MS } from '../../../hooks/useLedgerAnnouncements'

describe('LedgerLiveRegion', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    notificationStore.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
    notificationStore.clear()
  })

  it('renders a polite, atomic status live region', () => {
    render(<LedgerLiveRegion />)

    const region = screen.getByTestId('ledger-live-region')
    expect(region).toHaveAttribute('role', 'status')
    expect(region).toHaveAttribute('aria-live', 'polite')
    expect(region).toHaveAttribute('aria-atomic', 'true')
    expect(region.textContent).toBe('')
  })

  it('announces a new ledger update after the coalescing window, then clears', () => {
    render(<LedgerLiveRegion />)
    const region = screen.getByTestId('ledger-live-region')

    act(() => {
      notificationStore.push({
        level: 'success',
        title: 'Incoming payment',
        message: '10 XLM',
        source: 'GABCDEF',
      })
    })

    // Still coalescing: nothing spoken yet.
    expect(region.textContent).toBe('')

    act(() => {
      vi.advanceTimersByTime(DEFAULT_WINDOW_MS)
    })

    expect(region.textContent).toContain('Ledger update.')
    expect(region.textContent).toContain('Incoming payment: 10 XLM')

    act(() => {
      vi.advanceTimersByTime(DEFAULT_CLEAR_AFTER_MS)
    })

    expect(region.textContent).toBe('')
  })

  it('coalesces a burst into a single announcement', () => {
    render(<LedgerLiveRegion />)
    const region = screen.getByTestId('ledger-live-region')

    act(() => {
      notificationStore.push({ title: 'Incoming payment', message: 'a' })
      notificationStore.push({ title: 'Account credited', message: 'b' })
    })

    act(() => {
      vi.advanceTimersByTime(DEFAULT_WINDOW_MS)
    })

    expect(region.textContent).toContain('Ledger updates.')
    expect(region.textContent).toContain('Incoming payment: a')
    expect(region.textContent).toContain('Account credited: b')
  })

  it('does not announce history that existed before mount', () => {
    notificationStore.push({ title: 'Incoming payment', message: 'old' })

    render(<LedgerLiveRegion />)
    act(() => {
      vi.advanceTimersByTime(DEFAULT_WINDOW_MS)
    })

    expect(screen.getByTestId('ledger-live-region').textContent).toBe('')
  })

  it('ignores non-ledger notifications', () => {
    render(<LedgerLiveRegion />)

    act(() => {
      notificationStore.push({ title: 'Low balance warning', message: 'careful' })
    })
    act(() => {
      vi.advanceTimersByTime(DEFAULT_WINDOW_MS)
    })

    expect(screen.getByTestId('ledger-live-region').textContent).toBe('')
  })

  it('stays silent when disabled', () => {
    render(<LedgerLiveRegion enabled={false} />)

    act(() => {
      notificationStore.push({ title: 'New transaction', message: 'tx abc' })
    })
    act(() => {
      vi.advanceTimersByTime(DEFAULT_WINDOW_MS)
    })

    expect(screen.getByTestId('ledger-live-region').textContent).toBe('')
  })
})
