/**
 * OfflineBanner — shown when navigator.onLine is false.
 *
 * Displays:
 *  - "You're offline" notice with cached-data reassurance
 *  - Count of queued write operations waiting to replay
 *  - Dismisses automatically when back online
 */

import React, { useEffect, useState, type CSSProperties } from 'react'
import { subscribeToOnlineStatus, getOnlineStatus, getPendingCount } from '../../utils/offline'
import { offlineQueue } from '../../lib/errorHandling/RetryManager'

export default function OfflineBanner() {
  const [offline, setOffline]       = useState<boolean>(!getOnlineStatus())
  const [queueSize, setQueueSize]   = useState<number>(0)
  const [dismissed, setDismissed]   = useState<boolean>(false)

  // Track online / offline transitions
  useEffect(() => {
    const unsub = subscribeToOnlineStatus((online: boolean) => {
      setOffline(!online)
      if (online) {
        setDismissed(false)  // re-show if we go offline again later
        // Flush the in-memory queue on reconnect
        offlineQueue.flush().catch(() => {})
      }
    })
    return unsub
  }, [])

  // Track queued operation count
  useEffect(() => {
    const unsub = offlineQueue.subscribe((entries) => {
      setQueueSize(entries.length)
    })
    // Also prime from IDB (in case we resumed after reload)
    getPendingCount().then(setQueueSize).catch(() => {})
    return unsub
  }, [])

  if (!offline || dismissed) return null

  const bannerStyle: CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2000,
    background: 'var(--amber, #f59e0b)',
    color: '#0a0a0a',
    padding: '10px 20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    fontSize: '13px',
    fontFamily: 'var(--font-mono)',
    fontWeight: 600,
    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
  }

  return (
    <div role="status" aria-live="polite" style={bannerStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span aria-hidden="true">⚠</span>
        <span>
          You're offline — showing cached data.
          {queueSize > 0 && (
            <span style={{ marginLeft: '8px', fontWeight: 700 }}>
              {queueSize} operation{queueSize !== 1 ? 's' : ''} queued — will replay when reconnected.
            </span>
          )}
        </span>
      </div>
      <button
        onClick={() => setDismissed(true)}
        aria-label="Dismiss offline notice"
        style={{
          background: 'transparent',
          border: '1px solid rgba(0,0,0,0.3)',
          borderRadius: '4px',
          color: '#0a0a0a',
          cursor: 'pointer',
          padding: '2px 8px',
          fontSize: '12px',
          fontFamily: 'var(--font-mono)',
          flexShrink: 0,
        }}
      >
        ✕
      </button>
    </div>
  )
}
