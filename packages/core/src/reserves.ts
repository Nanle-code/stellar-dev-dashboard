import type { AccountData, NetworkStats, AccountReserves } from './types/index.js';

export function calculateAccountReserves(
  accountData: AccountData,
  networkStats: NetworkStats | null,
  offerCount: number = 0
): AccountReserves {
  const baseReserveStroops = Number(networkStats?.latestLedger?.base_reserve) || 10000000;
  const baseReserve = baseReserveStroops / 10000000;

  const assetCount = accountData.balances?.filter((b) => b.asset_type !== 'native').length || 0;

  const signerCount =
    accountData.signers?.filter((s) => s.key !== accountData.account_id).length || 0;

  const subentryCount = accountData.subentry_count || 0;

  const signerReserve = signerCount * (baseReserve / 2);
  const assetReserve = assetCount * (baseReserve / 2);
  const offerReserve = offerCount * (baseReserve / 2);
  const subentryReserve = subentryCount * (baseReserve / 2);

  const totalReserves = baseReserve + signerReserve + assetReserve + offerReserve + subentryReserve;

  const xlmBalance = accountData.balances?.find((b) => b.asset_type === 'native')?.balance || '0';
  const totalBalance = parseFloat(xlmBalance);

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