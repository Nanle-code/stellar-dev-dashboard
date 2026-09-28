/**
 * Polite live region that announces ledger / transaction stream updates (#872).
 *
 * Renders the coalesced announcement produced by
 * {@link useLedgerAnnouncements} into a visually-hidden `role="status"`
 * region. It is intentionally always mounted by its host so updates arriving
 * while the notification panel is closed are still announced.
 */

import React from 'react'
import { useLedgerAnnouncements } from '../../hooks/useLedgerAnnouncements'
import '../../styles/accessibility.css'

export interface LedgerLiveRegionProps {
  /** Disable announcements (e.g. when the user opts out). */
  enabled?: boolean
}

export default function LedgerLiveRegion({ enabled = true }: LedgerLiveRegionProps) {
  const announcement = useLedgerAnnouncements({ enabled })

  return (
    <div
      className="sr-only"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      data-testid="ledger-live-region"
    >
      {announcement}
    </div>
  )
}
