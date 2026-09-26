/**
 * WalletIdlePrompt (#837) — warns before, and then performs, an automatic
 * wallet disconnect after a configurable period of inactivity.
 *
 * Mounted once at the layout level so it runs regardless of the active tab.
 * Renders nothing while the wallet is disconnected, the timeout is off, or the
 * environment cannot observe user activity.
 */

import React, { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { useStore } from '../../lib/store'
import {
  IDLE_TIMEOUT_DISABLED,
  IDLE_TIMEOUT_REVOKE_REASON,
  createIdleSessionMonitor,
  isIdleTimeoutSupported,
  type IdleSessionMonitor,
} from '../../lib/wallet/idleTimeout'
import { appendSecurityAuditLog } from '../../lib/wallet/security'
import { disconnectWalletConnect } from '../../lib/wallet/walletconnect'

type PromptState =
  | { kind: 'hidden' }
  | { kind: 'warning'; remainingMs: number }
  | { kind: 'expired'; minutes: number }

function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return minutes > 0 ? `${minutes}:${String(seconds).padStart(2, '0')}` : `${seconds}s`
}

async function releaseWalletTransport(walletType: string | null): Promise<void> {
  if (walletType !== 'walletconnect') return
  try {
    await disconnectWalletConnect()
  } catch {
    // Relay already closed — the local session is revoked either way.
  }
}

const panelStyle: CSSProperties = {
  position: 'fixed',
  right: '24px',
  bottom: '24px',
  maxWidth: '380px',
  width: 'calc(100% - 48px)',
  padding: '16px',
  background: 'var(--bg-elevated)',
  border: '1px solid var(--amber, var(--border))',
  borderRadius: 'var(--radius-md)',
  boxShadow: '0 20px 50px rgba(0, 0, 0, 0.45)',
  zIndex: 2100,
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
}

const buttonStyle: CSSProperties = {
  padding: '8px 14px',
  borderRadius: 'var(--radius-sm)',
  fontSize: '12px',
  fontFamily: 'var(--font-mono)',
  cursor: 'pointer',
}

export default function WalletIdlePrompt() {
  const walletConnected = useStore((s) => s.walletConnected)
  const minutes = useStore((s) => s.walletIdleTimeoutMinutes)

  const [prompt, setPrompt] = useState<PromptState>({ kind: 'hidden' })
  const monitorRef = useRef<IdleSessionMonitor | null>(null)
  const stayButtonRef = useRef<HTMLButtonElement | null>(null)

  const expireSession = useCallback((reasonMinutes: number, action: string) => {
    const { walletType, revokeWalletSession } = useStore.getState()
    appendSecurityAuditLog({
      action,
      status: 'warning',
      details: `${walletType || 'wallet'} disconnected after ${reasonMinutes} min of inactivity`,
    })
    revokeWalletSession(IDLE_TIMEOUT_REVOKE_REASON)
    void releaseWalletTransport(walletType)
  }, [])

  useEffect(() => {
    if (!walletConnected || minutes === IDLE_TIMEOUT_DISABLED || !isIdleTimeoutSupported()) {
      return undefined
    }

    // A new session (or a new timeout) clears any stale "disconnected" notice.
    setPrompt({ kind: 'hidden' })

    const monitor = createIdleSessionMonitor({
      timeoutMs: minutes * 60_000,
      onWarning: (remainingMs) => setPrompt({ kind: 'warning', remainingMs }),
      onTimeout: () => {
        expireSession(minutes, 'wallet_idle_timeout')
        setPrompt({ kind: 'expired', minutes })
      },
    })
    monitorRef.current = monitor
    monitor.start()

    return () => {
      monitor.stop()
      monitorRef.current = null
    }
  }, [walletConnected, minutes, expireSession])

  // Tick the visible countdown while the warning is open.
  const warningOpen = prompt.kind === 'warning'
  useEffect(() => {
    if (!warningOpen) return undefined
    stayButtonRef.current?.focus()
    const interval = setInterval(() => {
      const monitor = monitorRef.current
      if (monitor?.getPhase() === 'warning') {
        setPrompt({ kind: 'warning', remainingMs: monitor.getRemainingMs() })
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [warningOpen])

  // If the wallet disconnects some other way, drop an open warning.
  useEffect(() => {
    if (!walletConnected) {
      setPrompt((current) => (current.kind === 'warning' ? { kind: 'hidden' } : current))
    }
  }, [walletConnected])

  const handleStay = () => {
    monitorRef.current?.acknowledge()
    setPrompt({ kind: 'hidden' })
  }

  const handleDisconnectNow = () => {
    monitorRef.current?.stop()
    expireSession(minutes, 'wallet_idle_disconnect_confirmed')
    setPrompt({ kind: 'hidden' })
  }

  if (prompt.kind === 'hidden') return null

  if (prompt.kind === 'expired') {
    return (
      <div role="status" aria-live="polite" style={panelStyle} data-testid="wallet-idle-expired">
        <strong style={{ fontSize: '13px', color: 'var(--text-primary)' }}>Wallet disconnected</strong>
        <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          Your wallet was disconnected after {prompt.minutes} minute{prompt.minutes === 1 ? '' : 's'} of
          inactivity. Reconnect from the Wallet tab to continue signing.
        </p>
        <button
          type="button"
          onClick={() => setPrompt({ kind: 'hidden' })}
          style={{ ...buttonStyle, alignSelf: 'flex-end', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
        >
          Dismiss
        </button>
      </div>
    )
  }

  return (
    <div
      role="alertdialog"
      aria-labelledby="wallet-idle-title"
      aria-describedby="wallet-idle-description"
      style={panelStyle}
      data-testid="wallet-idle-warning"
    >
      <strong id="wallet-idle-title" style={{ fontSize: '13px', color: 'var(--text-primary)' }}>
        Still there?
      </strong>
      <p id="wallet-idle-description" style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
        Your wallet will be disconnected soon because this session has been idle. Choose “Stay connected” to keep it open.
      </p>
      <div aria-live="off" style={{ fontSize: '20px', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
        {formatCountdown(prompt.remainingMs)}
      </div>
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={handleDisconnectNow}
          style={{ ...buttonStyle, background: 'var(--red-glow)', border: '1px solid var(--red)', color: 'var(--red)' }}
        >
          Disconnect now
        </button>
        <button
          ref={stayButtonRef}
          type="button"
          onClick={handleStay}
          style={{ ...buttonStyle, background: 'var(--green-glow)', border: '1px solid var(--green)', color: 'var(--green)' }}
        >
          Stay connected
        </button>
      </div>
    </div>
  )
}
