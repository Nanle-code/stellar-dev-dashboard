import { useMemo, useState } from 'react';
import { useStore } from '../lib/store';
import { globalSearch, loadSavedSearches, saveSearch, deleteSavedSearch } from '../utils/search';
import { applyTransactionFilters, applyOperationFilters } from '../lib/filters';
import type { SearchFilters } from '../lib/store';

export interface SearchDataItem {
  id: string;
  type: 'transaction' | 'operation' | 'account';
  hash: string;
  memo: string;
  created_at: string;
  label: string;
  meta: string;
}

export interface SavedSearch {
  name: string;
  query: string;
  filters: SearchFilters;
}

export interface UseSearchReturn {
  query: string;
  setQuery: (q: string) => void;
  filters: SearchFilters;
  setFilters: (filters: SearchFilters) => void;
  results: SearchDataItem[];
  savedSearches: SavedSearch[];
  saveCurrentSearch: (name: string) => void;
  removeSavedSearch: (name: string) => void;
  applySavedSearch: (entry: SavedSearch | null) => void;
}

export function useSearch(): UseSearchReturn {
  const { transactions, operations, connectedAddress, searchFilters, setSearchFilters } = useStore();
  const [query, setQuery] = useState('');
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>(() => loadSavedSearches());

  const dataset = useMemo<SearchDataItem[]>(() => {
    const tx = applyTransactionFilters(transactions, searchFilters).map((item: Record<string, unknown>) => ({
      id: `tx-${item.id}`,
      type: 'transaction' as const,
      hash: String(item.hash ?? ''),
      memo: String(item.memo ?? ''),
      created_at: String(item.created_at ?? ''),
      label: String(item.hash ?? ''),
      meta: `${item.operation_count ?? 0} ops`,
    }));

    const ops = applyOperationFilters(operations, searchFilters).map((item: Record<string, unknown>) => ({
      id: `op-${item.id}`,
      type: 'operation' as const,
      hash: String(item.transaction_hash ?? item.id ?? ''),
      memo: '',
      created_at: String(item.created_at ?? ''),
      label: `${item.type} ${item.id}`,
      meta: String(item.from ?? item.to ?? ''),
    }));

    const account: SearchDataItem[] = connectedAddress
      ? [{ id: `account-${connectedAddress}`, type: 'account', hash: connectedAddress, memo: '', created_at: '', label: connectedAddress, meta: 'Connected wallet' }]
      : [];

    return [...account, ...tx, ...ops];
  }, [transactions, operations, connectedAddress, searchFilters]);

  const results = useMemo<SearchDataItem[]>(
    () => globalSearch(dataset, query, ['label', 'meta', 'memo', 'hash']).slice(0, 25),
    [dataset, query],
  );

  function saveCurrentSearch(name: string) {
    setSavedSearches(saveSearch(name, query, searchFilters));
  }

  function removeSavedSearch(name: string) {
    setSavedSearches(deleteSavedSearch(name));
  }

  function applySavedSearch(entry: SavedSearch | null) {
    if (!entry) return;
    setQuery(entry.query ?? '');
    setSearchFilters(entry.filters ?? searchFilters);
  }

  return { query, setQuery, filters: searchFilters, setFilters: setSearchFilters, results, savedSearches, saveCurrentSearch, removeSavedSearch, applySavedSearch };
}

export default useSearch;
