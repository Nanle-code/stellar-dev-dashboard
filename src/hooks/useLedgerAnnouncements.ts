/**
 * React binding for the ledger live-region announcements (#872).
 *
 * Subscribes to the global notification store, coalesces ledger/transaction
 * updates via {@link createLedgerAnnouncer}, and exposes the latest
 * announcement string so a polite live region can render it.
 *
 * Safe no-op during SSR (`window` undefined) and when `enabled` is false.
 */

import { useEffect, useRef, useState } from 'react'
import { notificationStore } from '../lib/websocket/notificationStore'
import {
  createLedgerAnnouncer,
  DEFAULT_MAX_BATCH,
  DEFAULT_WINDOW_MS,
} from '../lib/ledgerAnnouncements'

export interface UseLedgerAnnouncementsOptions {
  enabled?: boolean
  /** Coalescing window in ms. */
  windowMs?: number
  /** Flush immediately once this many updates are pending. */
  maxBatch?: number
  /** How long to keep an announcement mounted after it is announced. */
  clearAfterMs?: number
  /** Optional side-channel callback (e.g. the shared ScreenReaderAnnouncer). */
  onAnnounce?: (message: string) => void
}

/** Default time an announcement stays in the live region before clearing. */
export const DEFAULT_CLEAR_AFTER_MS = 5000

export function useLedgerAnnouncements(
  options: UseLedgerAnnouncementsOptions = {},
): string {
  const {
    enabled = true,
    windowMs = DEFAULT_WINDOW_MS,
    maxBatch = DEFAULT_MAX_BATCH,
    clearAfterMs = DEFAULT_CLEAR_AFTER_MS,
    onAnnounce,
  } = options

  const [announcement, setAnnouncement] = useState('')
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onAnnounceRef = useRef(onAnnounce)
  onAnnounceRef.current = onAnnounce

  useEffect(() => {
    if (!enabled) return undefined
    if (typeof window === 'undefined') return undefined

    const announcer = createLedgerAnnouncer({
      windowMs,
      maxBatch,
      announce: (message) => {
        setAnnouncement(message)
        onAnnounceRef.current?.(message)
        if (clearTimer.current !== null) clearTimeout(clearTimer.current)
        clearTimer.current = setTimeout(() => {
          setAnnouncement('')
        }, clearAfterMs)
      },
    })

    // Existing history is not "news": seed it before subscribing.
    announcer.prime(notificationStore.getSnapshot())
    const unsubscribe = notificationStore.subscribe((items) => announcer.observe(items))

    return () => {
      unsubscribe()
      announcer.dispose()
      if (clearTimer.current !== null) {
        clearTimeout(clearTimer.current)
        clearTimer.current = null
      }
    }
  }, [enabled, windowMs, maxBatch, clearAfterMs])

  return announcement
}

export default useLedgerAnnouncements
