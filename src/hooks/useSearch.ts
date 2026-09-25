import { useMemo, useState } from 'react';
import { DEFAULT_SEARCH_FILTERS, useStore } from '../lib/store';
import type { SearchFilters } from '../lib/store';
import { globalSearch, loadSavedSearches, saveSearch, deleteSavedSearch } from '../utils/search';
import { applyTransactionFilters, applyOperationFilters } from '../lib/filters';

export interface SearchResultItem {
  id: string;
  type: string;
  hash: string;
  memo: string;
  created_at: string;
  label: string;
  meta: string;
  _score?: number;
}

export interface SavedSearchEntry {
  name: string;
  query: string;
  filters: Partial<SearchFilters> | Record<string, unknown>;
  savedAt: string;
}

export interface UseSearchReturn {
  query: string;
  setQuery: ReturnType<typeof useState<string>>[1];
  filters: SearchFilters;
  setFilters: (filters: Partial<SearchFilters>) => void;
  results: SearchResultItem[];
  savedSearches: SavedSearchEntry[];
  saveCurrentSearch: (name: string) => void;
  removeSavedSearch: (name: string) => void;
  applySavedSearch: (entry: SavedSearchEntry | null | undefined) => void;
}

export function useSearch(): UseSearchReturn {
  const { transactions, operations, connectedAddress, searchFilters, setSearchFilters } =
    useStore();
  const [query, setQuery] = useState<string>('');
  const [savedSearches, setSavedSearches] = useState<SavedSearchEntry[]>(() => loadSavedSearches() as SavedSearchEntry[]);

  const dataset: SearchResultItem[] = useMemo(() => {
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

  const results: SearchResultItem[] = useMemo(() => {
    return globalSearch(dataset, query, ['label', 'meta', 'memo', 'hash']).slice(0, 25) as SearchResultItem[];
  }, [dataset, query]);

  function saveCurrentSearch(name: string): void {
    setSavedSearches(saveSearch(name, query, searchFilters) as SavedSearchEntry[]);
  }

  function removeSavedSearch(name: string): void {
    setSavedSearches(deleteSavedSearch(name) as SavedSearchEntry[]);
  }

  function applySavedSearch(entry: SavedSearchEntry | null | undefined): void {
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
