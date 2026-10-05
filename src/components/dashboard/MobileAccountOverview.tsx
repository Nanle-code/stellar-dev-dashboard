import React, { useState, useMemo } from 'react';
import { format } from 'date-fns';
import type { Horizon } from '@stellar/stellar-sdk';
import {
  Wallet,
  Coins,
  History,
  Shield,
  Layers,
  Search,
  ExternalLink,
  Copy,
  Check,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  RefreshCw,
  Clock,
  WifiOff,
} from 'lucide-react';
import { useStore } from '../../lib/store';
import { shortAddress, formatXLM } from '../../lib/stellar';
import {
  calculateSpendableMetrics,
  normalizeTrustlines,
  filterTrustlines,
  normalizeAccountActivity,
  filterActivity,
} from '../../lib/accountParity';
import useAssetUsdEstimates, { formatEstimatedUsd } from '../../hooks/useAssetUsdEstimates';
import CopyableValue from './CopyableValue';
import AddressLabelBadge from '../addressLabels/AddressLabelBadge';
import AssetTrustStatus from '../assets/AssetTrustStatus';
import type { AccountOffer } from './types';

export interface MobileAccountOverviewProps {
  accountData: Horizon.AccountResponse;
  connectedAddress: string;
  network: string;
  networkStats?: any;
  offers?: AccountOffer[];
  offersLoading?: boolean;
  offersError?: string | null;
  createdAt?: Date | null;
  createdAtLoading?: boolean;
  onRefresh?: () => void;
  className?: string;
}

export type MobileOverviewTab = 'balances' | 'trustlines' | 'activity' | 'security' | 'offers';

export const MobileAccountOverview: React.FC<MobileAccountOverviewProps> = ({
  accountData,
  connectedAddress,
  network,
  networkStats,
  offers = [],
  offersLoading = false,
  offersError = null,
  createdAt = null,
  createdAtLoading = false,
  onRefresh,
  className = '',
}) => {
  const [activeTab, setActiveTab] = useState<MobileOverviewTab>('balances');
  const [assetSearchQuery, setAssetSearchQuery] = useState<string>('');
  const [hideEmptyAssets, setHideEmptyAssets] = useState<boolean>(false);
  const [activitySearchQuery, setActivitySearchQuery] = useState<string>('');
  const [activityStatusFilter, setActivityStatusFilter] = useState<'all' | 'success' | 'failed'>('all');
  const [copiedKey, setCopiedKey] = useState<boolean>(false);

  const { transactions, txLoading } = useStore();
  const offline = typeof navigator !== 'undefined' ? !navigator.onLine : false;

  // 1. Spendable & Reserve metrics
  const spendableMetrics = useMemo(() => {
    return calculateSpendableMetrics(accountData, networkStats, offers.length);
  }, [accountData, networkStats, offers.length]);

  // 2. USD Estimates
  const { getEstimate } = useAssetUsdEstimates({
    balances: accountData?.balances || [],
    connectedAddress,
    network,
    refreshKey: accountData,
  });

  const xlmBalanceObj = accountData?.balances?.find((b) => b.asset_type === 'native');
  const xlmEstimate = xlmBalanceObj ? getEstimate(xlmBalanceObj) : null;

  // 3. Trustlines
  const allTrustlines = useMemo(() => {
    return normalizeTrustlines(accountData, network);
  }, [accountData, network]);

  const filteredTrustlines = useMemo(() => {
    return filterTrustlines(allTrustlines, {
      query: assetSearchQuery,
      hideEmpty: hideEmptyAssets,
    });
  }, [allTrustlines, assetSearchQuery, hideEmptyAssets]);

  // 4. Activity
  const activityItems = useMemo(() => {
    return normalizeAccountActivity(transactions || [], network);
  }, [transactions, network]);

  const filteredActivity = useMemo(() => {
    return filterActivity(activityItems, {
      query: activitySearchQuery,
      status: activityStatusFilter,
    });
  }, [activityItems, activitySearchQuery, activityStatusFilter]);

  // Total Portfolio USD
  const totalPortfolioUsd = useMemo(() => {
    if (!accountData?.balances) return 0;
    return accountData.balances.reduce((total, b) => {
      const est = getEstimate(b);
      return total + (est?.usd || 0);
    }, 0);
  }, [accountData, getEstimate]);

  const handleCopyAddress = () => {
    if (connectedAddress) {
      navigator.clipboard.writeText(connectedAddress);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  const navTabs: { id: MobileOverviewTab; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: 'balances', label: 'Balances', icon: <Wallet size={16} /> },
    {
      id: 'trustlines',
      label: 'Trustlines',
      icon: <Coins size={16} />,
      count: allTrustlines.length,
    },
    {
      id: 'activity',
      label: 'Activity',
      icon: <History size={16} />,
      count: activityItems.length,
    },
    { id: 'security', label: 'Security', icon: <Shield size={16} /> },
    {
      id: 'offers',
      label: 'Offers',
      icon: <Layers size={16} />,
      count: offers.length,
    },
  ];

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Offline Alert Banner */}
      {offline && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 flex items-start gap-2.5 text-amber-300 text-xs">
          <WifiOff size={16} className="shrink-0 mt-0.5 text-amber-400" />
          <div>
            <span className="font-semibold">Offline Mode Active</span>
            <p className="text-amber-200/80 text-[11px] mt-0.5">
              Viewing cached account overview. Write actions and live network requests are paused.
            </p>
          </div>
        </div>
      )}

      {/* Account Identity Header Card */}
      <div className="bg-[#181d20]/95 backdrop-blur-md border border-white/10 rounded-2xl p-4 shadow-xl">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <AddressLabelBadge address={connectedAddress} />
            <button
              onClick={handleCopyAddress}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-mono text-gray-200 transition-colors"
              title="Click to copy full public key"
            >
              <span>{shortAddress(connectedAddress, 6)}</span>
              {copiedKey ? (
                <Check size={12} className="text-emerald-400" />
              ) : (
                <Copy size={12} className="text-gray-400" />
              )}
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
              {network}
            </span>
            {onRefresh && (
              <button
                onClick={onRefresh}
                className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
                title="Refresh account data"
                aria-label="Refresh account data"
              >
                <RefreshCw size={13} />
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5 text-[11px]">
          <div>
            <span className="text-gray-500">Sequence: </span>
            <span className="font-mono text-gray-300">{accountData.sequence || '—'}</span>
          </div>
          <div className="text-right">
            <span className="text-gray-500">Created: </span>
            <span className="text-gray-300">
              {createdAtLoading
                ? 'Loading...'
                : createdAt
                  ? format(new Date(createdAt), 'MMM d, yyyy')
                  : 'Unknown'}
            </span>
          </div>
        </div>
      </div>

      {/* Segmented Mobile Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 no-scrollbar border-b border-white/10">
        {navTabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all shrink-0 ${
                isActive
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow-sm'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-white/5 border border-transparent'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {typeof tab.count === 'number' && tab.count > 0 && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    isActive
                      ? 'bg-cyan-500/30 text-cyan-200'
                      : 'bg-white/10 text-gray-400'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB 1: Balances & Reserves */}
      {activeTab === 'balances' && (
        <div className="space-y-3 animate-in fade-in duration-200">
          {/* Main Hero Balance */}
          <div className="bg-[#181d20]/95 border border-white/10 rounded-2xl p-4 text-center shadow-lg">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
              Native XLM Balance
            </span>
            <div className="text-3xl font-extrabold text-cyan-400 font-mono mt-1 tracking-tight">
              {xlmBalanceObj ? formatXLM(xlmBalanceObj.balance) : '0'} <span className="text-lg">XLM</span>
            </div>
            {xlmEstimate && (
              <div className="text-xs text-gray-400 font-mono mt-0.5">
                ≈ {formatEstimatedUsd(xlmEstimate.usd)} USD
              </div>
            )}

            {totalPortfolioUsd > 0 && (
              <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-xs">
                <span className="text-gray-400">Total Portfolio Value:</span>
                <span className="font-semibold text-emerald-400 font-mono">
                  {formatEstimatedUsd(totalPortfolioUsd)}
                </span>
              </div>
            )}
          </div>

          {/* Spendable vs Locked Gauge */}
          <div className="bg-[#181d20]/95 border border-white/10 rounded-2xl p-4 shadow-lg space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-white">Spendable vs Locked Reserves</span>
              <span className="text-cyan-400 font-mono font-bold">
                {spendableMetrics.spendablePercentage}% Spendable
              </span>
            </div>

            {/* Visual Gauge Bar */}
            <div className="w-full bg-white/5 h-3 rounded-full overflow-hidden flex border border-white/10">
              <div
                style={{ width: `${spendableMetrics.spendablePercentage}%` }}
                className="bg-cyan-500 h-full transition-all duration-500"
                title={`Available: ${spendableMetrics.availableXlm} XLM`}
              />
              <div
                style={{ width: `${100 - spendableMetrics.spendablePercentage}%` }}
                className="bg-amber-500/80 h-full transition-all duration-500"
                title={`Locked: ${spendableMetrics.lockedXlm} XLM`}
              />
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
              <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-xl p-2.5">
                <span className="text-[10px] text-cyan-300 uppercase tracking-wider block font-bold">
                  Available Spendable
                </span>
                <span className="text-sm font-bold text-cyan-300 font-mono mt-0.5 block">
                  {formatXLM(spendableMetrics.availableXlm)} XLM
                </span>
              </div>

              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-2.5">
                <span className="text-[10px] text-amber-400 uppercase tracking-wider block font-bold">
                  Total Locked Reserves
                </span>
                <span className="text-sm font-bold text-amber-400 font-mono mt-0.5 block">
                  {formatXLM(spendableMetrics.lockedXlm)} XLM
                </span>
              </div>
            </div>

            {/* Detailed Reserve Breakdown */}
            {spendableMetrics.reserves && (
              <div className="pt-2 border-t border-white/5 space-y-1.5 text-xs text-gray-400">
                <div className="flex justify-between">
                  <span>Base Account Reserve:</span>
                  <span className="font-mono text-gray-200">
                    {formatXLM(spendableMetrics.reserves.baseReserve)} XLM
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Signer Reserve:</span>
                  <span className="font-mono text-gray-200">
                    {formatXLM(spendableMetrics.reserves.signerReserve)} XLM
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Asset Trustline Reserve:</span>
                  <span className="font-mono text-gray-200">
                    {formatXLM(spendableMetrics.reserves.assetReserve)} XLM
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>DEX Offer Reserve:</span>
                  <span className="font-mono text-gray-200">
                    {formatXLM(spendableMetrics.reserves.offerReserve)} XLM
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Subentry Reserve:</span>
                  <span className="font-mono text-gray-200">
                    {formatXLM(spendableMetrics.reserves.subentryReserve)} XLM
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: Trustlines & Assets */}
      {activeTab === 'trustlines' && (
        <div className="space-y-3 animate-in fade-in duration-200">
          {/* Search & Hide Empty Controls */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
              />
              <input
                type="text"
                value={assetSearchQuery}
                onChange={(e) => setAssetSearchQuery(e.target.value)}
                placeholder="Search code or issuer..."
                className="w-full bg-[#121619] border border-white/10 rounded-xl pl-8 pr-3 py-2 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <button
              onClick={() => setHideEmptyAssets(!hideEmptyAssets)}
              className={`p-2 rounded-xl border text-xs flex items-center gap-1 transition-colors ${
                hideEmptyAssets
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                  : 'bg-white/5 text-gray-400 border-white/10 hover:text-white'
              }`}
              title={hideEmptyAssets ? 'Showing only funded assets' : 'Hide zero-balance assets'}
              aria-label={hideEmptyAssets ? 'Showing only funded assets' : 'Hide zero-balance assets'}
            >
              {hideEmptyAssets ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>

          {/* Trustline Asset List */}
          <div className="space-y-2">
            {filteredTrustlines.length === 0 ? (
              <div className="text-center py-8 bg-[#181d20]/50 border border-dashed border-white/10 rounded-2xl p-4">
                <Coins size={28} className="mx-auto text-gray-600 mb-2" />
                <p className="text-gray-300 text-xs font-semibold">No trustlines found</p>
                <p className="text-gray-500 text-[11px] mt-0.5">
                  {assetSearchQuery || hideEmptyAssets
                    ? 'No assets match your search criteria'
                    : 'Account does not hold any non-native asset trustlines'}
                </p>
              </div>
            ) : (
              filteredTrustlines.map((asset) => {
                const est = getEstimate({
                  asset_type: asset.assetType,
                  asset_code: asset.assetCode,
                  asset_issuer: asset.assetIssuer,
                  balance: asset.balance,
                } as any);

                return (
                  <div
                    key={`${asset.assetCode}-${asset.assetIssuer}`}
                    className="bg-[#181d20]/95 border border-white/10 rounded-xl p-3 shadow-md space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-white font-bold text-sm tracking-tight">
                            {asset.assetCode}
                          </span>
                          {asset.isEmpty && (
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              0.0
                            </span>
                          )}
                        </div>

                        {asset.assetIssuer && (
                          <div className="mt-1 flex items-center gap-1.5">
                            <AddressLabelBadge address={asset.assetIssuer} />
                            <CopyableValue
                              value={asset.assetIssuer}
                              title="Copy asset issuer"
                              containerStyle={{
                                color: 'var(--text-muted)',
                                fontSize: '11px',
                                fontFamily: 'var(--font-mono)',
                              }}
                            >
                              {shortAddress(asset.assetIssuer, 4)}
                            </CopyableValue>
                          </div>
                        )}
                      </div>

                      <div className="text-right">
                        <div className="text-sm font-bold text-cyan-400 font-mono">
                          {formatXLM(asset.balance)}
                        </div>
                        {est && (
                          <div className="text-[11px] text-gray-400 font-mono">
                            ≈ {formatEstimatedUsd(est.usd)}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-white/5 text-[11px]">
                      <AssetTrustStatus
                        issuer={asset.assetIssuer}
                        trustline={{
                          is_authorized: asset.isAuthorized,
                          is_authorized_to_maintain_liabilities:
                            asset.isAuthorizedToMaintainLiabilities,
                        }}
                      />

                      {asset.explorerUrl && (
                        <a
                          href={asset.explorerUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 transition-colors"
                        >
                          Explorer <ExternalLink size={11} />
                        </a>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 3: Recent Activity Feed */}
      {activeTab === 'activity' && (
        <div className="space-y-3 animate-in fade-in duration-200">
          {/* Activity Filters */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
              />
              <input
                type="text"
                value={activitySearchQuery}
                onChange={(e) => setActivitySearchQuery(e.target.value)}
                placeholder="Search tx hash or memo..."
                className="w-full bg-[#121619] border border-white/10 rounded-xl pl-8 pr-3 py-2 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <select
              value={activityStatusFilter}
              onChange={(e) => setActivityStatusFilter(e.target.value as any)}
              className="bg-[#121619] border border-white/10 rounded-xl px-2.5 py-2 text-xs text-gray-200 focus:outline-none focus:border-cyan-500"
            >
              <option value="all">All</option>
              <option value="success">Success</option>
              <option value="failed">Failed</option>
            </select>
          </div>

          {/* Activity List */}
          <div className="space-y-2">
            {txLoading ? (
              <div className="text-center py-8 text-gray-400 text-xs">
                <RefreshCw size={18} className="animate-spin mx-auto mb-2 text-cyan-400" />
                Loading recent transactions...
              </div>
            ) : filteredActivity.length === 0 ? (
              <div className="text-center py-8 bg-[#181d20]/50 border border-dashed border-white/10 rounded-2xl p-4">
                <History size={28} className="mx-auto text-gray-600 mb-2" />
                <p className="text-gray-300 text-xs font-semibold">No recent activity</p>
                <p className="text-gray-500 text-[11px] mt-0.5">
                  Transactions associated with this account will appear here.
                </p>
              </div>
            ) : (
              filteredActivity.map((item) => (
                <div
                  key={item.id}
                  className="bg-[#181d20]/95 border border-white/10 rounded-xl p-3 shadow-md space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {item.successful ? (
                        <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                      ) : (
                        <XCircle size={16} className="text-rose-400 shrink-0" />
                      )}
                      <CopyableValue
                        value={item.hash}
                        title="Copy transaction hash"
                        containerStyle={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '12px',
                          fontWeight: 600,
                        }}
                      >
                        {shortAddress(item.hash, 6)}
                      </CopyableValue>
                    </div>

                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/5 text-gray-300 border border-white/10 shrink-0">
                      {item.type}
                    </span>
                  </div>

                  {item.memo && (
                    <div className="text-[11px] text-gray-400 bg-white/5 rounded-lg px-2 py-1 font-mono truncate">
                      Memo: {item.memo}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t border-white/5 text-[11px] text-gray-500">
                    <span className="flex items-center gap-1">
                      <Clock size={11} /> {item.formattedDate}
                    </span>

                    <a
                      href={item.explorerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 transition-colors"
                    >
                      Inspect <ExternalLink size={11} />
                    </a>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 4: Security & Signers */}
      {activeTab === 'security' && (
        <div className="space-y-3 animate-in fade-in duration-200">
          {/* Thresholds */}
          <div className="bg-[#181d20]/95 border border-white/10 rounded-2xl p-4 shadow-lg space-y-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">
              Account Thresholds
            </h4>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="bg-white/5 rounded-xl p-2 border border-white/5">
                <span className="text-[10px] text-gray-400 block">Low</span>
                <span className="font-mono font-bold text-white text-sm">
                  {accountData.thresholds?.low_threshold ?? 0}
                </span>
              </div>
              <div className="bg-white/5 rounded-xl p-2 border border-white/5">
                <span className="text-[10px] text-gray-400 block">Medium</span>
                <span className="font-mono font-bold text-white text-sm">
                  {accountData.thresholds?.med_threshold ?? 0}
                </span>
              </div>
              <div className="bg-white/5 rounded-xl p-2 border border-white/5">
                <span className="text-[10px] text-gray-400 block">High</span>
                <span className="font-mono font-bold text-white text-sm">
                  {accountData.thresholds?.high_threshold ?? 0}
                </span>
              </div>
            </div>
          </div>

          {/* Flags */}
          <div className="bg-[#181d20]/95 border border-white/10 rounded-2xl p-4 shadow-lg space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">
              Authorization Flags
            </h4>
            <div className="space-y-1.5 text-xs">
              {Object.entries(accountData.flags || {}).map(([key, val]) => (
                <div key={key} className="flex justify-between items-center py-1 border-b border-white/5 last:border-0">
                  <span className="text-gray-300 uppercase text-[11px]">
                    {key.replace(/_/g, ' ')}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                      val
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-white/5 text-gray-500 border border-white/5'
                    }`}
                  >
                    {val ? 'TRUE' : 'FALSE'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Signers */}
          <div className="bg-[#181d20]/95 border border-white/10 rounded-2xl p-4 shadow-lg space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">
              Signers ({accountData.signers?.length || 0})
            </h4>
            <div className="space-y-2">
              {(accountData.signers || []).map((s: Horizon.AccountSigner, i: number) => (
                <div
                  key={i}
                  className="bg-white/5 rounded-xl p-2.5 border border-white/5 flex items-center justify-between text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <AddressLabelBadge address={s.key} />
                    <CopyableValue value={s.key} title="Copy signer key">
                      {shortAddress(s.key, 6)}
                    </CopyableValue>
                  </div>
                  <span className="text-xs font-mono font-bold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                    weight: {s.weight}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: Offers & Claims */}
      {activeTab === 'offers' && (
        <div className="space-y-3 animate-in fade-in duration-200">
          {/* Open Offers */}
          <div className="bg-[#181d20]/95 border border-white/10 rounded-2xl p-4 shadow-lg space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">
              Open DEX Offers ({offers.length})
            </h4>

            {offersLoading ? (
              <div className="text-center py-4 text-xs text-gray-400">Loading offers...</div>
            ) : offersError ? (
              <div className="text-center py-4 text-xs text-rose-400">Error: {offersError}</div>
            ) : offers.length === 0 ? (
              <div className="text-center py-6 text-gray-500 text-xs">No active open offers</div>
            ) : (
              <div className="space-y-2">
                {offers.map((offer) => (
                  <div
                    key={offer.id}
                    className="bg-white/5 rounded-xl p-3 border border-white/5 space-y-1.5 text-xs"
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-mono text-[11px] text-gray-400">ID: {offer.id}</span>
                      <a
                        href={`https://stellar.expert/explorer/${network}/offer/${offer.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-cyan-400 text-[11px] flex items-center gap-0.5"
                      >
                        View <ExternalLink size={10} />
                      </a>
                    </div>
                    <div className="flex justify-between text-gray-300">
                      <span>Selling: {formatXLM(offer.amount)} {offer.selling.asset_code || 'XLM'}</span>
                      <span>Buying: {offer.buying.asset_code || 'XLM'}</span>
                    </div>
                    <div className="text-[11px] text-gray-500 font-mono">
                      Price: {offer.price}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Claimable Balances Card */}
          <div className="bg-[#181d20]/95 border border-white/10 rounded-2xl p-4 shadow-lg flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-white">Claimable Balances</h4>
              <p className="text-xs text-gray-400 mt-0.5">Claim pending incoming payments</p>
            </div>
            <button
              onClick={() => useStore.getState().setActiveTab('claimableBalances')}
              className="px-3 py-1.5 bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 rounded-xl text-xs font-semibold hover:bg-cyan-500/20 transition-colors"
            >
              View ⊛
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MobileAccountOverview;
