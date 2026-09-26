/**
 * Account Parity & Mobile Overview Module
 *
 * Provides data normalization, metrics calculation, and parity enforcement
 * between Desktop Web and Mobile views for Account Overview:
 *  - Spendable vs locked reserve calculations
 *  - Normalized trustline status evaluation and filtering
 *  - Unified recent activity aggregation from transactions & operations
 *  - Parity matrix metadata for QA and testing
 */

import type { Horizon } from '@stellar/stellar-sdk';
import { formatXLM, calculateAccountReserves, type ReservesInfo } from './stellar';

export interface SpendableMetrics {
  totalXlm: number;
  availableXlm: number;
  lockedXlm: number;
  spendablePercentage: number;
  reserves: ReservesInfo | null;
}

export interface NormalizedTrustline {
  assetCode: string;
  assetIssuer: string;
  assetType: string;
  balance: string;
  balanceNumber: number;
  isAuthorized: boolean;
  isAuthorizedToMaintainLiabilities: boolean;
  isClawbackEnabled?: boolean;
  isEmpty: boolean;
  explorerUrl?: string;
}

export interface AccountActivityItem {
  id: string;
  hash: string;
  type: string;
  timestamp: string;
  formattedDate: string;
  successful: boolean;
  operationCount: number;
  feePaid?: string;
  memo?: string;
  explorerUrl: string;
}

export interface MobileParityFeature {
  feature: string;
  category: 'Balances' | 'Trustlines' | 'Recent Activity' | 'Security' | 'Offers';
  webSupported: boolean;
  mobileSupported: boolean;
  parityStatus: 'Full Parity' | 'Enhanced' | 'Partial' | 'Missing';
  notes: string;
}

/**
 * Calculate spendable balance and reserve distribution metrics
 */
export function calculateSpendableMetrics(
  accountData: Horizon.AccountResponse | null | undefined,
  networkStats?: any,
  offersCount: number = 0
): SpendableMetrics {
  if (!accountData || !accountData.balances) {
    return {
      totalXlm: 0,
      availableXlm: 0,
      lockedXlm: 0,
      spendablePercentage: 0,
      reserves: null,
    };
  }

  const nativeBalanceObj = accountData.balances.find((b) => b.asset_type === 'native');
  const totalXlm = nativeBalanceObj ? parseFloat(nativeBalanceObj.balance) || 0 : 0;

  const reserves = calculateAccountReserves(accountData, networkStats, offersCount);

  if (!reserves) {
    return {
      totalXlm,
      availableXlm: totalXlm,
      lockedXlm: 0,
      spendablePercentage: totalXlm > 0 ? 100 : 0,
      reserves: null,
    };
  }

  const lockedXlm = parseFloat(reserves.totalReserves) || 0;
  const availableXlm = Math.max(0, parseFloat(reserves.availableBalance) || 0);
  const spendablePercentage = totalXlm > 0 ? Math.min(100, Math.max(0, (availableXlm / totalXlm) * 100)) : 0;

  return {
    totalXlm,
    availableXlm,
    lockedXlm,
    spendablePercentage: Math.round(spendablePercentage * 10) / 10,
    reserves,
  };
}

/**
 * Normalize and extract trustlines from account balances
 */
export function normalizeTrustlines(
  accountData: Horizon.AccountResponse | null | undefined,
  network: string = 'testnet'
): NormalizedTrustline[] {
  if (!accountData || !Array.isArray(accountData.balances)) {
    return [];
  }

  return accountData.balances
    .filter((b) => b.asset_type !== 'native')
    .map((b) => {
      const assetBalance = b as Horizon.BalanceLineAsset;
      const assetCode = assetBalance.asset_code || 'UNKNOWN';
      const assetIssuer = assetBalance.asset_issuer || '';
      const balance = assetBalance.balance || '0';
      const balanceNumber = parseFloat(balance) || 0;
      const isAuthorized = assetBalance.is_authorized !== false;
      const isAuthorizedToMaintainLiabilities = assetBalance.is_authorized_to_maintain_liabilities === true;
      const isClawbackEnabled = (assetBalance as any).is_clawback_enabled === true;

      const explorerUrl = assetIssuer
        ? `https://stellar.expert/explorer/${network}/asset/${assetCode}-${assetIssuer}`
        : undefined;

      return {
        assetCode,
        assetIssuer,
        assetType: assetBalance.asset_type,
        balance,
        balanceNumber,
        isAuthorized,
        isAuthorizedToMaintainLiabilities,
        isClawbackEnabled,
        isEmpty: balanceNumber === 0,
        explorerUrl,
      };
    });
}

/**
 * Filter trustlines by search term and empty status
 */
export function filterTrustlines(
  trustlines: NormalizedTrustline[],
  options: { query?: string; hideEmpty?: boolean } = {}
): NormalizedTrustline[] {
  if (!Array.isArray(trustlines)) return [];

  let result = [...trustlines];

  if (options.hideEmpty) {
    result = result.filter((t) => !t.isEmpty);
  }

  if (options.query && options.query.trim().length > 0) {
    const q = options.query.trim().toLowerCase();
    result = result.filter(
      (t) =>
        t.assetCode.toLowerCase().includes(q) ||
        t.assetIssuer.toLowerCase().includes(q) ||
        t.balance.includes(q)
    );
  }

  return result;
}

/**
 * Normalize recent transactions and operations into account activity feed
 */
export function normalizeAccountActivity(
  transactions: any[] = [],
  network: string = 'testnet'
): AccountActivityItem[] {
  if (!Array.isArray(transactions)) return [];

  return transactions.map((rawTx) => {
    const tx = rawTx && typeof rawTx === 'object' ? rawTx : {};
    const id = tx.id || tx.hash || `tx_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const hash = typeof tx.hash === 'string' ? tx.hash : typeof tx.id === 'string' ? tx.id : '';
      const successful = tx.successful !== false;
      const opCount = typeof tx.operation_count === 'number' ? tx.operation_count : 1;
      const timestamp = tx.created_at || new Date().toISOString();
      let formattedDate = timestamp;
      try {
        formattedDate = new Date(timestamp).toLocaleDateString([], {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
      } catch {
        /* ignore format error */
      }

      const explorerUrl = `https://stellar.expert/explorer/${network}/tx/${hash}`;

      return {
        id,
        hash,
        type: opCount > 1 ? `${opCount} Operations` : 'Transaction',
        timestamp,
        formattedDate,
        successful,
        operationCount: opCount,
        feePaid: tx.fee_charged ? formatXLM(tx.fee_charged) : undefined,
        memo: tx.memo || undefined,
        explorerUrl,
      };
    });
}

/**
 * Filter activity items by query and success/failure status
 */
export function filterActivity(
  activity: AccountActivityItem[],
  options: { status?: 'all' | 'success' | 'failed'; query?: string } = {}
): AccountActivityItem[] {
  if (!Array.isArray(activity)) return [];

  let filtered = [...activity];

  if (options.status && options.status !== 'all') {
    filtered = filtered.filter((item) =>
      options.status === 'success' ? item.successful : !item.successful
    );
  }

  if (options.query && options.query.trim().length > 0) {
    const q = options.query.trim().toLowerCase();
    filtered = filtered.filter(
      (item) =>
        item.hash.toLowerCase().includes(q) ||
        (item.memo && item.memo.toLowerCase().includes(q)) ||
        item.formattedDate.toLowerCase().includes(q)
    );
  }

  return filtered;
}

/**
 * Get comprehensive Mobile-to-Web Parity Matrix
 */
export function getMobileParityMatrix(): MobileParityFeature[] {
  return [
    {
      feature: 'Native XLM Balance & Real-time USD Valuation',
      category: 'Balances',
      webSupported: true,
      mobileSupported: true,
      parityStatus: 'Full Parity',
      notes: 'Hero balance card with USD conversion and network badge',
    },
    {
      feature: 'Reserve Breakdown (Base, Signer, Asset, Offer)',
      category: 'Balances',
      webSupported: true,
      mobileSupported: true,
      parityStatus: 'Full Parity',
      notes: 'Compact expandable cards with spendable vs locked progress gauge',
    },
    {
      feature: 'Spendable vs Locked Balance Visual Gauge',
      category: 'Balances',
      webSupported: true,
      mobileSupported: true,
      parityStatus: 'Enhanced',
      notes: 'Real-time percentage bar tailored for mobile touchscreens',
    },
    {
      feature: 'Trustline List with Authorization Badges',
      category: 'Trustlines',
      webSupported: true,
      mobileSupported: true,
      parityStatus: 'Full Parity',
      notes: 'Full asset code, issuer copy, auth status, and USD values',
    },
    {
      feature: 'Trustline Search & "Hide Empty" Filter',
      category: 'Trustlines',
      webSupported: true,
      mobileSupported: true,
      parityStatus: 'Full Parity',
      notes: 'Instant local filtering on mobile devices',
    },
    {
      feature: 'Recent Account Activity Feed',
      category: 'Recent Activity',
      webSupported: true,
      mobileSupported: true,
      parityStatus: 'Full Parity',
      notes: 'Unified activity feed with status icons, op count, and explorer links',
    },
    {
      feature: 'Account Thresholds & Flags',
      category: 'Security',
      webSupported: true,
      mobileSupported: true,
      parityStatus: 'Full Parity',
      notes: 'Low/Med/High thresholds and auth flags with status pills',
    },
    {
      feature: 'Signers List with Weights & Labels',
      category: 'Security',
      webSupported: true,
      mobileSupported: true,
      parityStatus: 'Full Parity',
      notes: 'Signer public keys with copy buttons and weight distribution',
    },
    {
      feature: 'Open DEX Offers & Claimable Balances',
      category: 'Offers',
      webSupported: true,
      mobileSupported: true,
      parityStatus: 'Full Parity',
      notes: 'Active order book offers and shortcuts to claimable balances',
    },
    {
      feature: 'Offline & Stale Cache Notice Banner',
      category: 'Balances',
      webSupported: true,
      mobileSupported: true,
      parityStatus: 'Full Parity',
      notes: 'Clear status banner when browsing cached account data offline',
    },
  ];
}
