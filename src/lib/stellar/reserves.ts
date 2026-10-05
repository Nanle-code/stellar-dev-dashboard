import * as StellarSdk from '@stellar/stellar-sdk';
import type { NetworkStats } from './horizon.js';
import { calculateAccountReserves as coreCalculateAccountReserves, type AccountReserves } from '@stellar-dev-dashboard/core';

export { type AccountReserves };

export function calculateAccountReserves(
  accountData: StellarSdk.Horizon.AccountResponse,
  networkStats: NetworkStats | null,
  offerCount: number = 0
): AccountReserves {
  const adaptedAccountData = {
    balances: accountData.balances.map((b) => ({
      asset_type: b.asset_type,
      asset_code: b.asset_code,
      asset_issuer: b.asset_issuer,
      balance: b.balance,
      limit: b.limit,
    })),
    signers: accountData.signers.map((s) => ({
      key: s.key,
      type: s.type,
      weight: s.weight,
    })),
    subentry_count: accountData.subentry_count,
    account_id: accountData.account_id,
  };

  return coreCalculateAccountReserves(adaptedAccountData, networkStats, offerCount);
}