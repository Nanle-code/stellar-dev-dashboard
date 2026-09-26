import React from 'react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const state = vi.hoisted(() => ({ online: false }))

vi.mock('../../../utils/offline', () => ({
  getOnlineStatus: () => state.online,
  subscribeToOnlineStatus: () => () => {},
  getPendingCount: () => Promise.resolve(0),
}))

import OfflineBanner from '../OfflineBanner'

describe('OfflineBanner view capability (#892)', () => {
  beforeEach(() => {
    state.online = false
  })

  it('describes what the current view can do offline', () => {
    render(<OfflineBanner routeId="account" />)
    expect(screen.getByTestId('offline-view-capability')).toHaveTextContent(
      /Degraded \(cached, read-only\)/
    )
  })

  it('omits the capability line for unknown routes instead of crashing', () => {
    render(<OfflineBanner routeId="not-a-route" />)
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.queryByTestId('offline-view-capability')).toBeNull()
  })

  it('renders nothing while online', () => {
    state.online = true
    const { container } = render(<OfflineBanner routeId="faucet" />)
    expect(container).toBeEmptyDOMElement()
  })
})
