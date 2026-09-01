import { useEffect } from 'react'
import { startWalletSessionListeners } from '../lib/wallet/sessionListeners'

/**
 * Mount global wallet session listeners for the dashboard lifetime.
 */
export function useWalletSessionListeners(): void {
  useEffect(() => startWalletSessionListeners(), [])
}
