import React, { useState, useEffect, useCallback } from 'react';
import { useStore } from '../../lib/store';
import { useResponsive } from '../../hooks/useResponsive';
import { useErrorHandler } from '../../hooks/useErrorHandler';
import { searchAssets, fetchAssets, POPULAR_ASSETS } from '../../lib/stellar';
import { addBreadcrumb } from '../../lib/errorReporting';
import AssetList from './AssetList';
import AssetSearch from './AssetSearch';
import AssetFilters from './AssetFilters';
import PopularAssets from './PopularAssets';
import TrustlineRecommendations from './TrustlineRecommendations';

const DEFAULT_FILTERS = {
  verified_only: false,
  min_accounts: null,
  max_accounts: null,
  has_domain: false,
  sort_by: 'num_accounts',
  order: 'desc',
  asset_type: '',
  code_pattern: '',
  min_volume_24h: null,
  volatility: '',
  reputation_min: 0,
  verification_level: '',
};

// Compute a simple reputation score from asset data (0-100)
function computeReputationScore(asset) {
  let score = 0;
  if (asset.is_verified) score += 30;
  if (asset.domain) score += 20;
  if (asset.num_accounts > 10000) score += 20;
  else if (asset.num_accounts > 1000) score += 10;
  if (!asset.flags?.auth_revocable) score += 10;
  if (!asset.flags?.auth_clawback_enabled) score += 10;
  if (!asset.flags?.auth_required) score += 10;
  return Math.min(score, 100);
}

// Map change_24h % to volatility bucket
function getVolatilityBucket(change24h) {
  if (change24h === undefined || change24h === null) return null;
  const abs = Math.abs(change24h);
  if (abs < 1) return 'stable';
  if (abs < 5) return 'low';
  if (abs < 15) return 'medium';
  return 'high';
}

// Apply client-side advanced filters
function applyAdvancedFilters(assets, filters, marketDataMap) {
  let result = [...assets];

  if (filters.code_pattern) {
    try {
      const re = new RegExp(filters.code_pattern, 'i');
      result = result.filter(a => re.test(a.code));
    } catch {
      // invalid regex — skip
    }
  }

  if (filters.verification_level) {
    result = result.filter(a => {
      const level = a.verification_level || (a.is_verified ? 'domain' : 'none');
      return level === filters.verification_level;
    });
  }

  if (filters.reputation_min > 0) {
    result = result.filter(a => computeReputationScore(a) >= filters.reputation_min);
  }

  if (filters.min_volume_24h) {
    result = result.filter(a => {
      const md = marketDataMap[`${a.code}:${a.issuer}`];
      return md && md.volume_24h_usd >= filters.min_volume_24h;
    });
  }

  if (filters.volatility) {
    result = result.filter(a => {
      const md = marketDataMap[`${a.code}:${a.issuer}`];
      if (!md) return false;
      return getVolatilityBucket(md.change_24h) === filters.volatility;
    });
  }

  return result;
}

export default function AssetDiscovery() {
  const { network, connectedAddress } = useStore();
  const { isMobile } = useResponsive();
  const { handleError } = useErrorHandler('AssetDiscovery');

  const [assets, setAssets] = useState([]);
  const [filteredAssets, setFilteredAssets] = useState([]);
  const [marketDataMap, setMarketDataMap] = useState({});
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [activeTab, setActiveTab] = useState('popular');
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    loadAssets();
    addBreadcrumb('Asset discovery opened', 'navigation', { network });
  }, [network, filters.verified_only, filters.min_accounts, filters.max_accounts,
      filters.has_domain, filters.sort_by, filters.order, filters.asset_type]);

  // Apply client-side advanced filters whenever assets or relevant filters change
  useEffect(() => {
    const result = applyAdvancedFilters(assets, filters, marketDataMap);
    setFilteredAssets(result);
  }, [assets, filters.code_pattern, filters.verification_level,
      filters.reputation_min, filters.min_volume_24h, filters.volatility, marketDataMap]);

  const loadAssets = async (cursor = null, append = false) => {
    try {
      setLoading(true);

      // Only pass Horizon-supported filters to the API
      const horizonFilters = {
        verified_only: filters.verified_only,
        min_accounts: filters.min_accounts,
        max_accounts: filters.max_accounts,
        has_domain: filters.has_domain,
        sort_by: filters.sort_by,
        order: filters.order,
        asset_type: filters.asset_type || undefined,
        cursor,
        limit: 20,
      };

      let result;
      if (searchQuery.trim()) {
        result = { records: await searchAssets(searchQuery, network, horizonFilters) };
      } else {
        result = await fetchAssets(network, horizonFilters);
      }

      const newAssets = append
        ? [...assets, ...result.records]
        : result.records;

      setAssets(newAssets);
      setNextCursor(result.next);
      setHasMore(!!result.next);

      addBreadcrumb('Assets loaded', 'api_call', {
        count: result.records.length,
        searchQuery,
        filters,
      });
    } catch (error) {
      handleError(error, { searchQuery, filters });
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (query) => {
    setSearchQuery(query);
    setActiveTab('search');
    await loadAssets();
  };

  const handleFilterChange = (newFilters) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  const loadMore = () => {
    if (nextCursor && !loading) {
      loadAssets(nextCursor, true);
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    addBreadcrumb('Asset discovery tab changed', 'navigation', { tab });
  };

  // Volatility badge helper for display in list
  const getVolatilityIndicator = (change24h) => {
    const bucket = getVolatilityBucket(change24h);
    const map = {
      stable: { icon: '🟢', label: 'Stable', color: 'var(--green)' },
      low:    { icon: '🟡', label: 'Low Vol', color: 'var(--amber)' },
      medium: { icon: '🟠', label: 'Med Vol', color: 'var(--orange, #f97316)' },
      high:   { icon: '🔴', label: 'High Vol', color: 'var(--red)' },
    };
    return bucket ? map[bucket] : null;
  };

  const containerStyles = {
    padding: isMobile ? '16px' : '24px',
    maxWidth: '1200px',
    margin: '0 auto',
  };

  const tabStyles = {
    display: 'flex',
    gap: '8px',
    marginBottom: '24px',
    borderBottom: '1px solid var(--border)',
    overflowX: 'auto',
    paddingBottom: '8px',
  };

  const tabBtn = (isActive) => ({
    padding: isMobile ? '12px 16px' : '8px 16px',
    background: isActive ? 'var(--cyan-glow)' : 'transparent',
    border: `1px solid ${isActive ? 'var(--cyan)' : 'var(--border)'}`,
    borderRadius: 'var(--radius-md)',
    color: isActive ? 'var(--cyan)' : 'var(--text-secondary)',
    fontSize: '13px',
    fontFamily: 'var(--font-mono)',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'var(--transition)',
    whiteSpace: 'nowrap',
    minHeight: isMobile ? 'var(--touch-target)' : 'auto',
  });

  return (
    <div className="animate-in" style={containerStyles}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: isMobile ? '24px' : '28px',
          fontWeight: 800,
          color: 'var(--text-primary)',
          marginBottom: '8px',
        }}>
          Asset Discovery
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: isMobile ? '14px' : '16px', lineHeight: 1.5 }}>
          Discover, analyze, and manage Stellar assets with advanced filters,
          reputation scoring, and real-time volatility indicators.
        </p>
      </div>

      {/* Search */}
      <div style={{ marginBottom: '24px' }}>
        <AssetSearch
          onSearch={handleSearch}
          loading={loading}
          placeholder="Search assets by code, issuer, or domain..."
        />
      </div>

      {/* Tabs */}
      <div style={tabStyles}>
        <button onClick={() => handleTabChange('popular')} style={tabBtn(activeTab === 'popular')}>🌟 Popular</button>
        <button onClick={() => handleTabChange('all')} style={tabBtn(activeTab === 'all')}>📋 All Assets</button>
        {searchQuery && (
          <button onClick={() => handleTabChange('search')} style={tabBtn(activeTab === 'search')}>🔍 Search Results</button>
        )}
        {connectedAddress && (
          <button onClick={() => handleTabChange('recommendations')} style={tabBtn(activeTab === 'recommendations')}>💡 Recommendations</button>
        )}
      </div>

      {/* Filters (shown for all/search tabs) */}
      {(activeTab === 'all' || activeTab === 'search') && (
        <div style={{ marginBottom: '24px' }}>
          <AssetFilters filters={filters} onChange={handleFilterChange} />
        </div>
      )}

      {/* Results summary */}
      {(activeTab === 'all' || activeTab === 'search') && !loading && filteredAssets.length !== assets.length && (
        <div style={{
          marginBottom: '12px',
          fontSize: '13px',
          color: 'var(--text-secondary)',
          fontFamily: 'var(--font-mono)',
        }}>
          Showing <strong style={{ color: 'var(--cyan)' }}>{filteredAssets.length}</strong> of {assets.length} assets after advanced filters
        </div>
      )}

      {/* Content */}
      <div>
        {activeTab === 'popular' && (
          <PopularAssets assets={POPULAR_ASSETS} network={network} />
        )}

        {(activeTab === 'all' || activeTab === 'search') && (
          <AssetList
            assets={filteredAssets}
            loading={loading}
            hasMore={hasMore}
            onLoadMore={loadMore}
            network={network}
            emptyMessage={
              activeTab === 'search'
                ? `No assets found for "${searchQuery}"`
                : 'No assets match the current filters'
            }
          />
        )}

        {activeTab === 'recommendations' && connectedAddress && (
          <TrustlineRecommendations
            accountId={connectedAddress}
            network={network}
          />
        )}
      </div>
    </div>
  );
}
