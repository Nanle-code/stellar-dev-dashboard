import { useState, useEffect, useRef } from 'react'
import { useStore } from '../store'
import {
  fetchAccount,
  fetchTransactions,
  fetchNetworkStats,
  fetchXLMPrice,
} from '../services/stellar'

type CacheEntry<T> = {
  data: T
  timestamp: number
}

const cache = new Map<string, CacheEntry<any>>()
const CACHE_TTL = 30_000

function getCached<T>(key: string): T | null {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    cache.delete(key)
    return null
  }
  return entry.data as T
}

function setCache<T>(key: string, data: T): void {
  cache.set(key, { data, timestamp: Date.now() })
}

interface SWRResult<T> {
  data: T | null
  error: string | null
  loading: boolean
  refresh: () => Promise<void>
}

export function useAccount(): SWRResult<any> {
  const connectedAddress = useStore((s) => s.connectedAddress)
  const network = useStore((s) => s.network)
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    if (!connectedAddress) return
    const key = `account:${connectedAddress}:${network}`
    const cached = getCached(key)
    if (cached) {
      setData(cached)
      return
    }

    setLoading(true)
    fetchAccount(connectedAddress, network)
      .then((result) => {
        if (mountedRef.current) {
          setData(result)
          setCache(key, result)
          setError(null)
        }
      })
      .catch((e) => {
        if (mountedRef.current) setError((e as Error).message)
      })
      .finally(() => {
        if (mountedRef.current) setLoading(false)
      })
  }, [connectedAddress, network])

  const refresh = async () => {
    if (!connectedAddress) return
    setLoading(true)
    try {
      const result = await fetchAccount(connectedAddress, network)
      setData(result)
      setCache(`account:${connectedAddress}:${network}`, result)
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    }
    setLoading(false)
  }

  return { data, error, loading, refresh }
}

export function useTransactions(limit = 20): SWRResult<any[]> {
  const connectedAddress = useStore((s) => s.connectedAddress)
  const network = useStore((s) => s.network)
  const [data, setData] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    if (!connectedAddress) return
    const key = `tx:${connectedAddress}:${network}:${limit}`
    const cached = getCached<any[]>(key)
    if (cached) {
      setData(cached)
      return
    }

    setLoading(true)
    fetchTransactions(connectedAddress, network, limit)
      .then(({ records }) => {
        if (mountedRef.current) {
          setData(records)
          setCache(key, records)
          setError(null)
        }
      })
      .catch((e) => {
        if (mountedRef.current) setError((e as Error).message)
      })
      .finally(() => {
        if (mountedRef.current) setLoading(false)
      })
  }, [connectedAddress, network, limit])

  const refresh = async () => {
    if (!connectedAddress) return
    setLoading(true)
    try {
      const { records } = await fetchTransactions(connectedAddress, network, limit)
      setData(records)
      setCache(`tx:${connectedAddress}:${network}:${limit}`, records)
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    }
    setLoading(false)
  }

  return { data, error, loading, refresh }
}

export function useNetworkStats(): SWRResult<any> {
  const network = useStore((s) => s.network)
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const key = `stats:${network}`
    const cached = getCached(key)
    if (cached) {
      setData(cached)
      return
    }

    setLoading(true)
    fetchNetworkStats(network)
      .then((result) => {
        setData(result)
        setCache(key, result)
        setError(null)
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false))
  }, [network])

  const refresh = async () => {
    setLoading(true)
    try {
      const result = await fetchNetworkStats(network)
      setData(result)
      setCache(`stats:${network}`, result)
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    }
    setLoading(false)
  }

  return { data, error, loading, refresh }
}

export function useXLMPrice(): SWRResult<{ usd: number }> {
  const [data, setData] = useState<{ usd: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const cached = getCached<{ usd: number }>('xlm-price')
    if (cached) {
      setData(cached)
      return
    }

    setLoading(true)
    fetchXLMPrice()
      .then((result) => {
        setData(result)
        setCache('xlm-price', result)
        setError(null)
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false))
  }, [])

  const refresh = async () => {
    setLoading(true)
    try {
      const result = await fetchXLMPrice()
      setData(result)
      setCache('xlm-price', result)
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    }
    setLoading(false)
  }

  return { data, error, loading, refresh }
}
