import { useState, useEffect, useCallback, useRef } from 'react'
import {
  addLabel as addLabelApi,
  updateLabel as updateLabelApi,
  removeLabel as removeLabelApi,
  getLabel as getLabelApi,
  getAllLabels,
  searchLabels as searchLabelsApi,
  subscribe,
} from '../lib/addressLabels'

/**
 * A single address label entry.
 */
export interface AddressLabelEntry {
  address: string;
  label: string;
  tags: string[];
  category: string;
  color?: string;
  favorite: boolean;
  notes: string;
  network: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Partial label data accepted when creating or updating a label.
 */
export interface AddressLabelData {
  label?: string;
  tags?: string[];
  category?: string;
  color?: string;
  favorite?: boolean;
  notes?: string;
  network?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

/**
 * Return value of the {@link useAddressLabels} hook.
 */
export interface UseAddressLabelsReturn {
  labels: AddressLabelEntry[];
  labelMap: Record<string, AddressLabelEntry>;
  loading: boolean;
  searchQuery: string;
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  getLabel: (address: string) => Promise<AddressLabelEntry | null>;
  addLabel: (address: string, data: AddressLabelData) => Promise<void>;
  updateLabel: (address: string, data: AddressLabelData) => Promise<void>;
  removeLabel: (address: string) => Promise<void>;
  searchLabels: (query: string) => Promise<AddressLabelEntry[]>;
}

export function useAddressLabels(): UseAddressLabelsReturn {
  const [labels, setLabels] = useState<AddressLabelEntry[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [searchQuery, setSearchQuery] = useState<string>('')
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    getAllLabels().then((all) => {
      if (mountedRef.current) {
        setLabels(all)
        setLoading(false)
      }
    })

    const unsub = subscribe((updated) => {
      if (mountedRef.current) setLabels(updated)
    })

    return () => {
      mountedRef.current = false
      unsub()
    }
  }, [])

  const getLabel = useCallback(async (address: string): Promise<AddressLabelEntry | null> => {
    return getLabelApi(address)
  }, [])

  const addLabel = useCallback(async (address: string, data: AddressLabelData): Promise<void> => {
    await addLabelApi(address, data)
  }, [])

  const updateLabel = useCallback(async (address: string, data: AddressLabelData): Promise<void> => {
    await updateLabelApi(address, data)
  }, [])

  const removeLabel = useCallback(async (address: string): Promise<void> => {
    await removeLabelApi(address)
  }, [])

  const searchLabels = useCallback(async (query: string): Promise<AddressLabelEntry[]> => {
    setSearchQuery(query)
    if (!query.trim()) {
      const all = await getAllLabels()
      return all
    }
    return searchLabelsApi(query)
  }, [])

  const labelMap: Record<string, AddressLabelEntry> = {}
  labels.forEach((l) => { labelMap[l.address] = l })

  return {
    labels,
    labelMap,
    loading,
    searchQuery,
    setSearchQuery,
    getLabel,
    addLabel,
    updateLabel,
    removeLabel,
    searchLabels,
  }
}

export default useAddressLabels
