import { useMemo, useState } from 'react';
import { DEFAULT_SEARCH_FILTERS, useStore } from '../lib/store';
import { globalSearch, loadSavedSearches, saveSearch, deleteSavedSearch } from '../utils/search';
import { applyTransactionFilters, applyOperationFilters } from '../lib/filters';

export function useSearch() {
  const { transactions, operations, connectedAddress, searchFilters, setSearchFilters } =
    useStore();
  const [query, setQuery] = useState('');
  const [savedSearches, setSavedSearches] = useState(() => loadSavedSearches());

  const dataset = useMemo(() => {
    const tx = applyTransactionFilters(transactions, searchFilters).map((item) => ({
      id: `tx-${item.id}`,
      type: 'transaction',
      hash: item.hash,
      memo: item.memo || '',
      created_at: item.created_at,
      label: item.hash,
      meta: `${item.operation_count || 0} ops`,
    }));

    const ops = applyOperationFilters(operations, searchFilters).map((item) => ({
      id: `op-${item.id}`,
      type: 'operation',
      hash: item.transaction_hash || item.id,
      memo: '',
      created_at: item.created_at,
      label: `${item.type} ${item.id}`,
      meta: item.from || item.to || '',
    }));

    const account = connectedAddress
      ? [
          {
            id: `account-${connectedAddress}`,
            type: 'account',
            hash: connectedAddress,
            memo: '',
            created_at: '',
            label: connectedAddress,
            meta: 'Connected wallet',
          },
        ]
      : [];

    return [...account, ...tx, ...ops];
  }, [transactions, operations, connectedAddress, searchFilters]);

  const results = useMemo(() => {
    return globalSearch(dataset, query, ['label', 'meta', 'memo', 'hash']).slice(0, 25);
  }, [dataset, query]);

  function saveCurrentSearch(name) {
    setSavedSearches(saveSearch(name, query, searchFilters));
  }

  function removeSavedSearch(name) {
    setSavedSearches(deleteSavedSearch(name));
  }

  function applySavedSearch(entry) {
    if (!entry) return;
    setQuery(entry.query || '');
    setSearchFilters({ ...DEFAULT_SEARCH_FILTERS, ...(entry.filters || {}) });
  }

  return {
    query,
    setQuery,
    filters: searchFilters,
    setFilters: setSearchFilters,
    results,
    savedSearches,
    saveCurrentSearch,
    removeSavedSearch,
    applySavedSearch,
  };
}

export default useSearch;
