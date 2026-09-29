import * as StellarSdk from '@stellar/stellar-sdk';
import type { NetworkStats } from './horizon.js';

export interface AccountReserves {
  baseReserve: number;
  signerReserve: number;
  assetReserve: number;
  offerReserve: number;
  subentryReserve: number;
  totalReserves: number;
  availableBalance: number;
  totalBalance: number;
}

/**
 * Calculate account reserves based on Stellar network base reserve
 * @param accountData - Account response from Horizon
 * @param networkStats - Network stats containing ledger with base_reserve
 * @param offerCount - Number of open offers (optional, defaults to 0)
 * @returns AccountReserves object with breakdown of all reserves
 */
export function calculateAccountReserves(
  accountData: StellarSdk.Horizon.AccountResponse,
  networkStats: NetworkStats | null,
  offerCount: number = 0
): AccountReserves {
  // Get base reserve from ledger (in stroops, convert to XLM)
  // Default to 1 XLM if not available (current Stellar default)
  const baseReserveStroops = Number(networkStats?.latestLedger?.base_reserve) || 10000000;
  const baseReserve = baseReserveStroops / 10000000; // Convert stroops to XLM

  // Count non-native assets (trustlines)
  const assetCount = accountData.balances?.filter((b) => b.asset_type !== 'native').length || 0;

  // Count signers (excluding the master key if it's a signer)
  const signerCount =
    accountData.signers?.filter((s) => s.key !== accountData.account_id).length || 0;

  // Subentry count from account data
  const subentryCount = accountData.subentry_count || 0;

  // Calculate reserves (each additional entry costs base_reserve / 2)
  const signerReserve = signerCount * (baseReserve / 2);
  const assetReserve = assetCount * (baseReserve / 2);
  const offerReserve = offerCount * (baseReserve / 2);
  const subentryReserve = subentryCount * (baseReserve / 2);

  // Total reserves
  const totalReserves = baseReserve + signerReserve + assetReserve + offerReserve + subentryReserve;

  // Get XLM balance
  const xlmBalance = accountData.balances?.find((b) => b.asset_type === 'native')?.balance || '0';
  const totalBalance = parseFloat(xlmBalance);

  // Available balance (total - reserves)
  const availableBalance = Math.max(0, totalBalance - totalReserves);

  return {
    baseReserve,
    signerReserve,
    assetReserve,
    offerReserve,
    subentryReserve,
    totalReserves,
    availableBalance,
    totalBalance,
  };
}
