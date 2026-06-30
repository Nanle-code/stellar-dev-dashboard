import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Filter,
  Calendar,
  DollarSign,
  Hash,
  FileText,
  Clock,
  ChevronDown,
  ChevronUp,
  X,
  Save,
  History,
  BarChart3,
  Download,
  RefreshCw,
  SlidersHorizontal,
  Tag,
  Activity,
  Globe,
  CheckCircle,
  AlertCircle,
  Folder,
  Share2,
  BellRing,
  Copy,
} from 'lucide-react';
import advancedSearchService from '../../lib/advancedSearch.js';
import auditTrail from '../../lib/auditTrail.js';
import { format } from 'date-fns';

export default function AdvancedSearch() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [savedSearches, setSavedSearches] = useState([]);
  const [savedFolders, setSavedFolders] = useState([]);
  const [searchAnalytics, setSearchAnalytics] = useState(null);
  const [searchHistory, setSearchHistory] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedTypes, setSelectedTypes] = useState(['transactions', 'operations', 'contracts', 'accounts']);
  const [savedSearchFolder, setSavedSearchFolder] = useState('General');
  const [createAlertOnSave, setCreateAlertOnSave] = useState(false);
  const [alertCron, setAlertCron] = useState('0 * * * *');
  const [shareToken, setShareToken] = useState('');
  
  const [filters, setFilters] = useState({
    dateRange: { start: '', end: '' },
    assetType: '',
    operationType: '',
    amountRange: { min: '', max: '' },
    addressFilter: '',
    memoFilter: '',
    statusFilter: '',
    networkFilter: '',
  });

  const [sort, setSort] = useState({
    field: 'timestamp',
    direction: 'desc'
  });

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (searchQuery.length > 1) {
      const newSuggestions = advancedSearchService.getSuggestions(searchQuery);
      setSuggestions(newSuggestions);
      setShowSuggestions(true);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [searchQuery]);

  const loadData = () => {
    setSavedSearches(advancedSearchService.getSavedSearches());
    setSavedFolders(advancedSearchService.getSavedSearchFolders());
    setSearchHistory(advancedSearchService.getSearchHistory());
    setSearchAnalytics(advancedSearchService.getSearchAnalytics());
  };

  const handleSearch = async () => {
    if (!searchQuery.trim() && !hasActiveFilters()) {
      return;
    }

    setLoading(true);
    try {
      const query = {
        text: searchQuery.trim(),
        types: selectedTypes,
        filters: buildFilters(),
        sort,
        page: pagination.page,
        limit: pagination.limit
      };

      const results = advancedSearchService.search(query);
      setSearchResults(results);

      auditTrail.logUserAction('Performed advanced search', {
        query: searchQuery.trim(),
        types: selectedTypes,
        resultCount: results.total,
        searchTime: results.searchTime
      });
      loadData();

    } catch (error) {
      auditTrail.logError(error, { operation: 'advancedSearch', query: searchQuery });
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const buildFilters = () => {
    const builtFilters = {};
    
    if (filters.dateRange.start) {
      builtFilters.dateRange = { ...builtFilters.dateRange, start: new Date(filters.dateRange.start).getTime() };
    }
    if (filters.dateRange.end) {
      builtFilters.dateRange = { ...builtFilters.dateRange, end: new Date(filters.dateRange.end).getTime() };
    }
    
    if (filters.assetType) builtFilters.assetType = filters.assetType;
    if (filters.operationType) builtFilters.operationType = filters.operationType;
    if (filters.addressFilter) builtFilters.addressFilter = filters.addressFilter;
    if (filters.memoFilter) builtFilters.memoFilter = filters.memoFilter;
    if (filters.statusFilter) builtFilters.statusFilter = filters.statusFilter;
    if (filters.networkFilter) builtFilters.networkFilter = filters.networkFilter;
    
    if (filters.amountRange.min) {
      builtFilters.amountRange = { ...builtFilters.amountRange, min: parseFloat(filters.amountRange.min) };
    }
    if (filters.amountRange.max) {
      builtFilters.amountRange = { ...builtFilters.amountRange, max: parseFloat(filters.amountRange.max) };
    }
    
    return builtFilters;
  };

  const hasActiveFilters = () => {
    return Object.values(filters).some(value => {
      if (typeof value === 'object' && value !== null) {
        return Object.values(value).some(v => v !== '');
      }
      return value !== '';
    });
  };

  const clearFilters = () => {
    setFilters({
      dateRange: { start: '', end: '' },
      assetType: '',
      operationType: '',
      amountRange: { min: '', max: '' },
      addressFilter: '',
      memoFilter: '',
      statusFilter: '',
      networkFilter: '',
    });
    advancedSearchService.resetFilters();
  };

  const saveSearch = () => {
    const name = prompt('Enter a name for this search:');
    if (name) {
      const query = {
        text: searchQuery.trim(),
        types: selectedTypes,
        filters: buildFilters(),
        sort
      };
      const saved = advancedSearchService.saveSearch(name, query, { folder: savedSearchFolder });
      if (createAlertOnSave) {
        advancedSearchService.createSearchAlert({
          savedSearchId: saved.id,
          name: `${name} alert`,
          cron: alertCron,
          channels: ['in-app'],
        });
      }
      loadData();
      
      auditTrail.logUserAction('Saved search', { name, query });
    }
  };

  const loadSavedSearch = (savedSearch) => {
    const selectedSearch = advancedSearchService.loadSavedSearch(savedSearch.id) || savedSearch;
    setSearchQuery(selectedSearch.query.text || '');
    setSelectedTypes(selectedSearch.query.types || ['transactions', 'operations']);
    
    // Reset filters and load saved ones
    clearFilters();
    if (selectedSearch.query.filters) {
      setFilters({ ...filters, ...selectedSearch.query.filters });
    }
    
    if (selectedSearch.query.sort) {
      setSort(selectedSearch.query.sort);
    }
    
    setShowHistory(false);
    loadData();
    handleSearch();
  };

  const shareSavedSearch = (event, savedSearch) => {
    event.stopPropagation();
    const token = advancedSearchService.shareSearch(savedSearch.id);
    setShareToken(token);
    loadData();
  };

  const exportResults = () => {
    if (!searchResults) return;
    
    const data = JSON.stringify(searchResults, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stellar-search-results-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    auditTrail.logUserAction('Exported search results', { resultCount: searchResults.total });
  };

  const handleSuggestionClick = (suggestion) => {
    setSearchQuery(suggestion);
    setShowSuggestions(false);
  };

  const handleTypeToggle = (type) => {
    setSelectedTypes(prev => 
      prev.includes(type) 
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  };

  return (
    <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Search size={22} style={{ color: 'var(--cyan)' }} />
          Advanced Search
        </div>
        <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
          Global search across transactions, operations, contracts, and accounts
        </div>
      </div>

      {/* Search Bar */}
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: '20px',
        }}
      >
        {/* Main Search Input */}
        <div style={{ position: 'relative', marginBottom: '16px' }}>
          <Search
            size={16}
            style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search transactions, operations, contracts, accounts..."
            style={{
              ...inputStyle,
              paddingLeft: '40px',
              paddingRight: '120px',
              fontSize: '14px',
            }}
          />
          
          <div style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', display: 'flex', gap: '4px' }}>
            <button
              onClick={() => setShowHistory(!showHistory)}
              style={{ ...iconButtonStyle, title: 'Search History' }}
            >
              <History size={14} />
            </button>
            <button
              onClick={saveSearch}
              style={{ ...iconButtonStyle, title: 'Save Search' }}
            >
              <Save size={14} />
            </button>
            <button
              onClick={handleSearch}
              disabled={loading}
              style={{ ...iconButtonStyle, background: 'var(--cyan)', color: 'white', title: 'Search' }}
            >
              {loading ? <RefreshCw size={14} className="animate-spin" /> : <Search size={14} />}
            </button>
          </div>

          {/* Suggestions */}
          {showSuggestions && suggestions.length > 0 && (
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderTop: 'none',
              borderRadius: '0 0 var(--radius-md) var(--radius-md)',
              maxHeight: '200px',
              overflowY: 'auto',
              zIndex: 10,
            }}>
              {suggestions.map((suggestion, index) => (
                <div
                  key={index}
                  onClick={() => handleSuggestionClick(suggestion)}
                  style={{
                    padding: '8px 12px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    color: 'var(--text-primary)',
                    borderBottom: '1px solid var(--border)',
                  }}
                  onMouseEnter={(e) => e.target.style.background = 'var(--bg-card)'}
                  onMouseLeave={(e) => e.target.style.background = 'transparent'}
                >
                  {suggestion}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Type Selection */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>Search in:</div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {['transactions', 'operations', 'contracts', 'accounts'].map(type => (
              <button
                key={type}
                onClick={() => handleTypeToggle(type)}
                style={{
                  ...chipStyle,
                  background: selectedTypes.includes(type) ? 'var(--cyan)' : 'var(--bg-elevated)',
                  color: selectedTypes.includes(type) ? 'white' : 'var(--text-primary)',
                }}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Saved Query Options */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', marginBottom: '16px' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px', color: 'var(--text-muted)' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
              <Folder size={12} /> Save folder
            </span>
            <input
              value={savedSearchFolder}
              onChange={(e) => setSavedSearchFolder(e.target.value)}
              style={{ ...inputStyle, fontSize: '12px' }}
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px', color: 'var(--text-muted)' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
              <BellRing size={12} /> Alert schedule
            </span>
            <input
              value={alertCron}
              onChange={(e) => setAlertCron(e.target.value)}
              disabled={!createAlertOnSave}
              style={{ ...inputStyle, fontSize: '12px', opacity: createAlertOnSave ? 1 : 0.55 }}
            />
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-secondary)', alignSelf: 'end', minHeight: '34px' }}>
            <input
              type="checkbox"
              checked={createAlertOnSave}
              onChange={(e) => setCreateAlertOnSave(e.target.checked)}
            />
            Create alert when saved
          </label>
        </div>

        {/* Filter Toggle */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button
            onClick={() => setShowFilters(!showFilters)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 12px',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-primary)',
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            <SlidersHorizontal size={14} />
            {showFilters ? 'Hide Filters' : 'Show Filters'}
            {showFilters ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {hasActiveFilters() && (
            <button
              onClick={clearFilters}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 12px',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid var(--red)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--red)',
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              <X size={14} />
              Clear Filters
            </button>
          )}
        </div>

        {/* Advanced Filters */}
        {showFilters && (
          <div style={{
            marginTop: '16px',
            padding: '16px',
            background: 'var(--bg-elevated)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border)',
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              {/* Date Range */}
              <div>
                <label style={labelStyle}>
                  <Calendar size={12} style={{ marginRight: '4px' }} />
                  Date Range
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="date"
                    value={filters.dateRange.start}
                    onChange={(e) => setFilters(prev => ({ 
                      ...prev, 
                      dateRange: { ...prev.dateRange, start: e.target.value }
                    }))}
                    style={{ ...inputStyle, fontSize: '12px' }}
                  />
                  <input
                    type="date"
                    value={filters.dateRange.end}
                    onChange={(e) => setFilters(prev => ({ 
                      ...prev, 
                      dateRange: { ...prev.dateRange, end: e.target.value }
                    }))}
                    style={{ ...inputStyle, fontSize: '12px' }}
                  />
                </div>
              </div>

              {/* Asset Type */}
              <div>
                <label style={labelStyle}>
                  <Tag size={12} style={{ marginRight: '4px' }} />
                  Asset Type
                </label>
                <select
                  value={filters.assetType}
                  onChange={(e) => setFilters(prev => ({ ...prev, assetType: e.target.value }))}
                  style={{ ...inputStyle, fontSize: '12px' }}
                >
                  <option value="">All Assets</option>
                  <option value="XLM">XLM</option>
                  <option value="USDC">USDC</option>
                  <option value="BTC">BTC</option>
                  <option value="ETH">ETH</option>
                  <option value="USDT">USDT</option>
                </select>
              </div>

              {/* Operation Type */}
              <div>
                <label style={labelStyle}>
                  <Activity size={12} style={{ marginRight: '4px' }} />
                  Operation Type
                </label>
                <select
                  value={filters.operationType}
                  onChange={(e) => setFilters(prev => ({ ...prev, operationType: e.target.value }))}
                  style={{ ...inputStyle, fontSize: '12px' }}
                >
                  <option value="">All Operations</option>
                  <option value="payment">Payment</option>
                  <option value="create_account">Create Account</option>
                  <option value="manage_offer">Manage Offer</option>
                  <option value="set_options">Set Options</option>
                  <option value="change_trust">Change Trust</option>
                </select>
              </div>

              {/* Amount Range */}
              <div>
                <label style={labelStyle}>
                  <DollarSign size={12} style={{ marginRight: '4px' }} />
                  Amount Range
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="number"
                    placeholder="Min"
                    value={filters.amountRange.min}
                    onChange={(e) => setFilters(prev => ({ 
                      ...prev, 
                      amountRange: { ...prev.amountRange, min: e.target.value }
                    }))}
                    style={{ ...inputStyle, fontSize: '12px' }}
                  />
                  <input
                    type="number"
                    placeholder="Max"
                    value={filters.amountRange.max}
                    onChange={(e) => setFilters(prev => ({ 
                      ...prev, 
                      amountRange: { ...prev.amountRange, max: e.target.value }
                    }))}
                    style={{ ...inputStyle, fontSize: '12px' }}
                  />
                </div>
              </div>

              {/* Address Filter */}
              <div>
                <label style={labelStyle}>
                  <Hash size={12} style={{ marginRight: '4px' }} />
                  Address Filter
                </label>
                <input
                  type="text"
                  placeholder="Account address..."
                  value={filters.addressFilter}
                  onChange={(e) => setFilters(prev => ({ ...prev, addressFilter: e.target.value }))}
                  style={{ ...inputStyle, fontSize: '12px' }}
                />
              </div>

              {/* Memo Filter */}
              <div>
                <label style={labelStyle}>
                  <FileText size={12} style={{ marginRight: '4px' }} />
                  Memo Filter
                </label>
                <input
                  type="text"
                  placeholder="Memo text..."
                  value={filters.memoFilter}
                  onChange={(e) => setFilters(prev => ({ ...prev, memoFilter: e.target.value }))}
                  style={{ ...inputStyle, fontSize: '12px' }}
                />
              </div>

              {/* Status Filter */}
              <div>
                <label style={labelStyle}>
                  <CheckCircle size={12} style={{ marginRight: '4px' }} />
                  Status
                </label>
                <select
                  value={filters.statusFilter}
                  onChange={(e) => setFilters(prev => ({ ...prev, statusFilter: e.target.value }))}
                  style={{ ...inputStyle, fontSize: '12px' }}
                >
                  <option value="">All Status</option>
                  <option value="success">Success</option>
                  <option value="failed">Failed</option>
                  <option value="pending">Pending</option>
                </select>
              </div>

              {/* Network Filter */}
              <div>
                <label style={labelStyle}>
                  <Globe size={12} style={{ marginRight: '4px' }} />
                  Network
                </label>
                <select
                  value={filters.networkFilter}
                  onChange={(e) => setFilters(prev => ({ ...prev, networkFilter: e.target.value }))}
                  style={{ ...inputStyle, fontSize: '12px' }}
                >
                  <option value="">All Networks</option>
                  <option value="mainnet">Mainnet</option>
                  <option value="testnet">Testnet</option>
                  <option value="futurenet">Futurenet</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Search History */}
      {showHistory && (
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: '16px',
          }}
        >
          <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Search History & Saved Searches</span>
            <button onClick={() => setShowHistory(false)} style={iconButtonStyle}>
              <X size={14} />
            </button>
          </div>

          {searchAnalytics && (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
              <AnalyticsChip label="Searches" value={searchAnalytics.totalSearches} />
              <AnalyticsChip label="Cache hits" value={searchAnalytics.cachedSearches} />
              <AnalyticsChip label="Saved" value={searchAnalytics.savedSearches} />
              <AnalyticsChip label="Alerts" value={searchAnalytics.alerts} />
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
            {/* Folders */}
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>Folders</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {savedFolders.map((folder) => (
                  <button
                    key={folder.id}
                    onClick={() => {
                      setSavedSearchFolder(folder.name);
                      setSavedSearches(advancedSearchService.getSavedSearches({ folder: folder.name }));
                    }}
                    style={{
                      padding: '8px 12px',
                      background: savedSearchFolder === folder.name ? 'var(--cyan-glow)' : 'var(--bg-elevated)',
                      border: `1px solid ${savedSearchFolder === folder.name ? 'var(--cyan-dim)' : 'var(--border)'}`,
                      borderRadius: 'var(--radius-md)',
                      cursor: 'pointer',
                      fontSize: '12px',
                      color: 'var(--text-primary)',
                      display: 'flex',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span>{folder.name}</span>
                    <span style={{ color: 'var(--text-muted)' }}>{folder.count}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Recent Searches */}
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>Recent Searches</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {searchHistory.slice(0, 5).map((item, index) => (
                  <div
                    key={index}
                    onClick={() => {
                      setSearchQuery(item.query.text || '');
                      setShowHistory(false);
                    }}
                    style={{
                      padding: '8px 12px',
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)',
                      cursor: 'pointer',
                      fontSize: '12px',
                    }}
                  >
                    <div style={{ fontWeight: 500 }}>{item.query.text || 'Empty search'}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                      {format(new Date(item.timestamp), 'MMM dd, HH:mm')} / {item.resultCount || 0} results / {item.cached ? 'cached' : `${item.searchTime || 0}ms`}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Saved Searches */}
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>Saved Searches</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {savedSearches.slice(0, 5).map((item, index) => (
                  <div
                    key={index}
                    onClick={() => loadSavedSearch(item)}
                    style={{
                      padding: '8px 12px',
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)',
                      cursor: 'pointer',
                      fontSize: '12px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                      <div style={{ fontWeight: 500 }}>{item.name}</div>
                      <button onClick={(event) => shareSavedSearch(event, item)} style={{ ...iconButtonStyle, width: '26px', height: '26px' }} title="Share query">
                        <Share2 size={12} />
                      </button>
                    </div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                      {item.folder || 'General'} / {item.query.text || 'No query'} / used {item.usageCount || 0}x
                    </div>
                  </div>
                ))}
                {shareToken && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 12px',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '11px',
                    color: 'var(--text-muted)',
                  }}>
                    <Copy size={12} />
                    <span style={{ overflowWrap: 'anywhere' }}>{shareToken}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search Results */}
      {searchResults && (
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
          }}
        >
          {/* Results Header */}
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 600 }}>
                {searchResults.total} results found
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Search completed in {searchResults.searchTime}ms{searchResults.cached ? ' from cache' : ''}
              </div>
              {searchResults.queryPlan && (
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  {searchResults.queryPlan.usesIndex ? 'Index-assisted' : 'Scan'} / {searchResults.queryPlan.filterCount} filters / cache TTL {Math.round(searchResults.queryPlan.cacheTtlMs / 1000)}s
                </div>
              )}
            </div>
            
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={exportResults}
                style={iconButtonStyle}
                title="Export Results"
              >
                <Download size={14} />
              </button>
              <button
                onClick={handleSearch}
                style={iconButtonStyle}
                title="Refresh"
              >
                <RefreshCw size={14} />
              </button>
            </div>
          </div>

          {/* Results Body */}
          {searchResults.results.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
              No results found for your search criteria.
            </div>
          ) : (
            <div>
              {/* Aggregations */}
              {searchResults.aggregations && (
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>Results Overview</div>
                  <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                    <AggregationChip label="Types" data={searchResults.aggregations.typeCounts} />
                    <AggregationChip label="Operations" data={searchResults.aggregations.operationTypeCounts} />
                    <AggregationChip label="Assets" data={searchResults.aggregations.assetCounts} />
                    <AggregationChip label="Status" data={searchResults.aggregations.statusCounts} />
                  </div>
                </div>
              )}

              {/* Results List */}
              <div>
                {searchResults.results.map((result, index) => (
                  <SearchResultItem key={result.id} result={result} />
                ))}
              </div>

              {/* Pagination */}
              {searchResults.totalPages > 1 && (
                <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                    disabled={searchResults.page === 1}
                    style={paginationButtonStyle}
                  >
                    Previous
                  </button>
                  
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Page {searchResults.page} of {searchResults.totalPages}
                  </span>
                  
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, page: Math.min(searchResults.totalPages, prev.page + 1) }))}
                    disabled={searchResults.page === searchResults.totalPages}
                    style={paginationButtonStyle}
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SearchResultItem({ result }) {
  const [expanded, setExpanded] = useState(false);

  const getTypeIcon = (type) => {
    const icons = {
      transactions: <Hash size={14} />,
      operations: <Activity size={14} />,
      contracts: <FileText size={14} />,
      accounts: <Globe size={14} />
    };
    return icons[type] || <Search size={14} />;
  };

  const getTypeColor = (type) => {
    const colors = {
      transactions: 'var(--blue)',
      operations: 'var(--green)',
      contracts: 'var(--purple)',
      accounts: 'var(--orange)'
    };
    return colors[type] || 'var(--text-secondary)';
  };

  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      <div
        style={{
          padding: '16px 20px',
          cursor: 'pointer',
          transition: 'var(--transition)',
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', flex: 1 }}>
            <div style={{ color: getTypeColor(result.type), marginTop: '2px' }}>
              {getTypeIcon(result.type)}
            </div>
            
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                {result.type.charAt(0).toUpperCase() + result.type.slice(1)}
                {result.operationType && ` • ${result.operationType}`}
              </div>
              
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                {result.address && <span>Address: {result.address.substring(0, 16)}... </span>}
                {result.asset && <span>Asset: {result.asset} </span>}
                {result.amount && <span>Amount: {result.amount} </span>}
                {result.status && <span>Status: {result.status}</span>}
              </div>
              
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                {new Date(result.timestamp).toLocaleString()}
              </div>
            </div>
          </div>
          
          <div style={{ color: 'var(--text-muted)' }}>
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        </div>
      </div>
      
      {expanded && (
        <div style={{ padding: '0 20px 16px', background: 'var(--bg-elevated)' }}>
          <pre style={{
            margin: 0,
            fontSize: '11px',
            color: 'var(--text-secondary)',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
            maxHeight: '300px',
            overflowY: 'auto',
          }}>
            {JSON.stringify(result.data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

function AggregationChip({ label, data }) {
  const entries = Object.entries(data).slice(0, 3);
  
  return (
    <div style={{
      padding: '4px 8px',
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border)',
      borderRadius: '999px',
      fontSize: '11px',
    }}>
      <span style={{ color: 'var(--text-muted)' }}>{label}:</span>
      {entries.map(([key, value], index) => (
        <span key={key} style={{ marginLeft: '4px' }}>
          {key} ({value})
          {index < entries.length - 1 && ', '}
        </span>
      ))}
      {Object.keys(data).length > 3 && '...'}
    </div>
  );
}

const inputStyle = {
  width: '100%',
  padding: '8px 12px',
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  color: 'var(--text-primary)',
  fontSize: '13px',
  fontFamily: 'var(--font-mono)',
  outline: 'none',
};

const labelStyle = {
  fontSize: '12px',
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  display: 'flex',
  alignItems: 'center',
  marginBottom: '6px',
};

const chipStyle = {
  padding: '4px 12px',
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border)',
  borderRadius: '999px',
  fontSize: '12px',
  cursor: 'pointer',
  transition: 'var(--transition)',
};

const iconButtonStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '32px',
  height: '32px',
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  color: 'var(--text-primary)',
  cursor: 'pointer',
  transition: 'var(--transition)',
};

const paginationButtonStyle = {
  padding: '6px 12px',
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  color: 'var(--text-primary)',
  fontSize: '12px',
  cursor: 'pointer',
  transition: 'var(--transition)',
};
