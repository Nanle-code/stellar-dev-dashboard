/**
 * Advanced Search and Filtering System
 * Global search functionality across transactions, operations, and contracts
 */

const STORAGE_KEYS = {
  history: 'stellar-advanced-search-history-v1',
  saved: 'stellar-advanced-search-saved-v1',
  alerts: 'stellar-advanced-search-alerts-v1',
  folders: 'stellar-advanced-search-folders-v1',
};

function getBrowserStorage() {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

function readStoredArray(storage, key, fallback = []) {
  if (!storage) return [...fallback];
  try {
    const parsed = JSON.parse(storage.getItem(key) || 'null');
    return Array.isArray(parsed) ? parsed : [...fallback];
  } catch {
    return [...fallback];
  }
}

function writeStoredArray(storage, key, value) {
  if (!storage) return;
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // Persistence is best-effort because private browsing can reject writes.
  }
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function makeId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function encodeSharePayload(payload) {
  const serialized = encodeURIComponent(JSON.stringify(payload));
  if (typeof btoa === 'function') return btoa(serialized);
  return serialized;
}

function decodeSharePayload(token) {
  const serialized = typeof atob === 'function' ? atob(token) : token;
  return JSON.parse(decodeURIComponent(serialized));
}

class AdvancedSearchService {
  constructor(options = {}) {
    this.storage = options.storage || getBrowserStorage();
    this.searchHistory = readStoredArray(this.storage, STORAGE_KEYS.history);
    this.savedSearches = readStoredArray(this.storage, STORAGE_KEYS.saved);
    this.searchAlerts = readStoredArray(this.storage, STORAGE_KEYS.alerts);
    this.savedQueryFolders = readStoredArray(this.storage, STORAGE_KEYS.folders, [{ id: 'general', name: 'General', createdAt: new Date().toISOString() }]);
    this.resultCache = new Map();
    this.cacheTtlMs = options.cacheTtlMs || 60 * 1000;
    this.indexedData = new Map();
    this.searchIndex = new Map();
    this.filters = {
      dateRange: { start: null, end: null },
      assetType: null,
      operationType: null,
      amountRange: { min: null, max: null },
      addressFilter: null,
      memoFilter: null,
      statusFilter: null,
      networkFilter: null
    };
    this.sortOptions = {
      field: 'timestamp',
      direction: 'desc'
    };
  }

  /**
   * Index data for fast searching
   * @param {string} type - Data type (transactions, operations, contracts, accounts)
   * @param {array} data - Array of data objects
   */
  indexData(type, data) {
    if (!Array.isArray(data)) return;

    const indexed = data.map(item => this.createSearchableItem(type, item));
    this.indexedData.set(type, indexed);
    
    // Build search index
    indexed.forEach(item => {
      const terms = this.extractSearchTerms(item);
      terms.forEach(term => {
        if (!this.searchIndex.has(term)) {
          this.searchIndex.set(term, new Set());
        }
        this.searchIndex.get(term).add(item.id);
      });
    });
  }

  /**
   * Create searchable item from raw data
   * @param {string} type - Data type
   * @param {object} item - Raw data item
   * @returns {object} Searchable item
   */
  createSearchableItem(type, item) {
    const baseItem = {
      id: `${type}_${item.id || item.hash || item.address}`,
      type,
      data: item,
      timestamp: this.extractTimestamp(item),
      amount: this.extractAmount(item),
      asset: this.extractAsset(item),
      operationType: this.extractOperationType(item),
      address: this.extractAddress(item),
      memo: this.extractMemo(item),
      status: this.extractStatus(item),
      network: item.network || 'unknown'
    };

    // Add type-specific fields
    switch (type) {
      case 'transactions':
        baseItem.transactionHash = item.hash;
        baseItem.fee = item.fee;
        baseItem.operationCount = item.operation_count;
        break;
      case 'operations':
        baseItem.operationId = item.id;
        baseItem.transactionHash = item.transaction_hash;
        baseItem.sourceAccount = item.source_account;
        break;
      case 'contracts':
        baseItem.contractId = item.contract_id || item.id;
        baseItem.contractType = item.type;
        break;
      case 'accounts':
        baseItem.accountId = item.account_id || item.address;
        baseItem.balance = item.balance;
        baseItem.sequence = item.sequence;
        break;
    }

    return baseItem;
  }

  /**
   * Extract search terms from item
   * @param {object} item - Searchable item
   * @returns {array} Array of search terms
   */
  extractSearchTerms(item) {
    const terms = new Set();

    // Add basic fields
    terms.add(item.type.toLowerCase());
    terms.add(item.operationType?.toLowerCase() || '');
    terms.add(item.asset?.toLowerCase() || '');
    terms.add(item.status?.toLowerCase() || '');
    terms.add(item.network?.toLowerCase() || '');

    // Add addresses and hashes
    if (item.address) terms.add(item.address.toLowerCase());
    if (item.transactionHash) terms.add(item.transactionHash.toLowerCase());
    if (item.contractId) terms.add(item.contractId.toLowerCase());
    if (item.accountId) terms.add(item.accountId.toLowerCase());

    // Add memo text
    if (item.memo) {
      terms.add(item.memo.toLowerCase());
      // Split memo into words
      item.memo.toLowerCase().split(/\s+/).forEach(word => {
        if (word.length > 2) terms.add(word);
      });
    }

    // Add amount variations
    if (item.amount) {
      terms.add(item.amount.toString());
      terms.add(parseFloat(item.amount).toFixed(2));
    }

    // Add data-specific terms
    this.extractDataSpecificTerms(item.data, terms);

    return Array.from(terms).filter(term => term.length > 0);
  }

  /**
   * Extract data-specific search terms
   * @param {object} data - Raw data object
   * @param {Set} terms - Terms set to add to
   */
  extractDataSpecificTerms(data, terms) {
    // Recursively extract string values from nested objects
    const extractStrings = (obj, prefix = '') => {
      Object.entries(obj).forEach(([key, value]) => {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        
        if (typeof value === 'string' && value.length > 0) {
          terms.add(value.toLowerCase());
          // Split into words
          value.toLowerCase().split(/\s+/).forEach(word => {
            if (word.length > 2) terms.add(word);
          });
        } else if (typeof value === 'number') {
          terms.add(value.toString());
        } else if (typeof value === 'object' && value !== null) {
          extractStrings(value, fullKey);
        }
      });
    };

    extractStrings(data);
  }

  /**
   * Extract timestamp from item
   * @param {object} item - Raw data item
   * @returns {number} Timestamp
   */
  extractTimestamp(item) {
    if (item.created_at) return new Date(item.created_at).getTime();
    if (item.timestamp) return new Date(item.timestamp).getTime();
    if (item.time) return new Date(item.time).getTime();
    return Date.now();
  }

  /**
   * Extract amount from item
   * @param {object} item - Raw data item
   * @returns {number|null} Amount
   */
  extractAmount(item) {
    if (item.amount) return parseFloat(item.amount);
    if (item.starting_balance) return parseFloat(item.starting_balance);
    if (item.amount_in) return parseFloat(item.amount_in);
    if (item.amount_out) return parseFloat(item.amount_out);
    return null;
  }

  /**
   * Extract asset from item
   * @param {object} item - Raw data item
   * @returns {string|null} Asset code
   */
  extractAsset(item) {
    if (item.asset_code) return item.asset_code;
    if (item.asset_type === 'native') return 'XLM';
    if (item.asset_code && item.asset_issuer) return `${item.asset_code}:${item.asset_issuer}`;
    return null;
  }

  /**
   * Extract operation type from item
   * @param {object} item - Raw data item
   * @returns {string|null} Operation type
   */
  extractOperationType(item) {
    if (item.type) return item.type;
    if (item.operation_type) return this.getOperationTypeName(item.operation_type);
    return null;
  }

  /**
   * Get operation type name from code
   * @param {number} code - Operation type code
   * @returns {string} Operation type name
   */
  getOperationTypeName(code) {
    const types = {
      0: 'payment',
      1: 'create_account',
      2: 'manage_offer',
      3: 'set_options',
      4: 'change_trust',
      5: 'allow_trust',
      6: 'account_merge',
      7: 'inflation',
      8: 'manage_data',
      9: 'bump_sequence',
      10: 'create_claimable_balance',
      11: 'claim_claimable_balance',
      12: 'begin_sponsoring_future_reserves',
      13: 'end_sponsoring_future_reserves',
      14: 'revoke_sponsorship'
    };
    return types[code] || 'unknown';
  }

  /**
   * Extract address from item
   * @param {object} item - Raw data item
   * @returns {string|null} Address
   */
  extractAddress(item) {
    if (item.account_id) return item.account_id;
    if (item.source_account) return item.source_account;
    if (item.destination_account) return item.destination_account;
    if (item.address) return item.address;
    return null;
  }

  /**
   * Extract memo from item
   * @param {object} item - Raw data item
   * @returns {string|null} Memo text
   */
  extractMemo(item) {
    if (item.memo) return item.memo;
    if (item.memo_type && item.memo_value) {
      if (item.memo_type === 'text') return item.memo_value;
      if (item.memo_type === 'id') return item.memo_value.toString();
    }
    return null;
  }

  /**
   * Extract status from item
   * @param {object} item - Raw data item
   * @returns {string|null} Status
   */
  extractStatus(item) {
    if (item.status) return item.status;
    if (item.successful !== undefined) return item.successful ? 'success' : 'failed';
    if (item.result_successful !== undefined) return item.result_successful ? 'success' : 'failed';
    return null;
  }

  /**
   * Perform global search
   * @param {object} query - Search query object
   * @returns {object} Search results
   */
  search(query) {
    const startTime = Date.now();
    
    try {
      const optimizedQuery = this.optimizeQuery(query);

      // Update filters if provided
      if (optimizedQuery.filters) {
        this.filters = { ...this.filters, ...optimizedQuery.filters };
      }

      // Update sort options if provided
      if (optimizedQuery.sort) {
        this.sortOptions = { ...this.sortOptions, ...optimizedQuery.sort };
      }

      const queryPlan = this.buildQueryPlan(optimizedQuery);
      const cacheKey = this.createQueryKey({ ...optimizedQuery, filters: this.filters, sort: this.sortOptions });
      const cached = optimizedQuery.cache !== false ? this.getCachedResults(cacheKey) : null;
      if (cached) {
        const cachedResult = {
          ...cached,
          query: optimizedQuery,
          cached: true,
          searchTime: Date.now() - startTime,
          queryPlan,
        };
        this.addToSearchHistory(optimizedQuery, {
          resultCount: cached.total,
          searchTime: cachedResult.searchTime,
          cached: true,
        });
        return cachedResult;
      }

      // Get all indexed data
      let results = [];
      this.indexedData.forEach((items, type) => {
        if (!optimizedQuery.types || optimizedQuery.types.includes(type)) {
          results.push(...items);
        }
      });

      // Apply text search
      if (optimizedQuery.text && optimizedQuery.text.trim()) {
        results = this.applyTextSearch(results, optimizedQuery.text.trim());
      }

      // Apply filters
      results = this.applyFilters(results);

      // Apply sorting
      results = this.applySorting(results);

      // Apply pagination
      const paginatedResults = this.applyPagination(results, optimizedQuery.page, optimizedQuery.limit);

      const searchTime = Date.now() - startTime;

      const response = {
        query: optimizedQuery,
        results: paginatedResults.items,
        total: paginatedResults.total,
        page: paginatedResults.page,
        limit: paginatedResults.limit,
        searchTime,
        cached: false,
        cacheKey,
        queryPlan,
        filters: { ...this.filters },
        sort: { ...this.sortOptions },
        aggregations: this.calculateAggregations(results)
      };

      this.setCachedResults(cacheKey, response);
      this.addToSearchHistory(optimizedQuery, {
        resultCount: response.total,
        searchTime,
        cached: false,
      });

      return response;

    } catch (error) {
      throw new Error(`Search failed: ${error.message}`);
    }
  }

  /**
   * Apply text search to results
   * @param {array} results - Results array
   * @param {string} searchText - Search text
   * @returns {array} Filtered results
   */
  applyTextSearch(results, searchText) {
    const searchTerms = searchText.toLowerCase().split(/\s+/).filter(term => term.length > 0);
    
    if (searchTerms.length === 0) return results;

    return results.filter(item => {
      return searchTerms.every(term => {
        // Check if any search term matches the item
        return this.itemContainsTerm(item, term);
      });
    });
  }

  /**
   * Check if item contains search term
   * @param {object} item - Searchable item
   * @param {string} term - Search term
   * @returns {boolean} True if item contains term
   */
  itemContainsTerm(item, term) {
    // Check basic fields
    if (item.type?.toLowerCase().includes(term)) return true;
    if (item.operationType?.toLowerCase().includes(term)) return true;
    if (item.asset?.toLowerCase().includes(term)) return true;
    if (item.status?.toLowerCase().includes(term)) return true;
    if (item.address?.toLowerCase().includes(term)) return true;
    if (item.memo?.toLowerCase().includes(term)) return true;

    // Check hashes and IDs
    if (item.transactionHash?.toLowerCase().includes(term)) return true;
    if (item.contractId?.toLowerCase().includes(term)) return true;
    if (item.accountId?.toLowerCase().includes(term)) return true;

    // Check numeric values
    if (item.amount?.toString().includes(term)) return true;

    // Check search index for exact matches
    const indexedItems = this.searchIndex.get(term.toLowerCase());
    if (indexedItems && indexedItems.has(item.id)) return true;

    return false;
  }

  /**
   * Apply filters to results
   * @param {array} results - Results array
   * @returns {array} Filtered results
   */
  applyFilters(results) {
    return results.filter(item => {
      // Date range filter
      if (this.filters.dateRange.start && item.timestamp < this.filters.dateRange.start) {
        return false;
      }
      if (this.filters.dateRange.end && item.timestamp > this.filters.dateRange.end) {
        return false;
      }

      // Asset type filter
      if (this.filters.assetType && item.asset !== this.filters.assetType) {
        return false;
      }

      // Operation type filter
      if (this.filters.operationType && item.operationType !== this.filters.operationType) {
        return false;
      }

      // Amount range filter
      if (this.filters.amountRange.min !== null && (!item.amount || item.amount < this.filters.amountRange.min)) {
        return false;
      }
      if (this.filters.amountRange.max !== null && (!item.amount || item.amount > this.filters.amountRange.max)) {
        return false;
      }

      // Address filter
      if (this.filters.addressFilter && !item.address?.includes(this.filters.addressFilter)) {
        return false;
      }

      // Memo filter
      if (this.filters.memoFilter && !item.memo?.toLowerCase().includes(this.filters.memoFilter.toLowerCase())) {
        return false;
      }

      // Status filter
      if (this.filters.statusFilter && item.status !== this.filters.statusFilter) {
        return false;
      }

      // Network filter
      if (this.filters.networkFilter && item.network !== this.filters.networkFilter) {
        return false;
      }

      return true;
    });
  }

  /**
   * Apply sorting to results
   * @param {array} results - Results array
   * @returns {array} Sorted results
   */
  applySorting(results) {
    const { field, direction } = this.sortOptions;
    
    return results.sort((a, b) => {
      let aValue = a[field];
      let bValue = b[field];

      // Handle null/undefined values
      if (aValue === null || aValue === undefined) aValue = '';
      if (bValue === null || bValue === undefined) bValue = '';

      // Compare based on type
      let comparison = 0;
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        comparison = aValue - bValue;
      } else {
        comparison = String(aValue).localeCompare(String(bValue));
      }

      return direction === 'asc' ? comparison : -comparison;
    });
  }

  /**
   * Apply pagination to results
   * @param {array} results - Results array
   * @param {number} page - Page number (1-based)
   * @param {number} limit - Page size
   * @returns {object} Paginated results
   */
  applyPagination(results, page = 1, limit = 20) {
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    
    return {
      items: results.slice(startIndex, endIndex),
      total: results.length,
      page,
      limit,
      totalPages: Math.ceil(results.length / limit)
    };
  }

  /**
   * Calculate aggregations for results
   * @param {array} results - Results array
   * @returns {object} Aggregations
   */
  calculateAggregations(results) {
    const aggregations = {
      typeCounts: {},
      operationTypeCounts: {},
      assetCounts: {},
      statusCounts: {},
      totalAmount: 0,
      averageAmount: 0,
      dateRange: { earliest: null, latest: null }
    };

    results.forEach(item => {
      // Type counts
      aggregations.typeCounts[item.type] = (aggregations.typeCounts[item.type] || 0) + 1;

      // Operation type counts
      if (item.operationType) {
        aggregations.operationTypeCounts[item.operationType] = 
          (aggregations.operationTypeCounts[item.operationType] || 0) + 1;
      }

      // Asset counts
      if (item.asset) {
        aggregations.assetCounts[item.asset] = (aggregations.assetCounts[item.asset] || 0) + 1;
      }

      // Status counts
      if (item.status) {
        aggregations.statusCounts[item.status] = (aggregations.statusCounts[item.status] || 0) + 1;
      }

      // Amount aggregations
      if (item.amount) {
        aggregations.totalAmount += item.amount;
      }

      // Date range
      if (item.timestamp) {
        if (!aggregations.dateRange.earliest || item.timestamp < aggregations.dateRange.earliest) {
          aggregations.dateRange.earliest = item.timestamp;
        }
        if (!aggregations.dateRange.latest || item.timestamp > aggregations.dateRange.latest) {
          aggregations.dateRange.latest = item.timestamp;
        }
      }
    });

    // Calculate average amount
    const amountCount = results.filter(item => item.amount !== null).length;
    aggregations.averageAmount = amountCount > 0 ? aggregations.totalAmount / amountCount : 0;

    return aggregations;
  }

  /**
   * Normalize query fields before execution.
   * @param {object} query - Search query
   * @returns {object} Optimized query
   */
  optimizeQuery(query = {}) {
    const text = (query.text || '').trim();
    const types = Array.isArray(query.types) && query.types.length
      ? Array.from(new Set(query.types)).sort()
      : null;

    return {
      ...query,
      text,
      types,
      page: Math.max(Number(query.page) || 1, 1),
      limit: Math.min(Math.max(Number(query.limit) || 20, 1), 100),
    };
  }

  /**
   * Build a stable cache key for the effective query.
   * @param {object} query - Search query
   * @returns {string} Cache key
   */
  createQueryKey(query) {
    return stableStringify({
      text: query.text || '',
      types: query.types || null,
      filters: query.filters || {},
      sort: query.sort || {},
      page: query.page || 1,
      limit: query.limit || 20,
    });
  }

  /**
   * Store a result in the in-memory cache.
   * @param {string} key - Cache key
   * @param {object} result - Search response
   */
  setCachedResults(key, result) {
    this.resultCache.set(key, {
      expiresAt: Date.now() + this.cacheTtlMs,
      result,
    });
  }

  /**
   * Read a result from the in-memory cache.
   * @param {string} key - Cache key
   * @returns {object|null} Cached response
   */
  getCachedResults(key) {
    const entry = this.resultCache.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      this.resultCache.delete(key);
      return null;
    }
    return entry.result;
  }

  clearResultCache() {
    this.resultCache.clear();
  }

  /**
   * Produce a lightweight plan for index/caching observability.
   * @param {object} query - Optimized query
   * @returns {object} Query plan summary
   */
  buildQueryPlan(query) {
    const terms = (query.text || '').toLowerCase().split(/\s+/).filter(Boolean);
    const indexedTerms = terms.filter((term) => this.searchIndex.has(term));
    const filterCount = Object.values(query.filters || {}).filter((value) => {
      if (value && typeof value === 'object') {
        return Object.values(value).some((nested) => nested !== null && nested !== '');
      }
      return value !== null && value !== '';
    }).length;

    return {
      textTerms: terms,
      indexedTerms,
      filterCount,
      usesIndex: indexedTerms.length > 0,
      cacheTtlMs: this.cacheTtlMs,
      indexedTypes: query.types || Array.from(this.indexedData.keys()),
    };
  }

  /**
   * Add search to history
   * @param {object} query - Search query
   */
  addToSearchHistory(query, meta = {}) {
    const historyEntry = {
      id: makeId('history'),
      timestamp: new Date().toISOString(),
      query: { ...query },
      resultCount: meta.resultCount || 0,
      searchTime: meta.searchTime || 0,
      cached: Boolean(meta.cached)
    };

    this.searchHistory.unshift(historyEntry);
    
    // Keep only last 50 searches
    if (this.searchHistory.length > 50) {
      this.searchHistory = this.searchHistory.slice(0, 50);
    }

    writeStoredArray(this.storage, STORAGE_KEYS.history, this.searchHistory);
  }

  /**
   * Save search for later use
   * @param {string} name - Search name
   * @param {object} query - Search query
   */
  saveSearch(name, query, options = {}) {
    const folder = options.folder || 'General';
    this.createSavedSearchFolder(folder);
    const savedSearch = {
      id: makeId('saved'),
      name,
      query: { ...query },
      folder,
      tags: options.tags || [],
      description: options.description || '',
      sharedWith: [],
      shareToken: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      usageCount: 0
    };

    this.savedSearches.push(savedSearch);
    writeStoredArray(this.storage, STORAGE_KEYS.saved, this.savedSearches);
    return savedSearch;
  }

  /**
   * Get saved searches
   * @returns {array} Saved searches
   */
  getSavedSearches(options = {}) {
    return [...this.savedSearches]
      .filter((search) => !options.folder || search.folder === options.folder)
      .sort((a, b) => b.usageCount - a.usageCount || new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime());
  }

  loadSavedSearch(id) {
    const savedSearch = this.savedSearches.find((search) => search.id === id);
    if (!savedSearch) return null;
    savedSearch.usageCount += 1;
    savedSearch.updatedAt = new Date().toISOString();
    writeStoredArray(this.storage, STORAGE_KEYS.saved, this.savedSearches);
    return savedSearch;
  }

  deleteSavedSearch(id) {
    this.savedSearches = this.savedSearches.filter((search) => search.id !== id);
    writeStoredArray(this.storage, STORAGE_KEYS.saved, this.savedSearches);
  }

  createSavedSearchFolder(name) {
    const normalizedName = (name || 'General').trim() || 'General';
    const existing = this.savedQueryFolders.find((folder) => folder.name.toLowerCase() === normalizedName.toLowerCase());
    if (existing) return existing;

    const folder = {
      id: makeId('folder'),
      name: normalizedName,
      createdAt: new Date().toISOString(),
    };
    this.savedQueryFolders.push(folder);
    writeStoredArray(this.storage, STORAGE_KEYS.folders, this.savedQueryFolders);
    return folder;
  }

  getSavedSearchFolders() {
    return this.savedQueryFolders.map((folder) => ({
      ...folder,
      count: this.savedSearches.filter((search) => search.folder === folder.name).length,
    }));
  }

  shareSearch(id, options = {}) {
    const savedSearch = this.savedSearches.find((search) => search.id === id);
    if (!savedSearch) {
      throw new Error('Saved search not found');
    }

    savedSearch.sharedWith = Array.from(new Set([...(savedSearch.sharedWith || []), ...(options.users || [])]));
    savedSearch.shareToken = savedSearch.shareToken || encodeSharePayload({
      id: savedSearch.id,
      name: savedSearch.name,
      query: savedSearch.query,
      folder: savedSearch.folder,
    });
    savedSearch.updatedAt = new Date().toISOString();
    writeStoredArray(this.storage, STORAGE_KEYS.saved, this.savedSearches);
    return savedSearch.shareToken;
  }

  importSharedSearch(shareToken, options = {}) {
    const parsed = decodeSharePayload(shareToken);
    return this.saveSearch(options.name || parsed.name, parsed.query, {
      folder: options.folder || parsed.folder || 'Shared',
      tags: ['shared'],
    });
  }

  createSearchAlert(input) {
    const alert = {
      id: makeId('alert'),
      savedSearchId: input.savedSearchId || null,
      name: input.name || 'Search alert',
      query: input.query || this.savedSearches.find((search) => search.id === input.savedSearchId)?.query || {},
      cron: input.cron || '0 * * * *',
      channels: input.channels || ['in-app'],
      threshold: Number(input.threshold || 1),
      enabled: input.enabled !== false,
      lastRunAt: null,
      nextRunAt: this.getNextAlertRun(input.cron || '0 * * * *'),
      createdAt: new Date().toISOString(),
    };

    this.searchAlerts.push(alert);
    writeStoredArray(this.storage, STORAGE_KEYS.alerts, this.searchAlerts);
    return alert;
  }

  getSearchAlerts() {
    return [...this.searchAlerts].sort((a, b) => new Date(a.nextRunAt).getTime() - new Date(b.nextRunAt).getTime());
  }

  getNextAlertRun(cronExpression, from = new Date()) {
    const [minute = '0', hour = '*'] = cronExpression.trim().split(/\s+/);
    const next = new Date(from);
    next.setSeconds(0, 0);
    next.setMinutes(next.getMinutes() + 1);
    if (minute !== '*') next.setMinutes(Number(minute.replace('*/', '')) || 0);
    if (hour !== '*') next.setHours(Number(hour.replace('*/', '')) || next.getHours());
    if (next.getTime() <= from.getTime()) next.setHours(next.getHours() + 1);
    return next.toISOString();
  }

  evaluateSearchAlerts(now = new Date()) {
    return this.searchAlerts
      .filter((alert) => alert.enabled && new Date(alert.nextRunAt).getTime() <= now.getTime())
      .map((alert) => {
        const result = this.search({ ...alert.query, cache: false });
        alert.lastRunAt = now.toISOString();
        alert.nextRunAt = this.getNextAlertRun(alert.cron, now);
        writeStoredArray(this.storage, STORAGE_KEYS.alerts, this.searchAlerts);
        return {
          alert,
          resultCount: result.total,
          triggered: result.total >= alert.threshold,
        };
      });
  }

  getSearchHistory() {
    return [...this.searchHistory];
  }

  getFrequentSearches(limit = 5) {
    const counts = new Map();
    this.searchHistory.forEach((entry) => {
      const key = entry.query?.text || JSON.stringify(entry.query?.filters || {});
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([query, count]) => ({ query, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  getSearchAnalytics() {
    const history = this.getSearchHistory();
    const totalSearchTime = history.reduce((sum, entry) => sum + (entry.searchTime || 0), 0);
    return {
      totalSearches: history.length,
      cachedSearches: history.filter((entry) => entry.cached).length,
      averageSearchTime: history.length ? totalSearchTime / history.length : 0,
      savedSearches: this.savedSearches.length,
      folders: this.savedQueryFolders.length,
      alerts: this.searchAlerts.length,
      frequentSearches: this.getFrequentSearches(),
      cacheEntries: this.resultCache.size,
    };
  }

  /**
   * Get search suggestions
   * @param {string} partial - Partial search term
   * @returns {array} Suggestions
   */
  getSuggestions(partial) {
    if (!partial || partial.length < 2) return [];

    const suggestions = new Set();
    const lowerPartial = partial.toLowerCase();

    // Find matching terms from search index
    this.searchIndex.forEach((items, term) => {
      if (term.includes(lowerPartial)) {
        suggestions.add(term);
      }
    });

    // Add common operation types
    const operationTypes = ['payment', 'create_account', 'manage_offer', 'set_options', 'change_trust'];
    operationTypes.forEach(type => {
      if (type.includes(lowerPartial)) {
        suggestions.add(type);
      }
    });

    // Add common assets
    const commonAssets = ['XLM', 'USDC', 'BTC', 'ETH', 'USDT'];
    commonAssets.forEach(asset => {
      if (asset.toLowerCase().includes(lowerPartial)) {
        suggestions.add(asset);
      }
    });

    return Array.from(suggestions).slice(0, 10);
  }

  /**
   * Clear search history
   */
  clearHistory() {
    this.searchHistory = [];
  }

  /**
   * Reset all filters
   */
  resetFilters() {
    this.filters = {
      dateRange: { start: null, end: null },
      assetType: null,
      operationType: null,
      amountRange: { min: null, max: null },
      addressFilter: null,
      memoFilter: null,
      statusFilter: null,
      networkFilter: null
    };
  }

  /**
   * Get current filters
   * @returns {object} Current filters
   */
  getFilters() {
    return { ...this.filters };
  }

  /**
   * Get search statistics
   * @returns {object} Search statistics
   */
  getStatistics() {
    return {
      indexedItems: Array.from(this.indexedData.values()).reduce((total, items) => total + items.length, 0),
      indexedTypes: Array.from(this.indexedData.keys()),
      searchTerms: this.searchIndex.size,
      searchHistory: this.searchHistory.length,
      savedSearches: this.savedSearches.length
    };
  }
}

// Create singleton instance
const advancedSearchService = new AdvancedSearchService();

export default advancedSearchService;
export { AdvancedSearchService };
