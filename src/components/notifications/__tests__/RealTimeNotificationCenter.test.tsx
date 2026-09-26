/**
 * Smoke tests for the restructured notification center (#872): the polite
 * live region must stay mounted even while the slide-over panel is closed.
 */

import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import RealTimeNotificationCenter from '../RealTimeNotificationCenter'
import { notificationStore } from '../../../lib/websocket/notificationStore'

describe('RealTimeNotificationCenter', () => {
  afterEach(() => {
    notificationStore.clear()
    vi.useRealTimers()
  })

  it('keeps the ledger live region mounted when the panel is closed', () => {
    render(<RealTimeNotificationCenter open={false} onClose={() => {}} />)

    expect(screen.getByTestId('ledger-live-region')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('renders the dialog when open', () => {
    render(<RealTimeNotificationCenter open={true} onClose={() => {}} />)

    // The smart view nests its own dialog, so assert at least one is present.
    expect(screen.getAllByRole('dialog').length).toBeGreaterThan(0)
    // The live region is still present alongside the panel.
    expect(screen.getByTestId('ledger-live-region')).toBeInTheDocument()
  })
})
