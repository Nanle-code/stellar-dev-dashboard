import { NETWORKS } from './networks.js';

// ─── Faucet ───────────────────────────────────────────────────────────────────

export async function fundTestnetAccount(publicKey: string): Promise<unknown> {
  // Guard: faucet requires network writes and cannot be queued — block offline.
  const { isWriteSafe } = await import('../offlineReadOnly');
  if (!isWriteSafe('faucet funding')) {
    const { OfflineWriteError } = await import('../offlineReadOnly');
    throw new OfflineWriteError('faucet funding');
  }
  const res = await fetch(`${NETWORKS.testnet.faucetUrl}?addr=${publicKey}`);
  if (!res.ok) throw new Error('Faucet request failed');
  return res.json();
}
