/**
 * Subscribe to one or more account-stream channels for the lifetime of a
 * component. Pushes high-signal events (incoming payments, balance changes)
 * onto the global notification store automatically.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { accountStreamManager } from '../lib/websocket/AccountStreamManager'
import { notificationStore } from '../lib/websocket/notificationStore'
import type { NetworkName } from '../lib/stellar'
import type {
  AccountStreamChannel,
  AccountStreamEvent,
  StreamStatus,
} from '../lib/websocket/StreamTypes'
import { evaluateEventRules, ALERT_RULE_TYPE, ALERT_CHANNEL } from '../lib/alerts'; // Import new evaluation function and types
} from '../lib/websocket/StreamTypes'

export interface UseAccountStreamOptions {
  channels?: AccountStreamChannel[]
  cursor?: string
  /** Max events kept in `events` state. Defaults to 50. */
  bufferSize?: number
  /** Push high-signal events to the global notification store. Default true. */
  emitNotifications?: boolean
}

export interface UseAccountStreamResult {
  events: AccountStreamEvent[]
  status: StreamStatus
  lastEventAt: number | null
  /** True when SSE error count has hit the configured limit. */
  errored: boolean
}

const DEFAULT_BUFFER = 50

export function useAccountStream(
  accountId: string | null,
  network: NetworkName,
  options: UseAccountStreamOptions = {},
): UseAccountStreamResult {
  const channels = useMemo<AccountStreamChannel[]>(
    () => options.channels ?? (['effects'] as AccountStreamChannel[]),
    [options.channels],
  )
  const bufferSize = options.bufferSize ?? DEFAULT_BUFFER
  const emitNotifications = options.emitNotifications ?? true

  const [events, setEvents] = useState<AccountStreamEvent[]>([])
  const [status, setStatus] = useState<StreamStatus>('idle')
  const [lastEventAt, setLastEventAt] = useState<number | null>(null)
  const [errored, setErrored] = useState(false)
  const [activeAlertRules, setActiveAlertRules] = useState<AlertRule[]>([]); // New state for active alert rules

  // Latest channels list — kept in a ref so we don't re-subscribe on prop churn
  // when the array is reference-new but value-equal.
  const channelsRef = useRef<AccountStreamChannel[]>(channels)
  channelsRef.current = channels

  useEffect(() => {
    // Load alert rules from IndexedDB on mount
    async function loadRules() {
      const rules = await getAlertRules();
      setActiveAlertRules(rules);
    }
    loadRules();
  }, []); // Empty dependency array means this runs once on mount

  useEffect(() => {
    if (!accountId) {
      setStatus('idle')
      return
    }

    setStatus('connecting')
    setErrored(false)

    const unsubscribers: Array<() => void> = []

    const unsubEvents = accountStreamManager.subscribe(
      accountId,
      network,
      (event) => {
        setEvents((prev) => [event, ...prev].slice(0, bufferSize))
        setLastEventAt(event.receivedAt)

        if (emitNotifications) {
          const notif = summarizeEvent(event, accountId)
          if (notif) notificationStore.push(notif)

          // Evaluate custom alert rules
          const triggeredAlerts = evaluateEventRules(event, activeAlertRules, accountId);
          triggeredAlerts.forEach(alert => notificationStore.push(alert));
        }
      },
      {
        channels,
        cursor: options.cursor,
      },
    )
    unsubscribers.push(unsubEvents)

    // Subscribe to status updates from the first channel — they're
    // representative since all channels share the same Horizon endpoint.
    const primaryChannel = channels[0]
    const unsubStatus = accountStreamManager.onStatusChange(
      accountId,
      primaryChannel,
      network,
      (change) => {
        setStatus(change.status)
        if (change.status === 'error' && change.error === 'max-reconnect-attempts') {
          setErrored(true)
        }
      },
    )
    unsubscribers.push(unsubStatus)

    return () => {
      for (const cleanup of unsubscribers) cleanup()
    }
  }, [accountId, network, channels, options.cursor, bufferSize, emitNotifications, activeAlertRules]) // Add activeAlertRules to dependencies

  return { events, status, lastEventAt, errored }
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function summarizeEvent(
  event: AccountStreamEvent,
  watchedAccount: string,
): { level: 'info' | 'success' | 'warning'; title: string; message: string; source: string; payload: unknown } | null {
  const record = event.record as Record<string, unknown>

  if (event.channel === 'payments') {
    const from = String(record.from ?? '')
    const to = String(record.to ?? '')
    const amount = String(record.amount ?? '')
    const asset = String(record.asset_code ?? 'XLM')
    const incoming = to === watchedAccount
    return {
      level: incoming ? 'success' : 'info',
      title: incoming ? 'Incoming payment' : 'Outgoing payment',
      message: `${amount} ${asset} ${incoming ? 'from' : 'to'} ${truncateAddr(incoming ? from : to)}`,
      source: watchedAccount,
      payload: record,
    }
  }

  if (event.channel === 'effects') {
    const type = String(record.type ?? 'effect')
    if (type === 'account_credited' || type === 'account_debited') {
      const amount = String(record.amount ?? '')
      const asset = String(record.asset_code ?? 'XLM')
      const credited = type === 'account_credited'
      return {
        level: credited ? 'success' : 'info',
        title: credited ? 'Account credited' : 'Account debited',
        message: `${amount} ${asset}`,
        source: watchedAccount,
        payload: record,
      }
    }
    if (type === 'signer_created' || type === 'signer_removed' || type === 'signer_updated') {
      return {
        level: 'warning',
        title: 'Signer change',
        message: `${type.replace(/_/g, ' ')} on account`,
        source: watchedAccount,
        payload: record,
      }
    }
  }

  if (event.channel === 'transactions') {
    const id = String(record.id ?? '').slice(0, 12)
    return {
      level: 'info',
      title: 'New transaction',
      message: `tx ${id} included`,
      source: watchedAccount,
      payload: record,
    }
  }

  return null
}

function truncateAddr(addr: string): string {
  if (addr.length <= 12) return addr
  return `${addr.slice(0, 5)}…${addr.slice(-4)}`
}

export default useAccountStream
