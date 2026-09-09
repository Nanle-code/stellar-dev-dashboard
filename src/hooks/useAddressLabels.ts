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

export function useAddressLabels() {
  const [labels, setLabels] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
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

  const getLabel = useCallback(async (address) => {
    return getLabelApi(address)
  }, [])

  const addLabel = useCallback(async (address, data) => {
    await addLabelApi(address, data)
  }, [])

  const updateLabel = useCallback(async (address, data) => {
    await updateLabelApi(address, data)
  }, [])

  const removeLabel = useCallback(async (address) => {
    await removeLabelApi(address)
  }, [])

  const searchLabels = useCallback(async (query) => {
    setSearchQuery(query)
    if (!query.trim()) {
      const all = await getAllLabels()
      return all
    }
    return searchLabelsApi(query)
  }, [])

  const labelMap = {}
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
